import { referenceState } from '../reference'
import { INF } from '../types'
import type { Attr, Day, Fact, Value } from '../types'
import type { Applied, Config, Strategy } from './index'
import { liveSnapshot } from './snapshots'
import type { Snapshot } from './snapshots'

export type HybridState = { log: Fact[]; snapshots: Snapshot[]; seq: number }

/**
 * Grid points: sort the distinct validFrom values present in the log, then
 * take the k-th, 2k-th, 3k-th, ... one (1-indexed), where k = cfg.snapshotInterval.
 *
 * `Config.snapshotInterval` keeps its historic name (`Config` lives in
 * strategies/index.ts, which this strategy does not own) but its unit has
 * changed: it now counts EVENTS — distinct valid-time points seen in the log
 * — not calendar days. A grid pinned to calendar days over a fixed horizon
 * stops meaning anything once the history has, say, 10,000 facts packed into
 * that same horizon: the grid never gets any denser, so replay windows grow
 * without bound while storage stays flat. An event grid grows with the
 * history instead, which is what real systems that "snapshot every k events"
 * actually do.
 *
 * If the log has fewer than k distinct valid times, the grid is empty — see
 * query()/readCost() below, which already treat "no live snapshot found" as
 * "replay the whole log from the beginning" (`snap?.validAt ?? -Infinity`).
 * So correctness never depends on the grid being non-empty; an empty grid
 * just means every read pays a full replay, same as it would for any other
 * strategy with no cached state at all.
 */
function gridPoints(log: readonly Fact[], cfg: Config): Day[] {
  const distinct = [...new Set(log.map((f) => f.validFrom))].sort((a, b) => a - b)
  const k = cfg.snapshotInterval
  const points: Day[] = []
  for (let i = k - 1; i < distinct.length; i += k) points.push(distinct[i]!)
  return points
}

/** Facts that must be replayed on top of a snapshot at `lower`, in apply order. */
function replay(
  log: readonly Fact[], attr: Attr, lower: Day, valid: Day, system: Day,
): Fact[] {
  return log
    .filter((f) => f.attr === attr && f.systemTime <= system && f.validFrom > lower && f.validFrom <= valid)
    .sort((a, b) => a.validFrom - b.validFrom || a.systemTime - b.systemTime)
}

/**
 * Snapshots.ts with the grid strided instead of data-driven for every point:
 * one snapshot every cfg.snapshotInterval distinct valid times seen so far
 * (see gridPoints above), plus the full log. Fewer cached points than
 * snapshots.ts, so a retroactive fact invalidates and rebuilds fewer records
 * — cheaper storage, cheaper writes. The price comes back on read as a
 * bounded replay from the nearest live grid point at or before `valid`,
 * instead of a direct hit.
 *
 * The grid is recomputed from the up-to-date log on every apply(), the same
 * way snapshots.ts recomputes its (unstrided) point set from the log. This
 * keeps the invariant simple: on each fact, close every live snapshot whose
 * validAt is at or after the fact's validFrom (it may now be wrong), then
 * write fresh snapshots for whatever the *current* grid says the points at
 * or after that validFrom are. Because inserting one new distinct valid time
 * never changes the sort position of any distinct time before it, every
 * grid point strictly before the new fact's validFrom keeps the same index
 * it always had — so points left untouched here are still correct, and nothing
 * before the fact's validFrom needs revisiting.
 */
export const hybrid: Strategy<HybridState> = {
  key: 'hybrid',
  name: 'Hybrid',
  blurb: 'Snapshots on an event grid (every k valid times), plus the log. Bounded replay on read.',
  correct: true,

  empty: () => ({ log: [], snapshots: [], seq: 0 }),

  apply(state: HybridState, fact: Fact, cfg: Config): Applied<HybridState> {
    const { validFrom: v, systemTime: t } = fact
    const log = [...state.log, fact]
    let seq = state.seq
    const nextId = () => `${fact.id}-${++seq}`

    let invalidated = 0
    const kept: Snapshot[] = []
    for (const s of state.snapshots) {
      const affected = s.systemTo === INF && s.validAt >= v
      if (!affected) { kept.push(s); continue }
      invalidated += 1
      // A snapshot opened and closed at the same instant can never be read
      // back, so it is dropped rather than stored as noise (see intervals.ts).
      if (s.systemFrom < t) kept.push({ ...s, systemTo: t })
    }

    const points = gridPoints(log, cfg).filter((p) => p >= v)
    let written = 0
    for (const p of points) {
      kept.push({
        id: nextId(), validAt: p, state: referenceState(log, p, t),
        systemFrom: t, systemTo: INF,
      })
      written += 1
    }

    return { state: { log, snapshots: kept, seq }, ops: { written, rewritten: 0, invalidated } }
  },

  query(state: HybridState, attr: Attr, valid: Day, system: Day): Value | undefined {
    const snap = liveSnapshot(state.snapshots, valid, system)
    let value = snap?.state[attr]
    for (const f of replay(state.log, attr, snap?.validAt ?? -Infinity, valid, system)) {
      value = f.value
    }
    return value
  },

  readCost(state: HybridState, attr: Attr, valid: Day, system: Day): number {
    const snap = liveSnapshot(state.snapshots, valid, system)
    return 1 + replay(state.log, attr, snap?.validAt ?? -Infinity, valid, system).length
  },

  size: (state: HybridState) => state.snapshots.length,
}

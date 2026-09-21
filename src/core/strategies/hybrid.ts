import { HORIZON } from '../log'
import { referenceState } from '../reference'
import { INF } from '../types'
import type { Attr, Day, Fact, Value } from '../types'
import type { Applied, Config, Strategy } from './index'
import { liveSnapshot } from './snapshots'
import type { Snapshot } from './snapshots'

export type HybridState = { log: Fact[]; snapshots: Snapshot[]; seq: number }

function gridPoints(cfg: Config): Day[] {
  const points: Day[] = []
  for (let p = HORIZON.start; p <= HORIZON.end; p += cfg.snapshotInterval) points.push(p)
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
 * Snapshots.ts with the grid fixed instead of data-driven: one snapshot every
 * cfg.snapshotInterval days across the horizon, plus the full log. Fewer cached
 * points, so a retroactive fact invalidates and rebuilds fewer records than
 * snapshots.ts does — cheaper storage, cheaper writes. The price comes back on
 * read as a bounded replay from the nearest grid point at or before `valid`,
 * instead of a direct hit.
 */
export const hybrid: Strategy<HybridState> = {
  key: 'hybrid',
  name: 'Hybrid',
  blurb: 'Snapshots on a fixed grid, plus the log. Bounded replay on read.',
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

    const points = gridPoints(cfg).filter((p) => p >= v)
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

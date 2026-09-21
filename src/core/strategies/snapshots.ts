import { referenceState } from '../reference'
import { INF } from '../types'
import type { Attr, Day, EntityState, Fact, Value } from '../types'
import type { Applied, Config, Strategy } from './index'

/**
 * A snapshot is itself bitemporal: a full-state view at one valid-time point,
 * believed over a range of system time. Retiring one closes it rather than
 * mutating it, same as intervals.ts, so past beliefs stay queryable.
 */
export type Snapshot = {
  id: string
  validAt: Day
  state: EntityState
  systemFrom: Day
  systemTo: Day
}

export type SnapshotState = { log: Fact[]; snapshots: Snapshot[]; seq: number }

/** Greatest validAt at or before `valid`, among snapshots live at `system`. */
export function liveSnapshot(
  snaps: readonly Snapshot[], valid: Day, system: Day,
): Snapshot | undefined {
  let best: Snapshot | undefined
  for (const s of snaps) {
    if (system < s.systemFrom || system >= s.systemTo) continue
    if (s.validAt > valid) continue
    if (best === undefined || s.validAt > best.validAt) best = s
  }
  return best
}

/**
 * One full-state snapshot per distinct validFrom seen in the log. A read is a
 * direct lookup: find the live snapshot with the greatest validAt <= valid and
 * you are done — no replay, ever. The cost moves entirely to the write. Every
 * snapshot is a cached projection of state, so a retroactive fact — one whose
 * validFrom lands before points we already snapshotted — must close and rebuild
 * all of them, because what they say just changed. Points before the fact's
 * validFrom are left alone: nothing that already happened can be altered by
 * something recorded to hold from a later point onward.
 */
export const snapshots: Strategy<SnapshotState> = {
  key: 'snapshots',
  name: 'Snapshots',
  blurb: 'One full-state snapshot per valid-time point seen. Direct reads, rebuilding writes.',
  correct: true,

  empty: () => ({ log: [], snapshots: [], seq: 0 }),

  apply(state: SnapshotState, fact: Fact, _cfg: Config): Applied<SnapshotState> {
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

    const points = [...new Set(log.map((f) => f.validFrom))].filter((p) => p >= v)
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

  query(state: SnapshotState, attr: Attr, valid: Day, system: Day): Value | undefined {
    return liveSnapshot(state.snapshots, valid, system)?.state[attr]
  },

  readCost: (state: SnapshotState, _attr: Attr, valid: Day, system: Day) =>
    liveSnapshot(state.snapshots, valid, system) === undefined ? 0 : 1,

  size: (state: SnapshotState) => state.snapshots.length,
}

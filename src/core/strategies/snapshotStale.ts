import { referenceState } from '../reference'
import { INF } from '../types'
import type { Attr, Day, Fact, Value } from '../types'
import type { Applied, Config, Strategy } from './index'
import { liveSnapshot } from './snapshots'
import type { Snapshot } from './snapshots'

export type StaleSnapshotState = { log: Fact[]; snapshots: Snapshot[]; seq: number }

/**
 * snapshots.ts with the rebuild step removed. On apply it opens a snapshot at
 * the fact's own validFrom and nothing else — it never revisits snapshots
 * already sitting at later valid-time points, so a retroactive fact leaves
 * them holding whatever they held before.
 *
 * Concretely: the snapshot taken at 1 April carries salary = 60,000, because on
 * that day only the manager changed. The raise that should have applied from
 * 1 March is not recorded until 10 June, with a validFrom before that
 * snapshot's — and nothing goes back to rebuild it. So from the moment the
 * raise is recorded, every read at valid >= 1 April still returns the stale
 * 60,000 instead of 72,000, forever.
 */
export const snapshotStale: Strategy<StaleSnapshotState> = {
  key: 'snapshotStale',
  name: 'Snapshots, uninvalidated',
  blurb: 'Opens a snapshot at the new point only — later snapshots never get rebuilt.',
  correct: false,

  empty: () => ({ log: [], snapshots: [], seq: 0 }),

  apply(state: StaleSnapshotState, fact: Fact, _cfg: Config): Applied<StaleSnapshotState> {
    const { validFrom: v, systemTime: t } = fact
    const log = [...state.log, fact]
    let seq = state.seq
    const nextId = () => `${fact.id}-${++seq}`

    // Only the snapshot at exactly this valid point is touched — the bug.
    let invalidated = 0
    const kept: Snapshot[] = []
    for (const s of state.snapshots) {
      const affected = s.systemTo === INF && s.validAt === v
      if (!affected) { kept.push(s); continue }
      invalidated += 1
      if (s.systemFrom < t) kept.push({ ...s, systemTo: t })
    }

    kept.push({
      id: nextId(), validAt: v, state: referenceState(log, v, t),
      systemFrom: t, systemTo: INF,
    })

    return { state: { log, snapshots: kept, seq }, ops: { written: 1, rewritten: 0, invalidated } }
  },

  query(state: StaleSnapshotState, attr: Attr, valid: Day, system: Day): Value | undefined {
    return liveSnapshot(state.snapshots, valid, system)?.state[attr]
  },

  readCost: (state: StaleSnapshotState, _attr: Attr, valid: Day, system: Day) =>
    liveSnapshot(state.snapshots, valid, system) === undefined ? 0 : 1,

  size: (state: StaleSnapshotState) => state.snapshots.length,
}

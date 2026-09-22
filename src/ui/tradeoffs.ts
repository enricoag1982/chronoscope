/**
 * Why you would choose each representation, and what it costs you. Kept beside
 * the rows rather than in a document, because the argument only lands while you
 * are watching the thing react to a retroactive fact.
 *
 * Presentation copy, so it lives in the interface layer — core stays free of
 * prose about itself.
 */
export type Tradeoff = { for: string[]; against: string[] }

export const TRADEOFFS: Record<string, Tradeoff> = {
  events: {
    for: [
      'Facts are immutable. Nothing is edited or deleted, so the store is itself the audit record: replayable, replicable, and reviewable without a second system.',
      'Writes are always one record, and a correction costs exactly what an ordinary fact costs.',
      'Events assign a value rather than a difference, so inserting one dated in the past cannot change what any other event means.',
    ],
    against: [
      'Every read replays the whole history.',
      'Reads get permanently slower as history grows, even for a single value.',
    ],
  },
  intervals: {
    for: [
      'No row is ever mutated in place. A superseded row is closed in system time, not edited, so every past belief stays on disk and stays queryable.',
      'Reads are a direct lookup: find the one row containing the coordinate.',
    ],
    against: [
      'One write touches several rows — closing and reopening neighbours rather than appending.',
      'A retroactive fact clipped incorrectly overwrites every later change, without error.',
    ],
  },
  snapshots: {
    for: [
      'Reads are a direct lookup with no replay at all.',
      'State at a moment is stored rather than derived, so nothing has to be reconstructed at read time.',
    ],
    against: [
      'Snapshots are derived state, not the record. They get rebuilt, so the audit trail has to live somewhere else — you have two things to trust instead of one.',
      'Every snapshot restates every attribute, including the ones that did not change.',
      'A retroactive fact invalidates and rebuilds every snapshot after it; the cost scales with how far back it reaches.',
    ],
  },
  hybrid: {
    for: [
      'The log stays immutable and authoritative; the snapshots are only an index over it, and can be thrown away and rebuilt.',
      'Replay is bounded: one snapshot plus at most k events. One knob trades storage against read cost.',
    ],
    against: [
      'Two structures to keep consistent instead of one.',
      'Retroactive facts still force rebuilds — fewer of them, not none.',
    ],
  },
  snapshotStale: {
    for: [
      'The cheapest writes here: nothing downstream is touched, and no bookkeeping is needed to find what to rebuild.',
    ],
    against: [
      'It is wrong. Snapshots written before a retroactive fact keep values that fact should have replaced.',
      'Nothing raises an error. The read succeeds and returns the superseded value.',
      'The underlying log remains correct, so any check that inspects stored facts passes while the answers stay wrong.',
    ],
  },
}

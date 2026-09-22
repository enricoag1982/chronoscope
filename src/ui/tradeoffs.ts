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
  deltas: {
    for: [
      'Writes are always one record, and a correction costs exactly what an ordinary fact costs.',
      'Nothing is ever destroyed, so the log is already the audit trail.',
    ],
    against: [
      'Every read replays the whole history.',
      'Reads get permanently slower as history grows, even for a single value.',
    ],
  },
  intervals: {
    for: [
      'Reads are a direct lookup: find the one row containing the coordinate.',
      'Half-open ranges tile time exactly, so “what did we believe then” is an ordinary query.',
    ],
    against: [
      'Writes rewrite: a row is closed in system time and replacements opened.',
      'Clipping a retroactive fact wrongly lets it swallow every later change — silently.',
    ],
  },
  snapshots: {
    for: [
      'Reads are a direct lookup with no replay at all.',
      'State at a moment is stored rather than derived, so nothing has to be reconstructed.',
    ],
    against: [
      'Every snapshot restates every attribute, including the ones that did not change.',
      'A retroactive fact invalidates and rebuilds every snapshot after it — the cost scales with how far back it reaches.',
    ],
  },
  hybrid: {
    for: [
      'Replay is bounded: one snapshot plus at most k events.',
      'A single knob trades storage against read cost, and you can move it after the fact.',
    ],
    against: [
      'Two structures to keep consistent instead of one.',
      'Retroactive facts still force rebuilds — fewer of them, not none.',
    ],
  },
  snapshotStale: {
    for: [
      'The cheapest writes here, because nothing downstream is touched. This is exactly why it gets shipped.',
    ],
    against: [
      'It is wrong. Snapshots written before a retroactive fact keep values the fact should have replaced.',
      'The failure is silent: no exception, no error log, just an old number returned confidently forever.',
    ],
  },
}

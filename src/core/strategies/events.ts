import type { Attr, Day, Fact, Value } from '../types'
import type { Applied, Config, Strategy } from './index'

export type EventLogState = { facts: Fact[] }

/**
 * Store the facts and nothing else. The cheapest write and the most expensive
 * read: every query replays the log. A correction costs no more to record than
 * an ordinary fact, and the price is paid on every read afterwards.
 *
 * Each event carries an absolute value — `salary := 72,000` — rather than a
 * difference from the previous one. This is not a simplification. A difference
 * only encodes numeric attributes, and `manager` has none: there is no
 * subtraction between 'Jim' and 'Rob'. More importantly, a difference means an
 * event's meaning depends on every earlier event being present and applied
 * exactly once, so inserting a fact retroactively silently changes what every
 * later event means. That is the same failure class as the uninvalidated
 * snapshot, and it is why an absolute assignment is the safe primitive here.
 */
export const events: Strategy<EventLogState> = {
  key: 'events',
  name: 'Event log',
  blurb: 'Append-only log of assignments. Reads replay it.',
  correct: true,

  empty: () => ({ facts: [] }),

  apply(state: EventLogState, fact: Fact, _cfg: Config): Applied<EventLogState> {
    return {
      state: { facts: [...state.facts, fact] },
      ops: { written: 1, rewritten: 0, invalidated: 0 },
    }
  },

  query(state: EventLogState, attr: Attr, valid: Day, system: Day): Value | undefined {
    let best: Fact | undefined
    for (const f of state.facts) {
      if (f.attr !== attr || f.systemTime > system || f.validFrom > valid) continue
      if (
        best === undefined ||
        f.validFrom > best.validFrom ||
        (f.validFrom === best.validFrom && f.systemTime > best.systemTime)
      ) best = f
    }
    return best?.value
  },

  readCost: (state: EventLogState) => state.facts.length,
  size: (state: EventLogState) => state.facts.length,
}

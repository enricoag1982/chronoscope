import type { Attr, Day, Fact, Value } from '../types'
import type { Applied, Config, Strategy } from './index'

export type DeltaState = { facts: Fact[] }

/**
 * Store the facts and nothing else. The cheapest possible write and the most
 * expensive possible read: every query replays the whole log. Corrections are
 * free to record and cost nothing extra to store — the price is paid forever
 * afterwards, on every read.
 */
export const deltas: Strategy<DeltaState> = {
  key: 'deltas',
  name: 'Deltas',
  blurb: 'Append-only log of facts. Reads replay.',
  correct: true,

  empty: () => ({ facts: [] }),

  apply(state: DeltaState, fact: Fact, _cfg: Config): Applied<DeltaState> {
    return {
      state: { facts: [...state.facts, fact] },
      ops: { written: 1, rewritten: 0, invalidated: 0 },
    }
  },

  query(state: DeltaState, attr: Attr, valid: Day, system: Day): Value | undefined {
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

  readCost: (state: DeltaState) => state.facts.length,
  size: (state: DeltaState) => state.facts.length,
}

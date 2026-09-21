import { day } from './core/dates'
import { HORIZON, SCENARIO, append, latestSystemTime, makeFact } from './core/log'
import { DEFAULT_CONFIG } from './core/strategies/index'
import type { Attr, Day, Fact, Value } from './core/types'

export type AppState = {
  log: Fact[]
  /** "now" — the system time at which new facts are recorded. Only ever advances. */
  clock: Day
  validCursor: Day
  systemCursor: Day
  snapshotInterval: number
}

export type Action =
  | { type: 'addFact'; attr: Attr; value: Value; validFrom: Day }
  | { type: 'advanceClock'; days: number }
  | { type: 'setValidCursor'; day: Day }
  | { type: 'setSystemCursor'; day: Day }
  | { type: 'setSnapshotInterval'; days: number }
  | { type: 'undo' }
  | { type: 'reset' }

const clamp = (d: Day) => Math.min(HORIZON.end, Math.max(HORIZON.start, d))

export function initialState(): AppState {
  const clock = latestSystemTime(SCENARIO)
  return {
    log: SCENARIO,
    clock,
    validCursor: day(2026, 5, 1),
    systemCursor: clock,
    snapshotInterval: DEFAULT_CONFIG.snapshotInterval,
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addFact': {
      // Recorded at the clock, never before it. The form cannot express an
      // illegal system time, so the invariant needs no defending here — but
      // append enforces it anyway, since the log is the thing that owns it.
      const fact = makeFact(action.attr, action.value, clamp(action.validFrom), state.clock)
      return {
        ...state,
        log: append(state.log, fact),
        // A new fact is only visible if you are looking at or after now, so
        // follow the recording rather than silently hiding it.
        systemCursor: Math.max(state.systemCursor, state.clock),
      }
    }

    case 'advanceClock': {
      const clock = clamp(state.clock + action.days)
      return { ...state, clock, systemCursor: Math.max(state.systemCursor, clock) }
    }

    case 'setValidCursor':
      return { ...state, validCursor: clamp(action.day) }

    case 'setSystemCursor':
      return { ...state, systemCursor: clamp(action.day) }

    case 'setSnapshotInterval':
      return { ...state, snapshotInterval: Math.max(1, Math.round(action.days)) }

    case 'undo': {
      if (state.log.length === 0) return state
      const log = state.log.slice(0, -1)
      // The clock does not rewind: undo removes a fact, it does not un-happen
      // the passage of time. Keeping it forward also keeps append legal.
      return { ...state, log, clock: Math.max(state.clock, latestSystemTime(log)) }
    }

    case 'reset':
      return initialState()
  }
}

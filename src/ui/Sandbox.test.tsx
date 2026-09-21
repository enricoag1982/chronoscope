import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatDayLong } from '../core/dates'
import { HORIZON, append, latestSystemTime, makeFact } from '../core/log'
import { MonotonicSystemTimeError } from '../core/log'
import { initialState, reducer } from '../state'
import type { Action, AppState } from '../state'
import { Sandbox } from './Sandbox'

const noBad = (markup: string) => {
  expect(markup).not.toMatch(/NaN/)
  expect(markup).not.toMatch(/Infinity/)
}

describe('Sandbox renders', () => {
  it('on the initial state without throwing', () => {
    const markup = renderToStaticMarkup(<Sandbox state={initialState()} dispatch={() => {}} />)
    noBad(markup)
  })

  it('with an empty log without throwing, and marks undo as disabled', () => {
    const state: AppState = { ...initialState(), log: [] }
    const markup = renderToStaticMarkup(<Sandbox state={state} dispatch={() => {}} />)
    noBad(markup)
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>\s*undo\s*<\/button>/)
  })

  it('shows the clock date and states that a new fact records at the clock', () => {
    const state = initialState()
    const markup = renderToStaticMarkup(<Sandbox state={state} dispatch={() => {}} />)
    expect(markup).toContain(formatDayLong(state.clock))
    expect(markup.toLowerCase()).toContain('recorded at the clock')
  })
})

// The form itself holds no state-machine logic beyond uncommitted fields, so
// the invariants it is built around are exercised against the reducer
// directly, the way state.test.ts does.
describe('the invariants the form relies on', () => {
  it('a fact added after advancing the clock carries the clock systemTime', () => {
    const s = reducer(
      reducer(initialState(), { type: 'advanceClock', days: 14 }),
      { type: 'addFact', attr: 'manager', value: 'Amy', validFrom: HORIZON.start },
    )
    expect(s.log.at(-1)!.systemTime).toBe(s.clock)
  })

  it('never produces a systemTime earlier than the log already had', () => {
    const before = initialState()
    const latestBefore = latestSystemTime(before.log)
    const after = reducer(before, { type: 'addFact', attr: 'salary', value: 99, validFrom: HORIZON.end })
    expect(after.log.at(-1)!.systemTime).toBeGreaterThanOrEqual(latestBefore)
  })

  it('undo then add still yields a log append accepts', () => {
    const s = reducer(
      reducer(initialState(), { type: 'undo' }),
      { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.start },
    )
    expect(() => append(s.log, makeFact('manager', 'X', HORIZON.start, s.clock)))
      .not.toThrow(MonotonicSystemTimeError)
  })

  it('accepts a valid time in the future and one in the past', () => {
    const base = initialState()
    const past = reducer(base, { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.start })
    const future = reducer(base, { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.end })
    expect(past.log.at(-1)!.validFrom).toBe(HORIZON.start)
    expect(future.log.at(-1)!.validFrom).toBe(HORIZON.end)
  })
})

/** Deterministic PRNG so a failing sequence reproduces from the seed alone. */
function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('property: 50 pseudo-random legal action sequences', () => {
  const SEED = 20260921

  it('keeps log systemTimes non-decreasing and clock >= latest systemTime throughout', () => {
    const rand = mulberry32(SEED)
    let s: AppState = initialState()

    for (let i = 0; i < 50; i++) {
      const pick = rand()
      const action: Action =
        pick < 0.5
          ? {
              type: 'addFact',
              attr: rand() < 0.5 ? 'salary' : 'manager',
              value: rand() < 0.5 ? Math.round(rand() * 100_000) : 'X',
              validFrom: Math.round(HORIZON.start + rand() * (HORIZON.end - HORIZON.start)),
            }
          : pick < 0.85
          ? { type: 'advanceClock', days: Math.round(rand() * 60) }
          : { type: 'undo' }

      s = reducer(s, action)

      const times = s.log.map((f) => f.systemTime)
      for (let j = 1; j < times.length; j++) {
        expect(times[j]!, `seed ${SEED}, step ${i}, action ${JSON.stringify(action)}`)
          .toBeGreaterThanOrEqual(times[j - 1]!)
      }
      expect(s.clock, `seed ${SEED}, step ${i}, action ${JSON.stringify(action)}`)
        .toBeGreaterThanOrEqual(latestSystemTime(s.log))
    }
  })
})

describe('the add button', () => {
  it('is enabled for the default attribute, and undo reflects the log', () => {
    // The blank-manager guard itself needs a click to reach, so what a static
    // render can honestly assert is the default: salary selected, add enabled,
    // undo live because the scenario has facts.
    const markup = renderToStaticMarkup(<Sandbox state={initialState()} dispatch={() => {}} />)
    expect(markup).toMatch(/<button class="primary"[^>]*>add<\/button>/)
    expect(markup).not.toMatch(/<button[^>]*disabled[^>]*>undo<\/button>/)
  })

  it('disables undo once the log is empty', () => {
    const markup = renderToStaticMarkup(
      <Sandbox state={{ ...initialState(), log: [] }} dispatch={() => {}} />,
    )
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>undo<\/button>/)
  })
})

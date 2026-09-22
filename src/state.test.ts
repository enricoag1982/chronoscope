import { describe, expect, it } from 'vitest'
import { day } from './core/dates'
import { HORIZON, latestSystemTime } from './core/log'
import { initialState, reducer } from './state'
import type { AppState } from './state'

const run = (state: AppState, ...actions: Parameters<typeof reducer>[1][]) =>
  actions.reduce(reducer, state)

describe('the clock', () => {
  it('records new facts at the current clock', () => {
    const s = run(initialState(), { type: 'advanceClock', days: 10 },
      { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.start })
    expect(s.log.at(-1)!.systemTime).toBe(s.clock)
  })

  it('only ever moves forward, and never past the horizon', () => {
    const s = run(initialState(), { type: 'advanceClock', days: 10_000 })
    expect(s.clock).toBe(HORIZON.end)
  })

  it('does not rewind on undo, and stays legal for the remaining log', () => {
    const s = run(initialState(),
      { type: 'advanceClock', days: 20 },
      { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.start },
      { type: 'undo' })
    expect(s.clock).toBeGreaterThanOrEqual(latestSystemTime(s.log))
  })
})

describe('adding a fact', () => {
  it('pulls the system cursor forward so the fact is actually visible', () => {
    const s = run(initialState(),
      { type: 'setSystemCursor', day: HORIZON.start },
      { type: 'advanceClock', days: 5 },
      { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.start })
    expect(s.systemCursor).toBe(s.clock)
  })

  it('accepts a valid time in the past or the future', () => {
    const base = initialState()
    const past = reducer(base, { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.start })
    const future = reducer(base, { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.end })
    expect(past.log.at(-1)!.validFrom).toBe(HORIZON.start)
    expect(future.log.at(-1)!.validFrom).toBe(HORIZON.end)
  })

  it('clamps a valid time outside the horizon rather than rejecting it', () => {
    const s = reducer(initialState(),
      { type: 'addFact', attr: 'salary', value: 1, validFrom: day(2020, 1, 1) })
    expect(s.log.at(-1)!.validFrom).toBe(HORIZON.start)
  })
})

describe('cursors and config', () => {
  it('clamps both cursors to the horizon', () => {
    const s = run(initialState(),
      { type: 'setValidCursor', day: day(2030, 1, 1) },
      { type: 'setSystemCursor', day: day(2020, 1, 1) })
    expect(s.validCursor).toBe(HORIZON.end)
    expect(s.systemCursor).toBe(HORIZON.start)
  })

  it('keeps the snapshot interval at a day or more', () => {
    const s = reducer(initialState(), { type: 'setSnapshotInterval', every: 0 })
    expect(s.snapshotInterval).toBe(1)
  })

  it('undo on an empty log is a no-op', () => {
    const empty = { ...initialState(), log: [] }
    expect(reducer(empty, { type: 'undo' })).toBe(empty)
  })

  it('reset restores the scenario', () => {
    const s = run(initialState(),
      { type: 'addFact', attr: 'salary', value: 1, validFrom: HORIZON.start },
      { type: 'reset' })
    expect(s).toEqual(initialState())
  })
})

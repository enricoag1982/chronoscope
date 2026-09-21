import { describe, expect, it } from 'vitest'
import { criticalPoints, generateLog } from './gen'
import { HORIZON, SCENARIO, append, latestSystemTime, makeFact, MonotonicSystemTimeError } from './log'
import { referenceQuery } from './reference'
import { DEFAULT_CONFIG, materialize } from './strategies/index'
import type { Strategy } from './strategies/index'
import { deltas } from './strategies/deltas'
import { intervals } from './strategies/intervals'
import { ATTRS } from './types'
import type { Fact } from './types'
import { day } from './dates'

const CORRECT: Strategy<never>[] = [deltas, intervals] as unknown as Strategy<never>[]

/**
 * Every strategy must agree with the oracle at every coordinate. Because the
 * surface only breaks at recorded times, sweeping the critical points is
 * exhaustive rather than a sample.
 */
function sweep(strategy: Strategy<never>, log: readonly Fact[]): void {
  const { state } = materialize(strategy, log, DEFAULT_CONFIG)
  const valids = criticalPoints(log.map((f) => f.validFrom), HORIZON.start, HORIZON.end)
  const systems = criticalPoints(log.map((f) => f.systemTime), HORIZON.start, HORIZON.end)

  for (const attr of ATTRS) {
    for (const v of valids) {
      for (const s of systems) {
        const expected = referenceQuery(log, attr, v, s)
        const actual = strategy.query(state, attr, v, s)
        if (actual !== expected) {
          throw new Error(
            `${strategy.name}: ${attr} at valid=${v} system=${s} ` +
            `gave ${String(actual)}, oracle says ${String(expected)}`,
          )
        }
      }
    }
  }
}

describe('the monotonic system clock', () => {
  it('refuses a fact recorded before what the log already knows', () => {
    expect(() => append(SCENARIO, makeFact('salary', 1, 0, day(2026, 2, 1))))
      .toThrow(MonotonicSystemTimeError)
  })

  it('accepts a fact recorded at the current clock', () => {
    const now = latestSystemTime(SCENARIO)
    expect(() => append(SCENARIO, makeFact('salary', 1, 0, now))).not.toThrow()
  })

  it('accepts any valid time, past or future', () => {
    const now = latestSystemTime(SCENARIO)
    expect(() => append(SCENARIO, makeFact('salary', 1, HORIZON.start, now))).not.toThrow()
    expect(() => append(SCENARIO, makeFact('salary', 1, HORIZON.end, now))).not.toThrow()
  })
})

describe('the scenario', () => {
  for (const strategy of CORRECT) {
    it(`${strategy.name} agrees with the oracle everywhere`, () => {
      sweep(strategy, SCENARIO)
    })
  }

  it('the backdated raise is invisible until it is recorded', () => {
    const may = day(2026, 5, 1)
    expect(referenceQuery(SCENARIO, 'salary', may, day(2026, 6, 1))).toBe(60_000)
    expect(referenceQuery(SCENARIO, 'salary', may, day(2026, 6, 10))).toBe(72_000)
  })

  it('and it rewrites March onward, not just the present', () => {
    const now = day(2026, 6, 10)
    expect(referenceQuery(SCENARIO, 'salary', day(2026, 2, 28), now)).toBe(60_000)
    expect(referenceQuery(SCENARIO, 'salary', day(2026, 3, 1), now)).toBe(72_000)
  })
})

describe('generated histories', () => {
  for (let seed = 0; seed < 40; seed++) {
    const log = generateLog(seed, 14)
    for (const strategy of CORRECT) {
      it(`${strategy.name} agrees with the oracle, seed ${seed}`, () => {
        sweep(strategy, log)
      })
    }
  }
})

describe('a retroactive insert', () => {
  it('does not swallow later changes it was recorded after', () => {
    // salary 10 from Jan, 15 from May, then 20 backdated to March. March's raise
    // must stop at May, not run over it.
    const log: Fact[] = [
      makeFact('salary', 10, day(2026, 1, 1), day(2026, 1, 1), 'a'),
      makeFact('salary', 15, day(2026, 5, 1), day(2026, 5, 1), 'b'),
      makeFact('salary', 20, day(2026, 3, 1), day(2026, 6, 1), 'c'),
    ]
    const now = day(2026, 6, 1)
    expect(referenceQuery(log, 'salary', day(2026, 4, 1), now)).toBe(20)
    expect(referenceQuery(log, 'salary', day(2026, 6, 1), now)).toBe(15)
    for (const strategy of CORRECT) sweep(strategy, log)
  })

  it('is superseded by a correction at the same valid time', () => {
    const log: Fact[] = [
      makeFact('salary', 10, day(2026, 1, 1), day(2026, 1, 1), 'a'),
      makeFact('salary', 20, day(2026, 3, 1), day(2026, 6, 1), 'b'),
      makeFact('salary', 25, day(2026, 3, 1), day(2026, 7, 1), 'c'),
    ]
    expect(referenceQuery(log, 'salary', day(2026, 4, 1), day(2026, 6, 15))).toBe(20)
    expect(referenceQuery(log, 'salary', day(2026, 4, 1), day(2026, 7, 1))).toBe(25)
    for (const strategy of CORRECT) sweep(strategy, log)
  })
})

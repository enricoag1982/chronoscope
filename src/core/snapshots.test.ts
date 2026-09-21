import { describe, expect, it } from 'vitest'
import { day } from './dates'
import { criticalPoints, generateLog } from './gen'
import { HORIZON, SCENARIO } from './log'
import { referenceQuery } from './reference'
import { DEFAULT_CONFIG, materialize } from './strategies/index'
import type { Config, Strategy } from './strategies/index'
import { hybrid } from './strategies/hybrid'
import { snapshots } from './strategies/snapshots'
import { snapshotStale } from './strategies/snapshotStale'
import { ATTRS } from './types'
import type { Fact } from './types'

const INTERVALS = [7, 30, 90]
const cfgWith = (snapshotInterval: number): Config => ({ snapshotInterval })

/**
 * Same approach as the sweep in strategies.test.ts: the value surface only
 * breaks at recorded coordinates, so sweeping the critical points is
 * exhaustive rather than a sample.
 */
function sweep<S>(strategy: Strategy<S>, log: readonly Fact[], cfg: Config): void {
  const { state } = materialize(strategy, log, cfg)
  const valids = criticalPoints(log.map((f) => f.validFrom), HORIZON.start, HORIZON.end)
  const systems = criticalPoints(log.map((f) => f.systemTime), HORIZON.start, HORIZON.end)

  for (const attr of ATTRS) {
    for (const v of valids) {
      for (const s of systems) {
        const expected = referenceQuery(log, attr, v, s)
        const actual = strategy.query(state, attr, v, s)
        if (actual !== expected) {
          throw new Error(
            `${strategy.name} (snapshotInterval=${cfg.snapshotInterval}): ${attr} at valid=${v} ` +
            `system=${s} gave ${String(actual)}, oracle says ${String(expected)}`,
          )
        }
      }
    }
  }
}

describe('the scenario', () => {
  it('snapshots agrees with the oracle everywhere', () => {
    sweep(snapshots, SCENARIO, DEFAULT_CONFIG)
  })

  for (const interval of INTERVALS) {
    it(`hybrid agrees with the oracle everywhere, snapshotInterval=${interval}`, () => {
      sweep(hybrid, SCENARIO, cfgWith(interval))
    })
  }
})

describe('generated histories', () => {
  for (let seed = 0; seed < 30; seed++) {
    const log = generateLog(seed, 14)

    it(`snapshots agrees with the oracle, seed ${seed}`, () => {
      sweep(snapshots, log, DEFAULT_CONFIG)
    })

    for (const interval of INTERVALS) {
      it(`hybrid agrees with the oracle, seed ${seed}, snapshotInterval=${interval}`, () => {
        sweep(hybrid, log, cfgWith(interval))
      })
    }
  }
})

describe('snapshotStale: the deliberately incorrect strategy', () => {
  const { state } = materialize(snapshotStale, SCENARIO, DEFAULT_CONFIG)

  // The rectangle where the bug bites: the snapshot at 1 April carries
  // salary = 60,000 because only the manager changed that day, and the raise
  // backdated to 1 March — recorded 10 June — never goes back to rebuild it.
  const RECT_VALID_FROM = day(2026, 4, 1)
  const RECT_SYSTEM_FROM = day(2026, 6, 10)

  it('agrees with the oracle until the backdated raise is recorded', () => {
    const beforeRaiseRecorded = day(2026, 6, 9)
    expect(referenceQuery(SCENARIO, 'salary', RECT_VALID_FROM, beforeRaiseRecorded)).toBe(60_000)
    expect(snapshotStale.query(state, 'salary', RECT_VALID_FROM, beforeRaiseRecorded)).toBe(60_000)
  })

  it('diverges once the raise lands: stale still says 60,000, oracle says 72,000', () => {
    expect(referenceQuery(SCENARIO, 'salary', RECT_VALID_FROM, RECT_SYSTEM_FROM)).toBe(72_000)
    expect(snapshotStale.query(state, 'salary', RECT_VALID_FROM, RECT_SYSTEM_FROM)).toBe(60_000)
  })

  it('disagrees with the oracle throughout the rectangle, always 60,000 vs 72,000', () => {
    const valids = criticalPoints(SCENARIO.map((f) => f.validFrom), HORIZON.start, HORIZON.end)
      .filter((v) => v >= RECT_VALID_FROM)
    const systems = criticalPoints(SCENARIO.map((f) => f.systemTime), HORIZON.start, HORIZON.end)
      .filter((s) => s >= RECT_SYSTEM_FROM)

    for (const v of valids) {
      for (const s of systems) {
        expect(referenceQuery(SCENARIO, 'salary', v, s)).toBe(72_000)
        expect(snapshotStale.query(state, 'salary', v, s)).toBe(60_000)
      }
    }
  })

  it('agrees with the oracle everywhere outside the rectangle', () => {
    const valids = criticalPoints(SCENARIO.map((f) => f.validFrom), HORIZON.start, HORIZON.end)
    const systems = criticalPoints(SCENARIO.map((f) => f.systemTime), HORIZON.start, HORIZON.end)

    for (const attr of ATTRS) {
      for (const v of valids) {
        for (const s of systems) {
          const inRectangle = v >= RECT_VALID_FROM && s >= RECT_SYSTEM_FROM
          if (inRectangle) continue
          const expected = referenceQuery(SCENARIO, attr, v, s)
          const actual = snapshotStale.query(state, attr, v, s)
          expect(actual, `attr=${attr} valid=${v} system=${s}`).toBe(expected)
        }
      }
    }
  })
})

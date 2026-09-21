import { describe, expect, it } from 'vitest'
import { day } from './dates'
import { criticalPoints, generateLog } from './gen'
import { HORIZON, SCENARIO } from './log'
import { referenceQuery } from './reference'
import { DEFAULT_CONFIG, materialize } from './strategies/index'
import { CORRECT_STRATEGIES, INCORRECT_STRATEGIES, STRATEGIES } from './strategies/registry'
import type { AnyStrategy } from './strategies/registry'
import { ATTRS } from './types'
import type { Attr, Day, Fact } from './types'

const cfg = DEFAULT_CONFIG

type Disagreement = { attr: Attr; valid: Day; system: Day; got: unknown; want: unknown }

/** Every coordinate where a strategy parts company with the oracle. */
function disagreements(strategy: AnyStrategy, log: readonly Fact[]): Disagreement[] {
  const { state } = materialize(strategy, log, cfg)
  const valids = criticalPoints(log.map((f) => f.validFrom), HORIZON.start, HORIZON.end)
  const systems = criticalPoints(log.map((f) => f.systemTime), HORIZON.start, HORIZON.end)
  const out: Disagreement[] = []
  for (const attr of ATTRS) {
    for (const valid of valids) {
      for (const system of systems) {
        const want = referenceQuery(log, attr, valid, system)
        const got = strategy.query(state, attr, valid, system)
        if (got !== want) out.push({ attr, valid, system, got, want })
      }
    }
  }
  return out
}

describe('the registry', () => {
  it('holds five strategies with unique keys', () => {
    expect(STRATEGIES).toHaveLength(5)
    expect(new Set(STRATEGIES.map((s) => s.key)).size).toBe(5)
  })

  it('has exactly one deliberately incorrect strategy', () => {
    expect(CORRECT_STRATEGIES).toHaveLength(4)
    expect(INCORRECT_STRATEGIES.map((s) => s.key)).toEqual(['snapshotStale'])
  })

  it('gives every strategy a name and a blurb', () => {
    for (const s of STRATEGIES) {
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.blurb.length).toBeGreaterThan(0)
    }
  })
})

describe('every correct strategy agrees with the oracle', () => {
  for (const strategy of CORRECT_STRATEGIES) {
    it(`${strategy.name}, on the scenario`, () => {
      expect(disagreements(strategy, SCENARIO)).toEqual([])
    })

    it(`${strategy.name}, on 30 generated histories`, () => {
      for (let seed = 100; seed < 130; seed++) {
        const found = disagreements(strategy, generateLog(seed, 14))
        expect(found, `seed ${seed}: ${JSON.stringify(found[0])}`).toEqual([])
      }
    })
  }

  it('and they all agree with each other, which the oracle already implies', () => {
    const states = CORRECT_STRATEGIES.map((s) => ({ s, ...materialize(s, SCENARIO, cfg) }))
    for (const valid of criticalPoints(SCENARIO.map((f) => f.validFrom), HORIZON.start, HORIZON.end)) {
      for (const attr of ATTRS) {
        const answers = states.map(({ s, state }) => s.query(state, attr, valid, HORIZON.end))
        expect(new Set(answers).size).toBe(1)
      }
    }
  })
})

describe('the uninvalidated snapshot strategy', () => {
  const stale = INCORRECT_STRATEGIES[0]!
  const found = disagreements(stale, SCENARIO)

  it('is wrong, and only about salary', () => {
    expect(found.length).toBeGreaterThan(0)
    expect(new Set(found.map((d) => d.attr))).toEqual(new Set(['salary']))
  })

  it('is wrong in exactly one rectangle: April onward, once the raise is recorded', () => {
    const april = day(2026, 4, 1)
    const recorded = day(2026, 6, 10)
    for (const d of found) {
      expect(d.valid).toBeGreaterThanOrEqual(april)
      expect(d.system).toBeGreaterThanOrEqual(recorded)
      expect(d.got).toBe(60_000)
      expect(d.want).toBe(72_000)
    }
  })

  it('is wrong at the corner of that rectangle, so the region is not empty', () => {
    const { state } = materialize(stale, SCENARIO, cfg)
    const at = (v: Day, s: Day) => stale.query(state, 'salary', v, s)
    expect(at(day(2026, 5, 1), day(2026, 6, 10))).toBe(60_000)
    expect(referenceQuery(SCENARIO, 'salary', day(2026, 5, 1), day(2026, 6, 10))).toBe(72_000)
  })

  it('is right everywhere before the raise is recorded', () => {
    const before = day(2026, 6, 9)
    expect(found.every((d) => d.system > before)).toBe(true)
  })
})

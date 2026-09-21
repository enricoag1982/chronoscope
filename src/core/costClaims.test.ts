import { describe, expect, it } from 'vitest'
import { COST_MODELS } from './cost'
import type { CostParams } from './cost'
import { day } from './dates'
import { HORIZON, makeFact } from './log'
import { DEFAULT_CONFIG, materialize } from './strategies/index'
import { STRATEGIES } from './strategies/registry'
import type { Fact } from './types'

/**
 * The cost panel is an analytic model, not a benchmark — but a model that
 * contradicts the code beside it is worse than no model. This file does not
 * check the numbers, which are deliberately abstract; it checks that each
 * measure GROWS the way the implementation grows. That is the claim a reader
 * of the panel actually takes away, and the one that silently rots.
 *
 * It caught a real drift already: the intervals model charged O(d·N) for a
 * retroactive write, borrowed from the usual write-amplification story, while
 * the implementation is O(1) because open-ended facts always land inside a
 * single row and get clipped at the next boundary.
 */

function inOrderLog(n: number): Fact[] {
  const log: Fact[] = []
  for (let i = 0; i < n; i++) {
    const d = day(2026, 1, 1) + i * 5
    log.push(makeFact('salary', 1000 + i, d, d, `b${i}`))
  }
  return log
}

/** Work done by one maximally retroactive fact applied to a log of n facts. */
function observedRetro(key: string, n: number): number {
  const strategy = STRATEGIES.find((s) => s.key === key)!
  const base = inOrderLog(n)
  const { state } = materialize(strategy, base, DEFAULT_CONFIG)
  const clock = day(2026, 1, 1) + n * 5 + 10
  const fact = makeFact('salary', 9, day(2026, 1, 2), clock, 'retro')
  const { ops } = strategy.apply(state, fact, DEFAULT_CONFIG)
  return ops.written + ops.rewritten + ops.invalidated
}

function modelRetro(key: string, n: number): number {
  const p: CostParams = {
    facts: n,
    attrs: 2,
    horizonDays: HORIZON.end - HORIZON.start,
    snapshotInterval: DEFAULT_CONFIG.snapshotInterval,
    retroDepth: 1,
  }
  return COST_MODELS[key]!.retro(p)
}

/** Does this measure grow with the size of the history, or not? */
const grows = (small: number, large: number) => large > small * 2

describe('the model grows the way the code grows', () => {
  for (const strategy of STRATEGIES) {
    it(`${strategy.name}: retroactive write`, () => {
      const observed = grows(observedRetro(strategy.key, 8), observedRetro(strategy.key, 32))
      const modelled = grows(modelRetro(strategy.key, 8), modelRetro(strategy.key, 32))
      expect(
        modelled,
        observed
          ? 'the implementation scales with history here; the model says it does not'
          : 'the model charges for scale the implementation does not pay',
      ).toBe(observed)
    })
  }

  it('and only snapshots actually pays for depth', () => {
    const scaling = STRATEGIES
      .filter((s) => grows(observedRetro(s.key, 8), observedRetro(s.key, 32)))
      .map((s) => s.key)
    expect(scaling).toEqual(['snapshots'])
  })
})

describe('the notation column matches the functions', () => {
  const base: CostParams = {
    facts: 100, attrs: 2, horizonDays: 240, snapshotInterval: 30, retroDepth: 0.5,
  }

  for (const [key, model] of Object.entries(COST_MODELS)) {
    it(`${key}: anything labelled O(1) is actually flat in N`, () => {
      for (const measure of ['storage', 'read', 'append', 'retro'] as const) {
        if (model.notation[measure] !== 'O(1)') continue
        const small = model[measure]({ ...base, facts: 10 })
        const large = model[measure]({ ...base, facts: 10_000 })
        expect(large, `${key}.${measure} is labelled O(1) but moves with N`).toBe(small)
      }
    })
  }
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { day } from '../core/dates'
import { HORIZON, SCENARIO } from '../core/log'
import { DEFAULT_CONFIG, materialize } from '../core/strategies/index'
import { CORRECT_STRATEGIES, STRATEGIES, strategyByKey } from '../core/strategies/registry'
import { renderInternals } from './internals/index'
import { StrategyRow } from './StrategyRow'
import type { Fact } from '../core/types'

const noNaN = (markup: string) => {
  expect(markup).not.toMatch(/NaN/)
  expect(markup).not.toMatch(/Infinity/)
}

const VALID = day(2026, 5, 1)
const SYSTEM = day(2026, 6, 10)

const renderRow = (strategy: (typeof STRATEGIES)[number], log: readonly Fact[]) =>
  renderToStaticMarkup(
    <StrategyRow
      strategy={strategy} log={log} config={DEFAULT_CONFIG}
      validCursor={VALID} systemCursor={SYSTEM} horizon={HORIZON}
    />,
  )

/** Pulls the number OpStat rendered next to a given label, e.g. "invalidated". */
function statFor(markup: string, label: string): number {
  const m = markup.match(new RegExp(`${label}</div><div class="num">([\\d,]+)</div>`))
  if (!m) throw new Error(`no stat rendered for "${label}"`)
  return Number(m[1]!.replace(/,/g, ''))
}

describe('StrategyRow renders every strategy', () => {
  it('on the scenario, without throwing and without NaN or Infinity', () => {
    for (const strategy of STRATEGIES) {
      const markup = renderRow(strategy, SCENARIO)
      noNaN(markup)
    }
  })

  it('on an empty log, without throwing', () => {
    for (const strategy of STRATEGIES) {
      const markup = renderRow(strategy, [])
      noNaN(markup)
    }
  })
})

describe('agreement with the oracle', () => {
  it('the four correct strategies show no disagreement marker at 1 May / 10 June', () => {
    for (const strategy of CORRECT_STRATEGIES) {
      const markup = renderRow(strategy, SCENARIO)
      expect(markup).not.toContain('tag wrong')
    }
  })

  it('snapshotStale disagrees at that coordinate, showing both its answer and the oracle\'s', () => {
    const strategy = strategyByKey('snapshotStale')!
    const markup = renderRow(strategy, SCENARIO)
    expect(markup).toContain('tag wrong')
    expect(markup).toContain('60,000')
    expect(markup).toContain('72,000')
  })
})

describe('IntervalRows', () => {
  it('accumulates closed rows rather than mutating them away', () => {
    const strategy = strategyByKey('intervals')!
    const before = materialize(strategy, SCENARIO.slice(0, -1), DEFAULT_CONFIG).state
    const after = materialize(strategy, SCENARIO, DEFAULT_CONFIG).state

    // Counted as table rows: the renderer draws a bitemporal table with
    // half-open ranges, not bars. What matters either way is that the
    // retroactive fact ADDS rows — a closed row stays queryable at an earlier
    // system time, so nothing may be rewritten in place.
    const props = { horizon: HORIZON, validCursor: VALID, systemCursor: SYSTEM }
    const rows = (state: unknown) => (
      renderToStaticMarkup(<>{renderInternals('intervals', state, props)}</>).match(/<tr/g) ?? []
    ).length

    expect(rows(after)).toBeGreaterThan(rows(before))
  })
})

describe('last-fact ops', () => {
  // The last SCENARIO fact is the backdated raise: it invalidates cached
  // snapshots but costs the event log nothing beyond the append itself.
  it('snapshots shows a non-zero invalidated count', () => {
    const markup = renderRow(strategyByKey('snapshots')!, SCENARIO)
    expect(statFor(markup, 'invalidated')).toBeGreaterThan(0)
  })

  it('events shows a zero invalidated count', () => {
    const markup = renderRow(strategyByKey('events')!, SCENARIO)
    expect(statFor(markup, 'invalidated')).toBe(0)
  })
})

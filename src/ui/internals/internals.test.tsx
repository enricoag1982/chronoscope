import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatDay } from '../../core/dates'
import { HORIZON, SCENARIO } from '../../core/log'
import { DEFAULT_CONFIG, materialize } from '../../core/strategies/index'
import { strategyByKey } from '../../core/strategies/registry'
import { renderInternals } from './index'

const noNaN = (markup: string) => {
  expect(markup).not.toMatch(/NaN/)
  expect(markup).not.toMatch(/Infinity/)
}

describe('IntervalRows', () => {
  const strategy = strategyByKey('intervals')!
  const state = materialize(strategy, SCENARIO, DEFAULT_CONFIG).state
  const markup = renderToStaticMarkup(
    <>{renderInternals('intervals', state, { horizon: HORIZON, validCursor: HORIZON.start, systemCursor: HORIZON.end })}</>,
  )

  it('renders half-open notation, with an open end shown as infinity', () => {
    expect(markup).toContain('[')
    expect(markup).toContain(')')
    expect(markup).toContain('∞')
  })

  it('shares a boundary between adjacent rows for one attribute', () => {
    const rows = [...(state as { rows: { attr: string; validFrom: number; validTo: number }[] }).rows]
      .sort((a, b) => a.attr.localeCompare(b.attr) || a.validFrom - b.validFrom)
    const validTos = rows.map((r) => formatDay(r.validFrom))
    const shared = rows.some((r) => r.validTo !== Infinity && validTos.includes(formatDay(r.validTo)))
    expect(shared).toBe(true)
  })

  it('accumulates closed rows rather than mutating them away after the backdated fact', () => {
    const before = materialize(strategy, SCENARIO.slice(0, -1), DEFAULT_CONFIG).state
    const after = materialize(strategy, SCENARIO, DEFAULT_CONFIG).state
    const p = { horizon: HORIZON, validCursor: HORIZON.start, systemCursor: HORIZON.end }
    const beforeRows = (
      renderToStaticMarkup(<>{renderInternals('intervals', before, p)}</>).match(/<tr/g) ?? []
    ).length
    const afterRows = (
      renderToStaticMarkup(<>{renderInternals('intervals', after, p)}</>).match(/<tr/g) ?? []
    ).length
    expect(afterRows).toBeGreaterThan(beforeRows)
  })

  it('renders on an empty log without throwing', () => {
    const empty = strategy.empty(DEFAULT_CONFIG)
    const m = renderToStaticMarkup(
      <>{renderInternals('intervals', empty, { horizon: HORIZON, validCursor: HORIZON.start, systemCursor: HORIZON.end })}</>,
    )
    noNaN(m)
  })
})

describe('SnapshotStack', () => {
  const strategy = strategyByKey('snapshots')!
  const state = materialize(strategy, SCENARIO, DEFAULT_CONFIG).state
  const p = { horizon: HORIZON, validCursor: HORIZON.start, systemCursor: HORIZON.end }
  const markup = renderToStaticMarkup(<>{renderInternals('snapshots', state, p)}</>)

  it('shows a recorded date per snapshot and never renders an open-ended range dash', () => {
    expect(markup).toContain('recorded')
    expect(markup).not.toMatch(/–\s*(…|<)/) // en dash followed by ellipsis, the old "10 Jun–…" shape
    expect(markup).not.toContain('…')
  })

  it('marks superseded snapshots with the word "superseded"', () => {
    expect(markup).toContain('superseded')
  })

  it('renders on an empty log without throwing', () => {
    const empty = strategy.empty(DEFAULT_CONFIG)
    const m = renderToStaticMarkup(<>{renderInternals('snapshots', empty, p)}</>)
    noNaN(m)
  })
})

describe('snapshotStale still marks stale snapshots', () => {
  it('uses the wrong tag', () => {
    const strategy = strategyByKey('snapshotStale')!
    const state = materialize(strategy, SCENARIO, DEFAULT_CONFIG).state
    const p = { horizon: HORIZON, validCursor: HORIZON.start, systemCursor: HORIZON.end }
    const markup = renderToStaticMarkup(<>{renderInternals('snapshotStale', state, p)}</>)
    expect(markup).toContain('tag wrong')
  })
})

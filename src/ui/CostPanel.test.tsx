import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COST_MODELS } from '../core/cost'
import { STRATEGIES } from '../core/strategies/registry'
import { CostPanel } from './CostPanel'
import { seriesColour } from './palette'

/**
 * Static-render checks, in the pattern of src/ui/render.test.tsx: cheap to
 * run, and they catch the failures that matter most for a panel built from
 * closed-form arithmetic over a parameter sweep — a component that throws,
 * geometry that produces NaN or Infinity, or a claim in the table that has no
 * corresponding line in the charts (or vice versa).
 */
const noNaN = (markup: string) => {
  expect(markup).not.toMatch(/NaN/)
  expect(markup).not.toMatch(/Infinity/)
}

describe('CostPanel renders', () => {
  it('without throwing, with no NaN or Infinity in the markup', () => {
    const markup = renderToStaticMarkup(<CostPanel snapshotInterval={30} />)
    noNaN(markup)
  })

  it('every strategy name appears', () => {
    const markup = renderToStaticMarkup(<CostPanel snapshotInterval={30} />)
    for (const s of STRATEGIES) {
      expect(markup).toContain(s.name)
    }
  })

  it('every notation string from COST_MODELS appears', () => {
    const markup = renderToStaticMarkup(<CostPanel snapshotInterval={30} />)
    for (const model of Object.values(COST_MODELS)) {
      expect(markup).toContain(model.notation.storage)
      expect(markup).toContain(model.notation.read)
      expect(markup).toContain(model.notation.append)
      expect(markup).toContain(model.notation.retro)
    }
  })

  it('every one of the five series hues appears (all five lines drawn)', () => {
    const markup = renderToStaticMarkup(<CostPanel snapshotInterval={30} />)
    for (const s of STRATEGIES) {
      expect(markup).toContain(seriesColour(s.key))
    }
  })

  it('every line carries a direct label: each strategy name appears at least twice', () => {
    const markup = renderToStaticMarkup(<CostPanel snapshotInterval={30} />)
    for (const s of STRATEGIES) {
      const occurrences = markup.split(s.name).length - 1
      expect(occurrences).toBeGreaterThanOrEqual(2)
    }
  })

  it('marks the incorrect strategy as such', () => {
    const markup = renderToStaticMarkup(<CostPanel snapshotInterval={30} />)
    const incorrect = STRATEGIES.filter((s) => !s.correct)
    expect(incorrect.length).toBeGreaterThan(0)
    expect(markup).toContain('incorrect')
    for (const s of incorrect) {
      expect(markup).toContain(s.name)
    }
  })

  it('states that the figures are modelled, not measured', () => {
    const markup = renderToStaticMarkup(<CostPanel snapshotInterval={30} />)
    expect(markup.toLowerCase()).toContain('modelled')
    expect(markup.toLowerCase()).toContain('not measurements')
  })

  it('renders for extreme snapshotInterval values without NaN', () => {
    noNaN(renderToStaticMarkup(<CostPanel snapshotInterval={1} />))
    noNaN(renderToStaticMarkup(<CostPanel snapshotInterval={365} />))
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { day } from '../core/dates'
import { HORIZON, SCENARIO } from '../core/log'
import { divergenceFor, planeFor } from '../core/plane'
import { materialize } from '../core/strategies/index'
import { DEFAULT_CONFIG } from '../core/strategies/index'
import { INCORRECT_STRATEGIES } from '../core/strategies/registry'
import { App } from './App'
import { BitemporalPlane } from './BitemporalPlane'
import { TwinTimelines } from './TwinTimelines'
import { coloursFor } from './palette'

/**
 * A static render will not catch a layout problem, but it does catch the
 * failures that are expensive to find by eye: a component that throws on real
 * data, geometry that produces NaN in an attribute, or a region that silently
 * renders nothing.
 */
const noNaN = (markup: string) => {
  expect(markup).not.toMatch(/NaN/)
  expect(markup).not.toMatch(/Infinity/)
}

describe('the app renders', () => {
  it('without throwing, on the scenario', () => {
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('Chronoscope')
    noNaN(markup)
  })

  it('showing a real answer at the opening coordinates', () => {
    // 1 May valid, clock at 10 June: the backdated raise is recorded by then.
    expect(renderToStaticMarkup(<App />)).toContain('72,000')
  })
})

describe('the timelines render', () => {
  it('one connector and two dots per fact', () => {
    const markup = renderToStaticMarkup(
      <TwinTimelines log={SCENARIO} horizon={HORIZON}
                     validCursor={day(2026, 5, 1)} systemCursor={day(2026, 6, 10)} />,
    )
    expect(markup.match(/<circle/g)).toHaveLength(SCENARIO.length * 2)
    noNaN(markup)
  })

  it('survives an empty log', () => {
    noNaN(renderToStaticMarkup(
      <TwinTimelines log={[]} horizon={HORIZON}
                     validCursor={HORIZON.start} systemCursor={HORIZON.start} />,
    ))
  })
})

describe('the plane renders', () => {
  const stale = INCORRECT_STRATEGIES[0]!
  const { state } = materialize(stale, SCENARIO, DEFAULT_CONFIG)
  const rects = planeFor(SCENARIO, 'salary', HORIZON)
  const divergence = divergenceFor(SCENARIO, 'salary', HORIZON,
    (a, v, s) => stale.query(state, a, v, s))

  const markup = renderToStaticMarkup(
    <BitemporalPlane attr="salary" rects={rects} divergence={divergence} horizon={HORIZON}
      validCursor={day(2026, 5, 1)} systemCursor={day(2026, 6, 10)}
      colours={coloursFor(SCENARIO.filter((f) => f.attr === 'salary').map((f) => f.value))}
      onPick={() => {}} />,
  )

  it('one shape per region, with clean geometry', () => {
    expect(markup.match(/<rect/g)!.length).toBeGreaterThanOrEqual(rects.length)
    noNaN(markup)
  })

  it('labels the values rather than relying on colour alone', () => {
    expect(markup).toContain('72,000')
    expect(markup).toContain('60,000')
  })

  it('draws the wrong region, and it is not empty', () => {
    expect(divergence.length).toBeGreaterThan(0)
    expect(markup).toContain('url(#wrongHatch)')
  })

  it('survives an empty log', () => {
    noNaN(renderToStaticMarkup(
      <BitemporalPlane attr="salary" rects={planeFor([], 'salary', HORIZON)} divergence={[]}
        horizon={HORIZON} validCursor={HORIZON.start} systemCursor={HORIZON.start}
        colours={coloursFor([])} onPick={() => {}} />,
    ))
  })
})

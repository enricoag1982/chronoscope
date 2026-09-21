import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { day } from '../core/dates'
import { HORIZON, SCENARIO } from '../core/log'
import { App } from './App'
import { TwinTimelines } from './TwinTimelines'

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

  it('showing both attributes at the opening coordinates, not one', () => {
    // 1 May valid, clock at 10 June: the backdated raise is recorded by then.
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('72,000')
    expect(markup).toContain('Rob')
  })

  it('with the cursors driven by the axes, not by a duplicate pair of sliders', () => {
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('valid time')
    expect(markup).toContain('system time')
    // The axes carry drag zones...
    expect(markup).toContain('ew-resize')
    // ...and no slider anywhere sets either cursor. The sandbox's own range
    // inputs set a fact's valid time and the snapshot interval, which are
    // different quantities; what must not come back is a second control for
    // the two numbers the axes already own.
    expect(markup).not.toMatch(/<input[^>]*aria-label="(valid|system) cursor"/)
    expect(markup).not.toMatch(/<input[^>]*aria-label="system time"/)
  })

  it('showing all five representations and the scale band', () => {
    const markup = renderToStaticMarkup(<App />)
    for (const s of ['Deltas', 'Intervals', 'Snapshots', 'Hybrid']) {
      expect(markup).toContain(s)
    }
    expect(markup).toContain('Representations')
    expect(markup).toContain('Scale')
  })

  it('and stating that the scale figures are modelled rather than measured', () => {
    expect(renderToStaticMarkup(<App />)).toContain('not measurements')
  })
})

describe('the timelines render', () => {
  it('one connector and two dots per fact', () => {
    const markup = renderToStaticMarkup(
      <TwinTimelines log={SCENARIO} horizon={HORIZON} clock={day(2026, 6, 10)}
                     validCursor={day(2026, 5, 1)} systemCursor={day(2026, 6, 10)}
                     onValid={() => {}} onSystem={() => {}} />,
    )
    expect(markup.match(/<circle/g)).toHaveLength(SCENARIO.length * 2)
    noNaN(markup)
  })

  it('survives an empty log', () => {
    noNaN(renderToStaticMarkup(
      <TwinTimelines log={[]} horizon={HORIZON} clock={HORIZON.start}
                     validCursor={HORIZON.start} systemCursor={HORIZON.start}
                     onValid={() => {}} onSystem={() => {}} />,
    ))
  })
})

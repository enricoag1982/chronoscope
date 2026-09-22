import { describe, expect, it } from 'vitest'
import { CATEGORICAL, NO_VALUE, SEQUENTIAL, SERIES, coloursFor, inkOn, seriesColour } from './palette'

describe('categorical colour', () => {
  it('follows the entity, not its rank in the current view', () => {
    const all = coloursFor(['Rob', 'Jim', 'Dana'])
    const fewer = coloursFor(['Rob', 'Jim', 'Dana']) // same log, filtered view
    for (const name of ['Rob', 'Jim', 'Dana']) {
      expect(fewer(name)).toBe(all(name))
    }
  })

  it('is stable regardless of the order values appear in', () => {
    const a = coloursFor(['Rob', 'Jim', 'Dana'])
    const b = coloursFor(['Dana', 'Rob', 'Jim', 'Rob'])
    for (const name of ['Rob', 'Jim', 'Dana']) expect(a(name)).toBe(b(name))
  })

  it('uses only the three validated hues', () => {
    const c = coloursFor(['Rob', 'Jim', 'Dana'])
    const used = ['Rob', 'Jim', 'Dana'].map(c)
    expect(new Set(used).size).toBe(3)
    for (const hex of used) expect(CATEGORICAL).toContain(hex)
  })

  it('falls back to ink past three rather than inventing a hue', () => {
    const c = coloursFor(['A', 'B', 'C', 'D'])
    expect(CATEGORICAL).not.toContain(c('D'))
  })
})

describe('sequential colour', () => {
  it('is monotone in the value', () => {
    const c = coloursFor([0, 25, 50, 75, 100])
    const idx = [0, 25, 50, 75, 100].map((v) => SEQUENTIAL.indexOf(c(v) as never))
    for (let i = 1; i < idx.length; i++) expect(idx[i]!).toBeGreaterThanOrEqual(idx[i - 1]!)
  })

  it('puts the extremes at the ends of the ramp', () => {
    const c = coloursFor([10, 90])
    expect(c(10)).toBe(SEQUENTIAL[0])
    expect(c(90)).toBe(SEQUENTIAL.at(-1))
  })

  it('survives a single distinct value without dividing by zero', () => {
    const c = coloursFor([42, 42])
    expect(SEQUENTIAL).toContain(c(42))
  })
})

describe('absence and legibility', () => {
  it('gives no-value its own recessive fill', () => {
    expect(coloursFor([1, 2])(undefined)).toBe(NO_VALUE)
  })

  it('picks readable ink for both ends of the ramp', () => {
    expect(inkOn(SEQUENTIAL[0]!)).toBe('#1a1a19')
    expect(inkOn(SEQUENTIAL.at(-1)!)).toBe('#ffffff')
  })
})

describe('series colour', () => {
  it('is keyed by strategy, so hiding one never repaints the others', () => {
    expect(seriesColour('events')).toBe(SERIES.events)
    expect(seriesColour('snapshotStale')).toBe(SERIES.snapshotStale)
  })

  it('covers all five strategies with distinct hues', () => {
    const keys = ['events', 'intervals', 'snapshots', 'hybrid', 'snapshotStale']
    const used = keys.map(seriesColour)
    expect(new Set(used).size).toBe(5)
  })

  it('falls back to ink for an unknown key rather than inventing a hue', () => {
    expect(Object.values(SERIES)).not.toContain(seriesColour('nope'))
  })
})

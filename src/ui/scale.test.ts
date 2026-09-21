import { describe, expect, it } from 'vitest'
import { day, formatDay } from '../core/dates'
import { HORIZON } from '../core/log'
import { invert, linear, monthTicks } from './scale'

describe('linear scale', () => {
  const s = linear([0, 100], [0, 500])

  it('maps the domain onto the range', () => {
    expect(s(0)).toBe(0)
    expect(s(100)).toBe(500)
    expect(s(50)).toBe(250)
  })

  it('round-trips through invert', () => {
    const back = invert([0, 100], [0, 500])
    for (const d of [0, 17, 50, 83, 100]) expect(back(s(d))).toBe(d)
  })

  it('survives a degenerate domain instead of dividing by zero', () => {
    expect(Number.isFinite(linear([5, 5], [0, 100])(5))).toBe(true)
  })
})

describe('month ticks', () => {
  it('lands on the first of each month inside the window', () => {
    const ticks = monthTicks(HORIZON.start, HORIZON.end)
    expect(ticks.map(formatDay)).toEqual([
      '1 Jan', '1 Feb', '1 Mar', '1 Apr', '1 May', '1 Jun', '1 Jul', '1 Aug', '1 Sep',
    ])
  })

  it('skips a partial leading month', () => {
    const ticks = monthTicks(day(2026, 1, 15), day(2026, 3, 20))
    expect(ticks.map(formatDay)).toEqual(['1 Feb', '1 Mar'])
  })

  it('returns nothing when no boundary falls inside', () => {
    expect(monthTicks(day(2026, 1, 5), day(2026, 1, 20))).toEqual([])
  })
})

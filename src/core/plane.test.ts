import { describe, expect, it } from 'vitest'
import { day } from './dates'
import { criticalPoints, generateLog } from './gen'
import { HORIZON, SCENARIO } from './log'
import { divergenceFor, planeFor, rectAt } from './plane'
import type { Horizon, Rect } from './plane'
import { referenceQuery } from './reference'
import { ATTRS } from './types'
import type { Attr, Day, Fact } from './types'

/** Every rect's own bounds must be well formed, whichever function produced it. */
function assertWellFormed(rects: readonly Rect[]): void {
  for (const r of rects) {
    expect(r.validFrom).toBeLessThan(r.validTo)
    expect(r.systemFrom).toBeLessThan(r.systemTo)
  }
}

/**
 * The naive alternative this whole module exists to avoid: a day-by-day cell
 * for every (valid, system) pair in the horizon, per the brief's own ~58,000
 * figure. That's the baseline `planeFor`'s rect count must dwarf.
 */
function dayGridCellCount(horizon: Horizon): number {
  const span = horizon.end - horizon.start
  return span * span
}

/** Probe coordinates that exercise every distinct region, one horizon short of the exclusive edge. */
function probesFor(log: readonly Fact[], horizon: Horizon): { valids: Day[]; systems: Day[] } {
  const valids = criticalPoints(log.map((f) => f.validFrom), horizon.start, horizon.end - 1)
  const systems = criticalPoints(log.map((f) => f.systemTime), horizon.start, horizon.end - 1)
  return { valids, systems }
}

function checkTiling(log: readonly Fact[], attr: Attr, horizon: Horizon): void {
  const rects = planeFor(log, attr, horizon)
  assertWellFormed(rects)
  const { valids, systems } = probesFor(log, horizon)
  for (const v of valids) {
    for (const s of systems) {
      const hits = rects.filter(
        (r) => r.validFrom <= v && v < r.validTo && r.systemFrom <= s && s < r.systemTo,
      )
      expect(hits, `attr=${attr} valid=${v} system=${s}`).toHaveLength(1)
      expect(hits[0]!.value).toBe(referenceQuery(log, attr, v, s))
      expect(rectAt(rects, v, s)).toBe(hits[0])
    }
  }
}

describe('planeFor tiles the horizon exactly', () => {
  it('over the scenario', () => {
    for (const attr of ATTRS) checkTiling(SCENARIO, attr, HORIZON)
  })

  for (let seed = 0; seed < 20; seed++) {
    it(`over generated log, seed ${seed}`, () => {
      const log = generateLog(seed, 12)
      for (const attr of ATTRS) checkTiling(log, attr, HORIZON)
    })
  }
})

describe('planeFor merges', () => {
  it('yields far fewer rects than the unmerged day-grid, for the scenario', () => {
    const dayGrid = dayGridCellCount(HORIZON)
    expect(dayGrid).toBeGreaterThan(50_000) // matches the brief's ~58,000
    for (const attr of ATTRS) {
      const rects = planeFor(SCENARIO, attr, HORIZON)
      expect(rects.length).toBeLessThan(20) // a handful of rectangles, not a grid
      expect(rects.length).toBeLessThan(dayGrid / 1000)
    }
  })

  it('leaves no two horizontally adjacent same-band rects with equal value (maximal merge along x)', () => {
    for (const attr of ATTRS) {
      const rects = planeFor(SCENARIO, attr, HORIZON)
      const bands = new Map<string, Rect[]>()
      for (const r of rects) {
        const key = `${r.systemFrom}-${r.systemTo}`
        const list = bands.get(key) ?? []
        list.push(r)
        bands.set(key, list)
      }
      for (const list of bands.values()) {
        list.sort((a, b) => a.validFrom - b.validFrom)
        for (let i = 0; i + 1 < list.length; i++) {
          const a = list[i]!
          const b = list[i + 1]!
          if (a.validTo === b.validFrom) {
            expect(a.value).not.toBe(b.value)
          }
        }
      }
    }
  })
})

describe('planeFor on an empty log', () => {
  it('yields exactly one rect covering the whole horizon with value undefined', () => {
    for (const attr of ATTRS) {
      const rects = planeFor([], attr, HORIZON)
      expect(rects).toEqual([
        { validFrom: HORIZON.start, validTo: HORIZON.end, systemFrom: HORIZON.start, systemTo: HORIZON.end, value: undefined },
      ])
    }
  })
})

describe('divergenceFor', () => {
  it('is empty when the callback is the oracle', () => {
    for (const attr of ATTRS) {
      const rects = divergenceFor(SCENARIO, attr, HORIZON, (a, v, s) => referenceQuery(SCENARIO, a, v, s))
      expect(rects).toEqual([])
    }
    for (let seed = 0; seed < 5; seed++) {
      const log = generateLog(seed, 12)
      for (const attr of ATTRS) {
        const rects = divergenceFor(log, attr, HORIZON, (a, v, s) => referenceQuery(log, a, v, s))
        expect(rects).toEqual([])
      }
    }
  })

  it('finds exactly the region where a deliberately wrong callback disagrees with the oracle', () => {
    // Constant 60,000 matches the oracle where the original hire salary still
    // holds, and disagrees both before the hire and after the backdated raise.
    const wrong = () => 60_000
    const rects = divergenceFor(SCENARIO, 'salary', HORIZON, wrong)
    assertWellFormed(rects)
    for (const r of rects) expect(r.value).toBe(60_000)

    const { valids, systems } = probesFor(SCENARIO, HORIZON)
    for (const v of valids) {
      for (const s of systems) {
        const oracle = referenceQuery(SCENARIO, 'salary', v, s)
        const found = rectAt(rects, v, s)
        if (oracle !== 60_000) {
          expect(found, `expected a divergence rect at valid=${v} system=${s}`).toBeDefined()
          expect(found!.value).toBe(60_000)
        } else {
          expect(found, `expected no divergence rect at valid=${v} system=${s}`).toBeUndefined()
        }
      }
    }
  })

  it('finds a divergence that starts mid-horizon, from a small crafted log', () => {
    const log: Fact[] = [
      { id: 'a', attr: 'manager', value: 'Jim', validFrom: day(2026, 1, 1), systemTime: day(2026, 1, 1) },
      { id: 'b', attr: 'manager', value: 'Rob', validFrom: day(2026, 5, 1), systemTime: day(2026, 5, 1) },
    ]
    const wrong = () => 'Jim'
    const rects = divergenceFor(log, 'manager', HORIZON, wrong)
    for (const r of rects) {
      expect(r.value).toBe('Jim')
      // Wrong everywhere the oracle has moved on to Rob, i.e. valid >= 1 May.
      expect(r.validFrom).toBeGreaterThanOrEqual(day(2026, 5, 1))
    }
    // And nowhere before that boundary.
    const before = rectAt(rects, day(2026, 4, 1), day(2026, 6, 1))
    expect(before).toBeUndefined()
    const after = rectAt(rects, day(2026, 5, 1), day(2026, 6, 1))
    expect(after).toBeDefined()
    expect(after!.value).toBe('Jim')
  })
})

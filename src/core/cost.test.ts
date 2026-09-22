import { describe, expect, it } from 'vitest'
import { COST_MODELS, costCurve } from './cost'
import type { CostModel, CostParams } from './cost'

/**
 * These tests check the CLAIMS the scale panel makes about the five
 * representations, not the arithmetic inside cost.ts. If a formula changes
 * but the underlying architectural story stays true, these should still
 * pass; if the story stops being true, these should fail even if the new
 * arithmetic is internally consistent.
 */

const BASE: CostParams = {
  facts: 1_000,
  attrs: 2,
  snapshotInterval: 30,
  retroDepth: 0.4,
}

const models = COST_MODELS as Record<
  'events' | 'intervals' | 'snapshots' | 'snapshotStale' | 'hybrid',
  CostModel
>

describe('events read grows with history, direct-lookup reads do not', () => {
  const small = { ...BASE, facts: 100 }
  const large = { ...BASE, facts: 100_000 }

  it('events read scales up with N', () => {
    expect(models.events.read(large)).toBeGreaterThan(models.events.read(small) * 100)
  })

  it('intervals read does not grow with N', () => {
    expect(models.intervals.read(large)).toBe(models.intervals.read(small))
  })

  it('snapshots read does not grow with N', () => {
    expect(models.snapshots.read(large)).toBe(models.snapshots.read(small))
  })
})

describe('snapshots duplicate state relative to events, and the gap widens', () => {
  it('snapshots storage exceeds events storage', () => {
    expect(models.snapshots.storage(BASE)).toBeGreaterThan(models.events.storage(BASE))
  })

  it('the storage gap widens as N grows', () => {
    const gapAt = (facts: number) => {
      const p = { ...BASE, facts }
      return models.snapshots.storage(p) - models.events.storage(p)
    }
    const gapSmall = gapAt(100)
    const gapLarge = gapAt(100_000)
    expect(gapSmall).toBeGreaterThan(0)
    expect(gapLarge).toBeGreaterThan(gapSmall)
  })
})

describe('hybrid: snapshot interval trades storage against read cost', () => {
  it('storage falls and read rises as the grid widens — the tradeoff is visible', () => {
    const tight = { ...BASE, snapshotInterval: 1 }
    const wide = { ...BASE, snapshotInterval: 200 }

    const storageTight = models.hybrid.storage(tight)
    const storageWide = models.hybrid.storage(wide)
    const readTight = models.hybrid.read(tight)
    const readWide = models.hybrid.read(wide)

    expect(storageWide).toBeLessThan(storageTight)
    expect(readWide).toBeGreaterThan(readTight)
  })

  it('the two measures move in opposite directions across the whole sweep', () => {
    const intervals = [1, 5, 10, 30, 90, 200, 365]
    const storages = intervals.map((snapshotInterval) =>
      models.hybrid.storage({ ...BASE, snapshotInterval }),
    )
    const reads = intervals.map((snapshotInterval) => models.hybrid.read({ ...BASE, snapshotInterval }))

    for (let i = 1; i < intervals.length; i++) {
      expect(storages[i]).toBeLessThanOrEqual(storages[i - 1]!)
      expect(reads[i]).toBeGreaterThanOrEqual(reads[i - 1]!)
    }
    // and not merely flat — the tradeoff has to actually move.
    expect(storages.at(-1)).toBeLessThan(storages[0]!)
    expect(reads.at(-1)).toBeGreaterThan(reads[0]!)
  })

  it('grid size (storage beyond the raw log) scales with N, the fact count — not a fixed horizon', () => {
    // storage() = facts + gridPoints * attrs, so subtracting the raw log back
    // out isolates the grid term. With a calendar-day grid this term would be
    // flat (pinned to horizonDays / k, independent of history size) — that
    // was the bug the rewrite fixes. With an event grid it must instead grow
    // roughly linearly in facts, for a fixed snapshotInterval.
    const gridTerm = (facts: number) => models.hybrid.storage({ ...BASE, facts }) - facts

    const small = gridTerm(1_000)
    const large = gridTerm(100_000)
    expect(large).toBeGreaterThan(small * 50)
  })
})

describe('retroactive depth: snapshots pays for it, intervals and events do not', () => {
  it('snapshots retro cost rises with retroDepth', () => {
    const shallow = models.snapshots.retro({ ...BASE, retroDepth: 0 })
    const deep = models.snapshots.retro({ ...BASE, retroDepth: 1 })
    expect(deep).toBeGreaterThan(shallow)
  })

  it('intervals retro cost is flat, because facts here are open-ended', () => {
    // Not the write amplification interval tables are usually accused of. A
    // fact carries a validFrom and no validTo, so it always lands inside
    // exactly one open row and is clipped at the next boundary: one row
    // closed, at most two reopened, however far back it reaches. Amplification
    // needs facts carrying an explicit valid range, which this model does not
    // have. costClaims.test.ts holds the model to the implementation on this.
    const shallow = models.intervals.retro({ ...BASE, retroDepth: 0 })
    const deep = models.intervals.retro({ ...BASE, retroDepth: 1 })
    expect(deep).toBe(shallow)
  })

  it('events retro cost is flat regardless of retroDepth', () => {
    const shallow = models.events.retro({ ...BASE, retroDepth: 0 })
    const deep = models.events.retro({ ...BASE, retroDepth: 1 })
    expect(deep).toBe(shallow)
  })
})

describe('the tempting bug: snapshotStale writes cheaper than correct snapshots', () => {
  it('append is strictly cheaper for snapshotStale than for snapshots', () => {
    expect(models.snapshotStale.append(BASE)).toBeLessThan(models.snapshots.append(BASE))
  })

  it('holds across a range of attribute counts, not just the default', () => {
    for (const attrs of [1, 2, 5, 20]) {
      const p = { ...BASE, attrs }
      expect(models.snapshotStale.append(p)).toBeLessThan(models.snapshots.append(p))
    }
  })
})

describe('every model stays finite and non-negative across a wide parameter sweep', () => {
  const factsValues = [0, 1, 50, 10_000]
  const attrsValues = [1, 2, 8]
  const retroDepthValues = [0, 0.3, 1]
  // snapshotInterval edge cases called out explicitly: 1, and equal to (or
  // exceeding) the fact count, which drives the event grid empty.
  const snapshotIntervalOf = (facts: number) => [1, Math.max(facts, 1), 500]

  const measureNames = ['storage', 'read', 'append', 'retro'] as const

  for (const [key, model] of Object.entries(models)) {
    it(`${key}: finite, non-negative for every combination in the sweep`, () => {
      for (const facts of factsValues) {
        for (const attrs of attrsValues) {
          for (const snapshotInterval of snapshotIntervalOf(facts)) {
            for (const retroDepth of retroDepthValues) {
              const p: CostParams = { facts, attrs, snapshotInterval, retroDepth }
              for (const measure of measureNames) {
                const value = model[measure](p)
                expect(Number.isFinite(value), `${key}.${measure}(${JSON.stringify(p)})`).toBe(
                  true,
                )
                expect(value, `${key}.${measure}(${JSON.stringify(p)})`).toBeGreaterThanOrEqual(
                  0,
                )
              }
            }
          }
        }
      }
    })
  }
})

describe('notation labels exist for every measure of every model', () => {
  const measureNames = ['storage', 'read', 'append', 'retro'] as const

  for (const [key, model] of Object.entries(models)) {
    it(`${key} has non-empty notation for all four measures`, () => {
      for (const measure of measureNames) {
        const label = model.notation[measure]
        expect(typeof label).toBe('string')
        expect(label.length).toBeGreaterThan(0)
      }
    })
  }
})

describe('costCurve', () => {
  it('samples the given measure over the given range, holding the rest of the params fixed', () => {
    const range = [0, 10, 100, 1_000]
    const points = costCurve(models.events.storage, BASE, range)

    expect(points).toHaveLength(range.length)
    points.forEach((point, i) => {
      expect(point.x).toBe(range[i])
      expect(point.y).toBe(models.events.storage({ ...BASE, facts: range[i]! }))
    })
  })
})

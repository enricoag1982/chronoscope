import { HORIZON, makeFact } from './log'
import { ATTRS } from './types'
import type { Day, Fact } from './types'

/** Seeded, so a failing fuzz case is reproducible from its seed alone. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MANAGERS = ['Jim', 'Rob', 'Dana', 'Erin', 'Sam']

/**
 * A random but legal history: valid times scattered freely across the horizon,
 * system time advancing monotonically. Deliberately generates same-day
 * recordings, corrections at an existing valid time, retroactive inserts and
 * facts valid in the future — the cases a fixed scenario cannot cover.
 */
export function generateLog(seed: number, count: number): Fact[] {
  const r = rng(seed)
  const span = HORIZON.end - HORIZON.start
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!

  let clock: Day = HORIZON.start
  const log: Fact[] = []
  for (let i = 0; i < count; i++) {
    clock += Math.floor(r() * 21) // 0 allows several recordings on one day
    const attr = pick(ATTRS)
    const value = attr === 'salary'
      ? 40_000 + Math.floor(r() * 12) * 5_000
      : pick(MANAGERS)
    const validFrom = HORIZON.start + Math.floor(r() * span)
    log.push(makeFact(attr, value, validFrom, clock, `g${seed}-${i}`))
  }
  return log
}

/**
 * The value surface is piecewise constant, breaking only at recorded
 * coordinates. Sweeping these points and their immediate neighbours is
 * therefore exhaustive, not a sample — every distinct region is visited.
 */
export function criticalPoints(values: readonly Day[], lo: Day, hi: Day): Day[] {
  const set = new Set<Day>([lo, hi])
  for (const v of values) {
    for (const d of [v - 1, v, v + 1]) {
      if (d >= lo && d <= hi) set.add(d)
    }
  }
  return [...set].sort((a, b) => a - b)
}

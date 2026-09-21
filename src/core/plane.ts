import { referenceQuery } from './reference'
import type { Attr, Day, Fact, Value } from './types'

/**
 * The window either axis of the plane covers. Structurally the same shape as
 * `HORIZON` in log.ts, but plane.ts stays independent of that module's other
 * exports (SCENARIO, append, ...) since it only needs the window itself.
 */
export type Horizon = { start: Day; end: Day }

/** An axis-aligned tile of the bitemporal plane. Both bounds are exclusive on top. */
export type Rect = {
  validFrom: Day
  validTo: Day
  systemFrom: Day
  systemTo: Day
  value: Value | undefined
}

/**
 * Marks a grid cell that divergenceFor should drop rather than emit as a rect.
 * Distinct from `undefined`, which is itself a legitimate cell value (no fact
 * recorded yet) that planeFor must be able to carry.
 */
const SKIP = Symbol('skip')
type CellValue = Value | undefined | typeof SKIP

/**
 * Breakpoints for one axis: the horizon's own edges, plus every distinct time
 * strictly inside the horizon at which the surface can change. The surface is
 * piecewise constant between breakpoints, so evaluating at each breakpoint and
 * holding that value to the next one is exact, not an approximation.
 */
function breakpoints(horizon: Horizon, times: readonly Day[]): Day[] {
  const set = new Set<Day>([horizon.start, horizon.end])
  for (const t of times) {
    if (t > horizon.start && t < horizon.end) set.add(t)
  }
  return [...set].sort((a, b) => a - b)
}

type Run = { validFrom: Day; validTo: Day; value: Value | undefined }

function runsEqual(a: readonly Run[], b: readonly Run[]): boolean {
  if (a.length !== b.length) return false
  for (let k = 0; k < a.length; k++) {
    const ra = a[k]!
    const rb = b[k]!
    if (ra.validFrom !== rb.validFrom || ra.validTo !== rb.validTo || ra.value !== rb.value) return false
  }
  return true
}

/**
 * Evaluate a cell grid and merge it into rectangles: first along the valid
 * axis (consecutive cells in a row that carry the same value collapse into
 * one run), then along the system axis (consecutive rows whose run partition
 * is identical — same breakpoints, same values — collapse into one band).
 * `valueAt` returning SKIP drops that cell entirely, which is how
 * divergenceFor keeps only the disagreeing region: a skipped cell breaks a
 * run just like a differing value would.
 */
function buildRects(
  validBreaks: readonly Day[],
  systemBreaks: readonly Day[],
  valueAt: (vi: number, si: number) => CellValue,
): Rect[] {
  const rows: Run[][] = []
  for (let j = 0; j < systemBreaks.length - 1; j++) {
    const runs: Run[] = []
    for (let i = 0; i < validBreaks.length - 1; i++) {
      const v = valueAt(i, j)
      if (v === SKIP) continue
      const validFrom = validBreaks[i]!
      const validTo = validBreaks[i + 1]!
      const last = runs.at(-1)
      if (last !== undefined && last.value === v && last.validTo === validFrom) {
        last.validTo = validTo
      } else {
        runs.push({ validFrom, validTo, value: v })
      }
    }
    rows.push(runs)
  }

  const result: Rect[] = []
  let i = 0
  while (i < rows.length) {
    const runs = rows[i]!
    let j = i + 1
    while (j < rows.length && runsEqual(rows[j]!, runs)) j++
    const systemFrom = systemBreaks[i]!
    const systemTo = systemBreaks[j]!
    for (const run of runs) {
      result.push({ validFrom: run.validFrom, validTo: run.validTo, systemFrom, systemTo, value: run.value })
    }
    i = j
  }
  return result
}

/**
 * The full value surface for one attribute over the horizon, as a modest set
 * of rectangles rather than a day-by-day grid. Breakpoints are taken only
 * from facts on this attribute: a fact on another attribute cannot move this
 * surface, so including its coordinates would only add cells that the merge
 * step immediately collapses back out.
 */
export function planeFor(log: readonly Fact[], attr: Attr, horizon: Horizon): Rect[] {
  const own = log.filter((f) => f.attr === attr)
  const validBreaks = breakpoints(horizon, own.map((f) => f.validFrom))
  const systemBreaks = breakpoints(horizon, own.map((f) => f.systemTime))
  return buildRects(validBreaks, systemBreaks, (i, j) =>
    referenceQuery(log, attr, validBreaks[i]!, systemBreaks[j]!))
}

/**
 * Where a strategy's answer departs from the oracle, as the same kind of
 * rectangles. `query` stands in for `strategy.query` bound to its state, kept
 * as a plain callback so this module never has to import a strategy. Each
 * rect's value is what the strategy wrongly returned there, for a renderer to
 * label; cells where it agrees are dropped, not merged in as "correct" tiles.
 */
export function divergenceFor(
  log: readonly Fact[],
  attr: Attr,
  horizon: Horizon,
  query: (attr: Attr, valid: Day, system: Day) => Value | undefined,
): Rect[] {
  // Breakpoints come from the WHOLE log here, not just this attribute — the
  // asymmetry with planeFor is the point. The oracle for one attribute cannot
  // move at another attribute's coordinates, but a strategy can: snapshots are
  // whole-entity records, so a stale snapshot taken at a manager change is
  // exactly where a salary answer starts being wrong. Filtering per attribute
  // here makes the strategy's error invisible precisely when it is most
  // interesting.
  const validBreaks = breakpoints(horizon, log.map((f) => f.validFrom))
  const systemBreaks = breakpoints(horizon, log.map((f) => f.systemTime))
  return buildRects(validBreaks, systemBreaks, (i, j) => {
    const valid = validBreaks[i]!
    const system = systemBreaks[j]!
    const oracle = referenceQuery(log, attr, valid, system)
    const actual = query(attr, valid, system)
    return actual === oracle ? SKIP : actual
  })
}

/** The rect covering a coordinate, or undefined if it falls outside every rect (e.g. outside the horizon). */
export function rectAt(rects: readonly Rect[], valid: Day, system: Day): Rect | undefined {
  return rects.find(
    (r) => r.validFrom <= valid && valid < r.validTo && r.systemFrom <= system && system < r.systemTo,
  )
}

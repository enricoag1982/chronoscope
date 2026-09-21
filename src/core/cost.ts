/**
 * Analytic cost model for the five representations.
 *
 * This is a MODEL, not a benchmark: every number below is a closed-form
 * function of the stated mechanics in strategies/*.ts, not a measurement.
 * Nothing here runs a strategy, generates data, or times anything. Where the
 * mechanics genuinely underdetermine a coefficient (e.g. "roughly how many
 * distinct valid-time points does N facts produce?"), the coefficient is a
 * named constant with a comment giving the reasoning, so it can be argued
 * with rather than taken on faith.
 *
 * Throughout, "records" means the unit each strategy actually stores:
 * one fact for deltas, one bitemporal row for intervals, one attribute-value
 * for snapshots (a full-entity snapshot is `attrs` records, which is the
 * point being modelled — see storage() below).
 */

export type CostParams = {
  /** N — total facts recorded so far. The axis every "as history grows" claim runs over. */
  facts: number
  /** A — attributes tracked per entity (ATTRS.length in this app, generalised here). */
  attrs: number
  /** H — length of the modelled horizon, in days. Only the day-grid strategies (hybrid) need a calendar. */
  horizonDays: number
  /** k — hybrid's snapshot grid spacing, in days. */
  snapshotInterval: number
  /** d — how far back a retroactive fact reaches, as a fraction of history already recorded. 0 = touches nothing behind it, 1 = reaches all the way to the start. */
  retroDepth: number
}

export type CostModel = {
  key: string
  /** Records currently stored, after `facts` facts have been applied. */
  storage(p: CostParams): number
  /** Records touched to answer one point query (one attr, one valid time, one system time). */
  read(p: CostParams): number
  /** Records written by the next fact, given it arrives in order (validFrom after everything known). */
  append(p: CostParams): number
  /** Records written or invalidated by the next fact, given it is retroactive at depth `retroDepth`. */
  retro(p: CostParams): number
  /** Big-O labels for the table. Same four measures, in the same order. */
  notation: { storage: string; read: string; append: string; retro: string }
}

// Defensive floor for values used as divisors. Callers are expected to pass
// horizonDays >= 1 and snapshotInterval >= 1 (a zero-length horizon or a
// zero-day grid is not a representable configuration), but the cost
// functions themselves must stay finite under a blind parameter sweep, so
// every division goes through this rather than trusting the caller.
const atLeast1 = (n: number): number => Math.max(n, 1)

// --- deltas ---------------------------------------------------------------
//
// storage: exactly the facts, one record each — nothing is derived or duplicated.
// read: query() has no index to consult, so it walks every fact in the log
//   (see deltas.ts: readCost is state.facts.length, not filtered by attr).
// append: one fact in, one record out.
// retro: a retroactive fact is still just one fact — appending it costs the
//   same as appending any other. The cost of "being retroactive" for deltas
//   is paid by every read from then on (already captured by read growing
//   with N), never by the write itself. That asymmetry is the whole pitch
//   of the strategy, so retro() deliberately does NOT depend on retroDepth.
const deltasModel: CostModel = {
  key: 'deltas',
  storage: (p) => p.facts,
  read: (p) => p.facts,
  append: () => 1,
  retro: () => 1,
  notation: { storage: 'O(N)', read: 'O(N)', append: 'O(1)', retro: 'O(1)' },
}

// --- intervals --------------------------------------------------------------
//
// The mechanics (intervals.ts apply()): a new fact for an attribute finds the
// currently open row for that attribute and clips against it — even an
// in-order append closes that row (system-time bound) and reopens the
// surviving remainder, because the old row's validTo was INF and now has to
// be bounded at the new fact's validFrom. So the "rewrite on write" cost is
// not special to retroactive facts, it happens on every apply(); retroactive
// facts just have more rows in their way.
//
// INTERVAL_ROWS_PER_FACT: tracing apply() for a steady stream of in-order
// facts on one attribute — each fact replaces the one open row with a closed
// copy + a reopened remainder (net +1 for that row) and adds its own new row
// (+1) — settles at 2 stored rows per fact. This is a judgement call in the
// sense that it assumes one attribute has at most one open row at a time
// (true as long as retroactive facts are clipped to the next known
// validFrom, which is exactly what apply() does — see the comment in
// intervals.ts about not swallowing later changes).
const INTERVAL_ROWS_PER_FACT = 2

// INTERVALS_APPEND_OPS: the per-append row-touch count straight off the same
// trace — 1 rewritten (close the old open row) + 2 written (its reopened
// remainder, plus the new fact's own row) = 3. Independent of N: only the
// one currently-open row for this attribute is ever touched by an in-order
// append, which is why intervals' write path is O(1) despite being a
// rewriting strategy.
const INTERVALS_APPEND_OPS = 3

// A retroactive fact is not clipped only against the single row it lands in
// forwards — per the panel's own framing (PLAN.md: "the interval table
// splits a rectangle and rewrites everything downstream of it"), reaching
// depth d into H means every row whose validity starts at or after that
// point is closed and reopened against the new fact. Modelled as: touch a
// `retroDepth` fraction of the rows currently stored, at the same 2-ops-per-
// row rate the append trace established (1 close + 1 reopen), plus the O(1)
// cost of writing the correction's own row.
const intervalsModel: CostModel = {
  key: 'intervals',
  storage: (p) => p.facts * INTERVAL_ROWS_PER_FACT,
  // Indexed lookup: find the rectangle containing (attr, valid, system).
  // Independent of N and of attrs — a matching row carries one value.
  read: () => 1,
  append: () => INTERVALS_APPEND_OPS,
  // Constant, and NOT the O(d·N) write amplification interval tables are
  // usually accused of. The reason is worth stating, because it is the most
  // counter-intuitive number on this panel.
  //
  // A fact here carries a validFrom and no validTo: it is open-ended, holding
  // until the next fact supersedes it. Open rows therefore tile valid time
  // with boundaries exactly at recorded valid times, so a new fact always
  // lands inside precisely ONE open row, and intervals.ts clips it at the
  // next boundary. One row closed, at most two reopened — however far back
  // the fact reaches.
  //
  // Amplification is real, but it belongs to a model this one does not have:
  // facts carrying an explicit valid RANGE. "Salary was wrong for all of Q1"
  // spans every row in that quarter and rewrites each. Charging that cost
  // here would be modelling a different implementation than the one shipped,
  // which costClaims.test.ts exists to prevent.
  retro: () => INTERVALS_APPEND_OPS,
  notation: { storage: 'O(N)', read: 'O(1)', append: 'O(1)', retro: 'O(1)' },
}

// --- snapshots --------------------------------------------------------------
//
// "One full entity snapshot per distinct valid time, stored bitemporally."
// Two judgement calls carry this model:
//
// SNAPSHOT_DISTINCT_TIMES ≈ facts: approximating the number of distinct valid
// times by the number of facts is an upper bound (two facts landing on the
// same valid time would share a snapshot), but it is the common case for
// this app's per-attribute fact stream and keeps the model a single N term
// rather than inventing an unfounded compression ratio.
//
// storage = distinct times * attrs: this is the point of the strategy. Every
// snapshot carries a value for every attribute, changed or not, so N facts
// (each touching one attribute) still cost N*A records stored — the
// "duplicated state" the product brief calls out by name.
//
// SNAPSHOT_CLOSE_OVERHEAD: to stay correct, writing a new snapshot must also
// bitemporally close the previous one (set its systemTo) so that a later
// retroactive correction can find "every snapshot at or after v" — the exact
// set retro() below has to invalidate. That close-out is 1 extra record on
// every append. It is also exactly the bookkeeping snapshotStale skips.
const SNAPSHOT_CLOSE_OVERHEAD = 1

const snapshotsModel: CostModel = {
  key: 'snapshots',
  storage: (p) => p.facts * p.attrs,
  // Direct lookup of the one bitemporal snapshot row valid at the coordinate;
  // reading one field out of it is a fixed A-sized structure access.
  read: (p) => p.attrs,
  append: (p) => p.attrs + SNAPSHOT_CLOSE_OVERHEAD,
  // Every snapshot at or after the retroactive valid time is invalidated and
  // rebuilt in full (all A attributes, not just the one that changed) —
  // count of affected snapshots ~ retroDepth * facts, each costing `attrs`.
  retro: (p) => p.retroDepth * p.facts * p.attrs,
  notation: { storage: 'O(N·A)', read: 'O(A)', append: 'O(A)', retro: 'O(d·N·A)' },
}

// --- snapshotStale ------------------------------------------------------------
//
// Same stored shape as snapshots (full A-valued rows — PLAN.md is explicit
// that the broken row's stored snapshot at the trap's valid time really does
// carry the old salary alongside the new manager), so storage() and read()
// are identical. The divergence is entirely in what the write path skips:
// it never performs the SNAPSHOT_CLOSE_OVERHEAD bookkeeping (there is no
// reason to, since it never walks "every snapshot at or after v"), and on a
// retroactive fact it does not invalidate anything downstream — it just
// records the new snapshot and stops. That is simultaneously why it is
// cheaper to write and why it is wrong: every already-materialized snapshot
// at or after the retroactive valid time is left holding stale attribute
// values, which is exactly the silent-revert trap the panel demonstrates.
const snapshotStaleModel: CostModel = {
  key: 'snapshotStale',
  storage: (p) => p.facts * p.attrs,
  read: (p) => p.attrs,
  append: (p) => p.attrs,
  retro: (p) => p.attrs,
  notation: { storage: 'O(N·A)', read: 'O(A)', append: 'O(A)', retro: 'O(A)' },
}

// --- hybrid -------------------------------------------------------------------
//
// Snapshots on a fixed day grid (spacing k = snapshotInterval, over a horizon
// of H days), plus the full log. Reads take the nearest grid snapshot and
// replay forward to the query point.
//
// HYBRID_FACT_DENSITY: the one judgement call here — facts are assumed to
// arrive roughly uniformly over the horizon, so a k-day replay window holds
// on average (facts / H) * k facts. A bursty log would make some windows
// longer and others shorter; uniform density is the honest "no better
// information" baseline the product brief's sliders are built to explore.
const hybridModel: CostModel = {
  key: 'hybrid',
  // The full log (N records) plus one A-valued snapshot per grid point.
  // Grid points = H / k, so storage falls as the grid widens — the other
  // half of the tradeoff read() shows rising.
  storage: (p) => p.facts + (p.horizonDays / atLeast1(p.snapshotInterval)) * p.attrs,
  // Fetch the nearest snapshot (attrs records) then replay the bounded
  // window back to the query point (average window size below).
  read: (p) => p.attrs + (p.facts / atLeast1(p.horizonDays)) * p.snapshotInterval,
  // Appending to the log is O(1); the periodic grid snapshot is a scheduled
  // O(attrs) event amortised over the facts that occur inside one grid cell,
  // not a cost paid by any single fact.
  append: (p) => 1 + p.attrs / atLeast1(p.snapshotInterval),
  // A retroactive fact is appended to the log (O(1)) and invalidates the
  // grid snapshots at or after its valid time — far fewer of them than plain
  // snapshots pays, because the grid is coarser than the fact stream by a
  // factor of k. Affected grid points ~ retroDepth * H / k, each rebuilt in
  // full (attrs records).
  retro: (p) => 1 + p.retroDepth * (p.horizonDays / atLeast1(p.snapshotInterval)) * p.attrs,
  notation: {
    storage: 'O(N + H/k·A)',
    read: 'O(A + N·k/H)',
    append: 'O(1)',
    retro: 'O(1 + d·H/k·A)',
  },
}

export const COST_MODELS: Record<string, CostModel> = {
  deltas: deltasModel,
  intervals: intervalsModel,
  snapshots: snapshotsModel,
  snapshotStale: snapshotStaleModel,
  hybrid: hybridModel,
}

/**
 * Sample one measure of one model across a range of fact counts, holding
 * every other parameter at `base`. This is the shape the scale panel plots:
 * curves over history size, with the snapshot-interval and retro-depth
 * sliders supplying `base` rather than being swept themselves.
 */
export function costCurve(
  measure: (p: CostParams) => number,
  base: CostParams,
  range: readonly number[],
): { x: number; y: number }[] {
  return range.map((facts) => ({ x: facts, y: measure({ ...base, facts }) }))
}

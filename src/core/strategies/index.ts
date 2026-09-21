import type { Attr, Day, Fact, Value } from '../types'

/** Work done by applying one fact. Observed, not modelled. */
export type OpCounts = {
  /** new records appended */
  written: number
  /** existing records closed or rewritten in place */
  rewritten: number
  /** derived state dropped and rebuilt */
  invalidated: number
}

export const NO_OPS: OpCounts = { written: 0, rewritten: 0, invalidated: 0 }

export function addOps(a: OpCounts, b: OpCounts): OpCounts {
  return {
    written: a.written + b.written,
    rewritten: a.rewritten + b.rewritten,
    invalidated: a.invalidated + b.invalidated,
  }
}

export type Config = {
  /** Grid spacing in days for strategies that snapshot on a schedule. */
  snapshotInterval: number
}

export const DEFAULT_CONFIG: Config = { snapshotInterval: 30 }

export type Applied<S> = { state: S; ops: OpCounts }

/**
 * A representation of bitemporal history.
 *
 * `materialize` is deliberately absent: it is always a fold of `apply` over
 * `empty`, so the batch path and the incremental path cannot drift, and the
 * operation counts shown in the interface are the same ones a real write would
 * have paid.
 */
export interface Strategy<S = unknown> {
  key: string
  name: string
  blurb: string
  /** false for the deliberately incorrect strategy. */
  correct: boolean
  empty(cfg: Config): S
  apply(state: S, fact: Fact, cfg: Config): Applied<S>
  query(state: S, attr: Attr, valid: Day, system: Day): Value | undefined
  /** Records the read had to touch. Observation for the strategy row, not a projection. */
  readCost(state: S, attr: Attr, valid: Day, system: Day): number
  /** Records currently stored, for the duplicated-state comparison. */
  size(state: S): number
}

export function materialize<S>(
  strategy: Strategy<S>, log: readonly Fact[], cfg: Config,
): { state: S; ops: OpCounts } {
  let state = strategy.empty(cfg)
  let ops = NO_OPS
  for (const fact of log) {
    const applied = strategy.apply(state, fact, cfg)
    state = applied.state
    ops = addOps(ops, applied.ops)
  }
  return { state, ops }
}

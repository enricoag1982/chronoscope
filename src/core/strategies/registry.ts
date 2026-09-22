import { events } from './events'
import { hybrid } from './hybrid'
import { intervals } from './intervals'
import { snapshots } from './snapshots'
import { snapshotStale } from './snapshotStale'
import type { Strategy } from './index'

/**
 * Held in its own module rather than in index.ts, which the strategies
 * themselves import for the interface — a registry there would close the
 * import cycle.
 *
 * The incorrect strategy is listed as a peer of the others, not special-cased.
 * That is deliberate: it runs through the same interface, the same
 * materialisation and the same rendering, so the only thing distinguishing it
 * is that it gives wrong answers. A comparison that exempted it would be
 * making its argument for it.
 */
/** The registry is heterogeneous by construction: each strategy owns its own state shape. */
export type AnyStrategy = Strategy<any>

export const STRATEGIES: readonly AnyStrategy[] = [
  events,
  intervals,
  snapshots,
  hybrid,
  snapshotStale,
]

export const CORRECT_STRATEGIES = STRATEGIES.filter((s) => s.correct)
export const INCORRECT_STRATEGIES = STRATEGIES.filter((s) => !s.correct)

export function strategyByKey(key: string): AnyStrategy | undefined {
  return STRATEGIES.find((s) => s.key === key)
}

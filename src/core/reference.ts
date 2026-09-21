import { ATTRS } from './types'
import type { Attr, Day, EntityState, Fact, Value } from './types'

/**
 * The oracle: deliberately slow, obviously correct, and the only thing any
 * strategy is judged against.
 *
 * Keep what we had recorded by `system`, and what had become true by `valid`.
 * The winner is the greatest validFrom; ties — a correction at an existing
 * valid time — go to the greatest systemTime.
 */
export function referenceQuery(
  log: readonly Fact[], attr: Attr, valid: Day, system: Day,
): Value | undefined {
  let best: Fact | undefined
  for (const f of log) {
    if (f.attr !== attr) continue
    if (f.systemTime > system) continue
    if (f.validFrom > valid) continue
    if (
      best === undefined ||
      f.validFrom > best.validFrom ||
      (f.validFrom === best.validFrom && f.systemTime > best.systemTime)
    ) {
      best = f
    }
  }
  return best?.value
}

export function referenceState(
  log: readonly Fact[], valid: Day, system: Day,
): EntityState {
  const state: EntityState = {}
  for (const attr of ATTRS) {
    const v = referenceQuery(log, attr, valid, system)
    if (v !== undefined) state[attr] = v
  }
  return state
}

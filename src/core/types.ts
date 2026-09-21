/** Days since EPOCH. Integer arithmetic everywhere; formatted as a date only at the edge. */
export type Day = number

export type Attr = 'salary' | 'manager'
export const ATTRS: readonly Attr[] = ['salary', 'manager'] as const

export type Value = number | string

export type FactId = string

/**
 * A fact carries two independent coordinates.
 *
 *   validFrom  — when it became true of the world. Freely chosen, past or future.
 *   systemTime — when we recorded it. Append-only; never earlier than what we
 *                already know, because this axis *is* the audit history.
 *
 * Validity is open-ended: a fact holds from validFrom until the next fact on the
 * same attribute supersedes it. A retroactive insert is a validFrom earlier than
 * facts already recorded; a correction is a later systemTime at an existing
 * validFrom. Both fall out of the two coordinates with no extra machinery.
 */
export type Fact = {
  id: FactId
  attr: Attr
  value: Value
  validFrom: Day
  systemTime: Day
}

/** Full entity state at one (valid, system) coordinate. */
export type EntityState = Partial<Record<Attr, Value>>

export const INF = Number.POSITIVE_INFINITY

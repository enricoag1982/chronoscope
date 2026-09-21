import { day } from './dates'
import type { Attr, Day, Fact, Value } from './types'

/**
 * System time is monotonic: a new fact is recorded at the current clock, never
 * before it. Valid time is unconstrained in both directions. The asymmetry is
 * the semantics, not a simplification — valid time is a claim about the world
 * and may be revised, system time is the record of what we did and may not.
 */
export class MonotonicSystemTimeError extends Error {
  constructor(attempted: Day, latest: Day) {
    super(`cannot record at system time ${attempted}: log already reaches ${latest}`)
    this.name = 'MonotonicSystemTimeError'
  }
}

export function latestSystemTime(log: readonly Fact[]): Day {
  return log.reduce((max, f) => (f.systemTime > max ? f.systemTime : max), 0)
}

let counter = 0
export function nextFactId(): string {
  counter += 1
  return `f${counter}`
}

export function makeFact(
  attr: Attr, value: Value, validFrom: Day, systemTime: Day, id = nextFactId(),
): Fact {
  return { id, attr, value, validFrom, systemTime }
}

/** Append a fact, enforcing the monotonic system clock. */
export function append(log: readonly Fact[], fact: Fact): Fact[] {
  const latest = latestSystemTime(log)
  if (fact.systemTime < latest) throw new MonotonicSystemTimeError(fact.systemTime, latest)
  return [...log, fact]
}

/**
 * The scenario from Chronoscope.md, on a calendar.
 *
 * The fourth fact is the whole demo: recorded 10 June, valid from 1 March — after
 * the 1 April manager change was already written. It is also what breaks the
 * uninvalidated snapshot strategy, because the snapshot taken at 1 April carries
 * salary = 60,000 (only the manager changed that day) and nothing goes back to
 * correct it.
 */
export const SCENARIO: Fact[] = [
  makeFact('salary', 60_000, day(2026, 1, 15), day(2026, 1, 15), 'hire-salary'),
  makeFact('manager', 'Jim', day(2026, 1, 15), day(2026, 1, 15), 'hire-manager'),
  makeFact('manager', 'Rob', day(2026, 4, 1), day(2026, 4, 1), 'reorg'),
  makeFact('salary', 72_000, day(2026, 3, 1), day(2026, 6, 10), 'backdated-raise'),
]

/** Window the interface renders. Both axes share it, so the plane is square. */
export const HORIZON = { start: day(2026, 1, 1), end: day(2026, 9, 1) }

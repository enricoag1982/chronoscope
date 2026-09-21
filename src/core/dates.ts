import type { Day } from './types'

/** Day 0. All Day values are offsets from here. */
export const EPOCH = Date.UTC(2026, 0, 1)
const MS_PER_DAY = 86_400_000

export function day(year: number, month1: number, dayOfMonth: number): Day {
  return Math.round((Date.UTC(year, month1 - 1, dayOfMonth) - EPOCH) / MS_PER_DAY)
}

export function toDate(d: Day): Date {
  return new Date(EPOCH + d * MS_PER_DAY)
}

/**
 * Fixed rather than Intl, deliberately. Locale data varies by platform and ICU
 * version — en-GB renders September as "Sept" in some builds and "Sep" in
 * others — and an explainer that reads differently on the interviewer's machine
 * than on mine is not worth the convenience.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** "15 Jan" — for axes and dense tables. */
export function formatDay(d: Day): string {
  const t = toDate(d)
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`
}

/** "15 Jan 2026" — for headers, where the year earns its space. */
export function formatDayLong(d: Day): string {
  return `${formatDay(d)} ${toDate(d).getUTCFullYear()}`
}

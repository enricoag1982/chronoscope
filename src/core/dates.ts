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

const SHORT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
})
const LONG = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
})

/** "15 Jan" — for axes and dense tables. */
export function formatDay(d: Day): string {
  return SHORT.format(toDate(d))
}

/** "15 Jan 2026" — for headers, where the year earns its space. */
export function formatDayLong(d: Day): string {
  return LONG.format(toDate(d))
}

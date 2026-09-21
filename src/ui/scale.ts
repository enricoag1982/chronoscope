import { toDate } from '../core/dates'
import type { Day } from '../core/types'

/** Maps a day onto a pixel position. The only arithmetic the drawings share. */
export type Scale = (d: Day) => number

export function linear(domain: [Day, Day], range: [number, number]): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  return (d) => r0 + ((d - d0) / span) * (r1 - r0)
}

export function invert(domain: [Day, Day], range: [number, number]): (px: number) => Day {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = r1 - r0 || 1
  return (px) => Math.round(d0 + ((px - r0) / span) * (d1 - d0))
}

/**
 * Month boundaries inside the window. Months rather than evenly spaced ticks,
 * because every label in this interface is a date and the eye is looking for
 * "which month", not "how many days in".
 */
export function monthTicks(start: Day, end: Day): Day[] {
  const ticks: Day[] = []
  const from = toDate(start)
  let year = from.getUTCFullYear()
  let month = from.getUTCMonth()
  // Start at the first boundary at or after `start`.
  if (from.getUTCDate() > 1) month += 1

  for (;;) {
    const d = Date.UTC(year, month, 1)
    const asDay = Math.round((d - toDate(start).getTime()) / 86_400_000) + start
    if (asDay > end) break
    if (asDay >= start) ticks.push(asDay)
    month += 1
    if (month > 11) { month = 0; year += 1 }
  }
  return ticks
}

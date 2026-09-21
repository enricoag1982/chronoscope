import { INF } from '../types'
import type { Attr, Day, Fact, Value } from '../types'
import type { Applied, Config, Strategy } from './index'

/**
 * A row is a rectangle on the bitemporal plane: a value that held over a range
 * of valid time, believed over a range of system time. Both ends are exclusive,
 * INF meaning still open.
 */
export type Interval = {
  id: string
  attr: Attr
  value: Value
  validFrom: Day
  validTo: Day
  systemFrom: Day
  systemTo: Day
}

export type IntervalState = { rows: Interval[]; seq: number }

const isOpen = (r: Interval) => r.systemTo === INF

/**
 * Validity intervals — the classic bitemporal table.
 *
 * Reads are a direct lookup: find the rectangle containing the coordinate. The
 * price is on write. A retroactive fact does not append, it *rewrites*: every
 * open row it overlaps is closed in system time and reopened with adjusted
 * valid bounds. Nothing is ever mutated in place, so the system-time axis stays
 * an audit trail, but one fact can touch many rows.
 *
 * The subtlety worth reading: the new fact does not run to infinity. It holds
 * only until the next already-known fact supersedes it, so its valid range is
 * clipped at the nearest greater validFrom. Skipping that clip is the classic
 * way to make a retroactive insert silently swallow every later change.
 */
export const intervals: Strategy<IntervalState> = {
  key: 'intervals',
  name: 'Intervals',
  blurb: 'Bitemporal rectangles. Direct reads, rewriting writes.',
  correct: true,

  empty: () => ({ rows: [], seq: 0 }),

  apply(state: IntervalState, fact: Fact, _cfg: Config): Applied<IntervalState> {
    const { attr, value, validFrom: v, systemTime: t } = fact
    let seq = state.seq
    const id = () => `${fact.id}-${++seq}`

    const open = state.rows.filter((r) => r.attr === attr && isOpen(r))

    // The new fact holds until the next thing we already know about.
    let nextValid = INF
    for (const r of open) {
      if (r.validFrom > v && r.validFrom < nextValid) nextValid = r.validFrom
    }

    const rows: Interval[] = []
    let written = 0
    let rewritten = 0

    for (const r of state.rows) {
      const untouched =
        r.attr !== attr || !isOpen(r) || r.validTo <= v || r.validFrom >= nextValid
      if (untouched) {
        rows.push(r)
        continue
      }

      // Close in system time rather than mutating. A zero-width system range can
      // never be read back, so it is dropped rather than stored as noise.
      if (r.systemFrom < t) {
        rows.push({ ...r, systemTo: t })
        rewritten += 1
      } else {
        rewritten += 1
      }

      // Reopen whatever of this row survives on either side of the new fact.
      if (r.validFrom < v) {
        rows.push({ ...r, id: id(), validTo: v, systemFrom: t, systemTo: INF })
        written += 1
      }
      if (r.validTo > nextValid) {
        rows.push({ ...r, id: id(), validFrom: nextValid, systemFrom: t, systemTo: INF })
        written += 1
      }
    }

    rows.push({
      id: id(), attr, value,
      validFrom: v, validTo: nextValid,
      systemFrom: t, systemTo: INF,
    })
    written += 1

    return { state: { rows, seq }, ops: { written, rewritten, invalidated: 0 } }
  },

  query(state: IntervalState, attr: Attr, valid: Day, system: Day): Value | undefined {
    for (const r of state.rows) {
      if (r.attr !== attr) continue
      if (valid < r.validFrom || valid >= r.validTo) continue
      if (system < r.systemFrom || system >= r.systemTo) continue
      return r.value
    }
    return undefined
  },

  readCost: (state: IntervalState, attr: Attr) =>
    state.rows.filter((r) => r.attr === attr).length,
  size: (state: IntervalState) => state.rows.length,
}

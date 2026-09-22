import { formatDay } from '../../core/dates'
import { INF } from '../../core/types'
import type { Day } from '../../core/types'
import type { IntervalState } from '../../core/strategies/intervals'
import { show } from '../Readout'

/** A half-open range, written the way a bitemporal table actually reads. */
function range(from: Day, to: Day): string {
  return `[${formatDay(from)}, ${to === INF ? '∞' : formatDay(to)})`
}

/**
 * Every row this strategy has ever stored, as an actual bitemporal table —
 * attribute, value, valid range, system range — rather than a diagram of one.
 * Both ranges are half-open and rendered literally as such: [start, end), or
 * [start, ∞) while still open. That notation is why one row's end can equal
 * the next row's start without the two overlapping.
 *
 * Rows closed in system time (superseded by a later write) render faded but
 * stay on screen — the audit trail a retroactive write leaves behind, since a
 * row is never mutated, only closed and replaced. Rows are never
 * deduplicated: one line per stored row.
 */
export function IntervalRows({
  state, horizon: _horizon,
}: { state: IntervalState; horizon: { start: Day; end: Day } }) {
  const rows = [...state.rows].sort(
    (a, b) => a.attr.localeCompare(b.attr) || a.validFrom - b.validFrom || a.systemFrom - b.systemFrom,
  )
  if (rows.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>no rows</div>
  }

  return (
    <div>
      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>attribute</th>
              <th>value</th>
              <th>valid range</th>
              <th>system range</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const open = r.systemTo === INF
              return (
                <tr key={r.id} style={{ opacity: open ? 1 : 0.4 }}>
                  <td>{r.attr}</td>
                  <td className="num">{show(r.value)}</td>
                  <td className="num">{range(r.validFrom, r.validTo)}</td>
                  <td className="num">{range(r.systemFrom, r.systemTo)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '6px 0 0' }}>
        A retroactive write never mutates a row: it closes the old one in system
        time and opens replacements, so the old belief stays queryable.
      </p>
    </div>
  )
}

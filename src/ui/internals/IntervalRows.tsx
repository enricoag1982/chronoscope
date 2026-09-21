import { INF } from '../../core/types'
import type { Day } from '../../core/types'
import type { IntervalState } from '../../core/strategies/intervals'
import { linear } from '../scale'
import { show } from '../Readout'

const W = 1000
const ROW_H = 20
const PAD = 4

/**
 * Every row this strategy has ever stored, drawn as a rectangle on the same
 * valid-time axis the rest of the interface uses. Open rows (still current in
 * system time) render solid; closed rows fade but stay on screen — the audit
 * trail a retroactive write leaves behind, rather than a mutation that erases
 * it. Rows are never deduplicated: one rectangle per stored row.
 */
export function IntervalRows({
  state, horizon,
}: { state: IntervalState; horizon: { start: Day; end: Day } }) {
  const rows = [...state.rows].sort(
    (a, b) => a.attr.localeCompare(b.attr) || a.validFrom - b.validFrom || a.systemFrom - b.systemFrom,
  )
  if (rows.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>no rows</div>
  }

  const x = linear([horizon.start, horizon.end], [PAD, W - PAD])
  const h = rows.length * ROW_H

  return (
    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${h}`} width="100%" style={{ display: 'block' }}>
        {rows.map((r, i) => {
          const open = r.systemTo === INF
          const from = Math.min(Math.max(r.validFrom, horizon.start), horizon.end)
          const to = Math.min(r.validTo === INF ? horizon.end : r.validTo, horizon.end)
          const x0 = x(from)
          const x1 = x(Math.max(from, to))
          const y = i * ROW_H
          return (
            <g key={r.id} opacity={open ? 1 : 0.35}>
              <rect x={x0} y={y + 3} width={Math.max(1, x1 - x0)} height={ROW_H - 6}
                    fill="var(--rule-strong)" rx={2} />
              <text x={x0 + 4} y={y + ROW_H - 7} fontSize={10} fill="var(--ink)">
                {r.attr}: {show(r.value)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

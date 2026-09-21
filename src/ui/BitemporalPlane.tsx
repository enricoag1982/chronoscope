import { useState } from 'react'
import { formatDay } from '../core/dates'
import type { Rect } from '../core/plane'
import type { Attr, Day, Value } from '../core/types'
import { inkOn } from './palette'
import type { ValueColours } from './palette'
import { invert, linear, monthTicks } from './scale'

type Props = {
  attr: Attr
  rects: readonly Rect[]
  divergence: readonly Rect[]
  horizon: { start: Day; end: Day }
  validCursor: Day
  systemCursor: Day
  colours: ValueColours
  onPick: (valid: Day, system: Day) => void
}

const SIZE = 520
const L = 52
const B = 34
const T = 10
const R = 10
const PLOT_W = SIZE - L - R
const PLOT_H = SIZE - T - B

const label = (v: Value | undefined) =>
  v === undefined ? '—' : typeof v === 'number' ? v.toLocaleString('en-GB') : v

/**
 * Both clocks at once. Valid time runs right, system time runs up, so the
 * diagonal is where knowledge and reality coincide: above it is everything
 * learned after the fact, below it everything recorded before it took effect.
 *
 * Regions come from plane.ts as merged rectangles, so this draws a few dozen
 * shapes rather than a grid of days, and every edge falls exactly where the
 * semantics change.
 */
export function BitemporalPlane({
  attr, rects, divergence, horizon, validCursor, systemCursor, colours, onPick,
}: Props) {
  const [hover, setHover] = useState<Rect | null>(null)

  const x = linear([horizon.start, horizon.end], [L, L + PLOT_W])
  const y = linear([horizon.start, horizon.end], [T + PLOT_H, T])
  const xBack = invert([horizon.start, horizon.end], [L, L + PLOT_W])
  const yBack = invert([horizon.start, horizon.end], [T + PLOT_H, T])
  const ticks = monthTicks(horizon.start, horizon.end)

  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const box = svg.getBoundingClientRect()
    const sx = ((e.clientX - box.left) / box.width) * SIZE
    const sy = ((e.clientY - box.top) / box.height) * SIZE
    onPick(xBack(sx), yBack(sy))
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" onClick={pick}
           style={{ cursor: 'crosshair' }} role="img"
           aria-label={`${attr} across valid time and system time`}>
        <defs>
          {/* Texture, so the wrong region survives print, forced colours and CVD. */}
          <pattern id="wrongHatch" width="7" height="7" patternTransform="rotate(45)"
                   patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--wrong)" strokeWidth="2.5" />
          </pattern>
        </defs>

        {rects.map((r, i) => {
          const rx = x(r.validFrom)
          const rw = Math.max(0, x(r.validTo) - rx - 1.5)
          const ry = y(r.systemTo)
          const rh = Math.max(0, y(r.systemFrom) - ry - 1.5)
          const fill = colours(r.value)
          return (
            <g key={i} onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)}>
              <rect x={rx} y={ry} width={rw} height={rh} fill={fill} rx={2} />
              {rw > 46 && rh > 15 && (
                <text x={rx + rw / 2} y={ry + rh / 2 + 3.5} fontSize={10.5}
                      fill={inkOn(fill)} textAnchor="middle" pointerEvents="none">
                  {label(r.value)}
                </text>
              )}
            </g>
          )
        })}

        {divergence.map((r, i) => (
          <rect key={`d${i}`} x={x(r.validFrom)} y={y(r.systemTo)}
                width={Math.max(0, x(r.validTo) - x(r.validFrom) - 1.5)}
                height={Math.max(0, y(r.systemFrom) - y(r.systemTo) - 1.5)}
                fill="url(#wrongHatch)" stroke="var(--wrong)" strokeWidth={1.5} rx={2}
                pointerEvents="none" />
        ))}

        {/* Where the two clocks agree. */}
        <line x1={x(horizon.start)} y1={y(horizon.start)} x2={x(horizon.end)} y2={y(horizon.end)}
              stroke="var(--ink)" strokeDasharray="3 4" strokeWidth={1} opacity={0.5} />
        <text x={x(horizon.end) - 6} y={y(horizon.end) + 16} fontSize={9.5}
              fill="var(--ink-faint)" textAnchor="end">recorded as it happened</text>
        <text x={L + 8} y={T + 14} fontSize={9.5} fill="var(--ink-faint)">
          learned afterwards
        </text>
        <text x={x(horizon.end) - 6} y={T + PLOT_H - 8} fontSize={9.5}
              fill="var(--ink-faint)" textAnchor="end">known in advance</text>

        {ticks.map((t) => (
          <g key={t}>
            <text x={x(t)} y={SIZE - 18} fontSize={9.5} fill="var(--ink-faint)" textAnchor="middle">
              {formatDay(t)}
            </text>
            <text x={L - 8} y={y(t) + 3.5} fontSize={9.5} fill="var(--ink-faint)" textAnchor="end">
              {formatDay(t)}
            </text>
          </g>
        ))}

        <line x1={x(validCursor)} y1={T} x2={x(validCursor)} y2={T + PLOT_H}
              stroke="var(--ink)" strokeWidth={1.25} pointerEvents="none" />
        <line x1={L} y1={y(systemCursor)} x2={L + PLOT_W} y2={y(systemCursor)}
              stroke="var(--ink)" strokeWidth={1.25} pointerEvents="none" />

        <text x={SIZE / 2} y={SIZE - 3} fontSize={11} fill="var(--ink-soft)"
              textAnchor="middle" fontWeight={600}>valid time →</text>
        <text x={12} y={SIZE / 2} fontSize={11} fill="var(--ink-soft)" textAnchor="middle"
              fontWeight={600} transform={`rotate(-90 12 ${SIZE / 2})`}>system time →</text>
      </svg>

      {hover && (
        <div className="panel" style={{
          position: 'absolute', top: 8, right: 8, padding: '7px 10px',
          fontSize: 12, pointerEvents: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <strong>{label(hover.value)}</strong>
          <div style={{ color: 'var(--ink-faint)', marginTop: 2 }}>
            valid {formatDay(hover.validFrom)}–{formatDay(hover.validTo)}
            <br />
            recorded {formatDay(hover.systemFrom)}–{formatDay(hover.systemTo)}
          </div>
        </div>
      )}
    </div>
  )
}

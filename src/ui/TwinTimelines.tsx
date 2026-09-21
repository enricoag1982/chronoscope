import { useRef } from 'react'
import { formatDayLong } from '../core/dates'
import type { Day, Fact } from '../core/types'
import { invert, linear, monthTicks } from './scale'

type Props = {
  log: readonly Fact[]
  horizon: { start: Day; end: Day }
  validCursor: Day
  systemCursor: Day
  /** Nothing is known before it is recorded, so the system axis stops here. */
  clock: Day
  onValid: (d: Day) => void
  onSystem: (d: Day) => void
}

const W = 1000
const H = 208
const PAD = 16
const VALID_Y = 64
const SYSTEM_Y = 156
const GRAB = 30

function lean(f: Fact): 'retro' | 'future' | 'aligned' {
  if (f.systemTime > f.validFrom) return 'retro'
  if (f.systemTime < f.validFrom) return 'future'
  return 'aligned'
}

const STROKE = { retro: 'var(--retro)', future: 'var(--future)', aligned: 'var(--rule-strong)' }

/**
 * The two axes are the controls. Each carries its own cursor, dragged directly
 * on the timeline it belongs to, so there is no second copy of the same two
 * numbers as sliders elsewhere on the page.
 *
 * A fact sits at its valid time above and its system time below, joined by a
 * connector. Vertical when the two agree, leaning when they do not — which
 * shows the idea before any sentence about it does. Facts not yet recorded at
 * the system cursor are ghosted rather than hidden, so you can see what is
 * about to arrive.
 */
export function TwinTimelines({
  log, horizon, validCursor, systemCursor, clock, onValid, onSystem,
}: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const x = linear([horizon.start, horizon.end], [PAD, W - PAD])
  const xBack = invert([horizon.start, horizon.end], [PAD, W - PAD])
  const ticks = monthTicks(horizon.start, horizon.end)

  const dayAt = (clientX: number): Day => {
    const box = svg.current!.getBoundingClientRect()
    return xBack(((clientX - box.left) / box.width) * W)
  }

  const drag = (set: (d: Day) => void) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    set(dayAt(e.clientX))
  }
  const move = (set: (d: Day) => void) => (e: React.PointerEvent) => {
    if (e.buttons !== 1) return
    set(dayAt(e.clientX))
  }

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" role="group"
         aria-label="Facts against valid time and system time; drag either axis"
         style={{ touchAction: 'none', display: 'block' }}>
      {/* Nothing past the clock has happened yet, on either reading. */}
      <rect x={x(clock)} y={SYSTEM_Y - GRAB} width={Math.max(0, W - PAD - x(clock))}
            height={GRAB * 2} fill="var(--rule)" opacity={0.5} />

      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={VALID_Y - 8} y2={VALID_Y + 8} stroke="var(--rule)" />
          <line x1={x(t)} x2={x(t)} y1={SYSTEM_Y - 8} y2={SYSTEM_Y + 8} stroke="var(--rule)" />
        </g>
      ))}

      {log.map((f) => {
        const kind = lean(f)
        const known = f.systemTime <= systemCursor
        return (
          <g key={f.id} opacity={known ? 1 : 0.2}>
            <line x1={x(f.validFrom)} y1={VALID_Y} x2={x(f.systemTime)} y2={SYSTEM_Y}
                  stroke={STROKE[kind]} strokeWidth={kind === 'aligned' ? 1 : 1.75}
                  strokeDasharray={known ? undefined : '3 3'} />
            <circle cx={x(f.validFrom)} cy={VALID_Y} r={4} fill={STROKE[kind]} />
            <circle cx={x(f.systemTime)} cy={SYSTEM_Y} r={4} fill={STROKE[kind]} />
          </g>
        )
      })}

      <Axis
        y={VALID_Y} label="valid time" question="when was it true?"
        cursor={validCursor} x={x} above
        onDown={drag(onValid)} onMove={move(onValid)}
      />
      <Axis
        y={SYSTEM_Y} label="system time" question="what did we know, and when?"
        cursor={systemCursor} x={x}
        onDown={drag(onSystem)} onMove={move(onSystem)}
      />
    </svg>
  )
}

function Axis({
  y, label, question, cursor, x, above, onDown, onMove,
}: {
  y: number; label: string; question: string; cursor: Day
  x: (d: Day) => number; above?: boolean
  onDown: (e: React.PointerEvent) => void
  onMove: (e: React.PointerEvent) => void
}) {
  const cx = x(cursor)
  const labelY = above ? y - 30 : y + 40
  const pillY = above ? y - 24 : y + 10
  return (
    <g>
      <line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="var(--rule-strong)" />

      <text x={PAD} y={labelY} fontSize={11.5} fontWeight={600} fill="var(--ink-soft)">
        {label}
        <tspan fill="var(--ink-faint)" fontWeight={400}> — {question}</tspan>
      </text>

      {/* One wide, invisible grab zone: the axis is the slider. */}
      <rect x={0} y={y - GRAB} width={W} height={GRAB * 2} fill="transparent"
            style={{ cursor: 'ew-resize' }} onPointerDown={onDown} onPointerMove={onMove} />

      <line x1={cx} x2={cx} y1={y - 16} y2={y + 16} stroke="var(--ink)" strokeWidth={1.5}
            pointerEvents="none" />
      <g pointerEvents="none">
        <rect x={cx - 46} y={pillY} width={92} height={15} rx={3} fill="var(--ink)" />
        <text x={cx} y={pillY + 11} fontSize={10} fill="#fff" textAnchor="middle">
          {formatDayLong(cursor)}
        </text>
      </g>
    </g>
  )
}

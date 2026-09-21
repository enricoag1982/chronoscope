import { formatDay } from '../core/dates'
import type { Day, Fact } from '../core/types'
import { linear, monthTicks } from './scale'

type Props = {
  log: readonly Fact[]
  horizon: { start: Day; end: Day }
  validCursor: Day
  systemCursor: Day
}

const W = 1000
const H = 176
const PAD = 14
const VALID_Y = 52
const SYSTEM_Y = 132

/** Which way a fact leans between the two axes, and what that means. */
function lean(f: Fact): 'retro' | 'future' | 'aligned' {
  if (f.systemTime > f.validFrom) return 'retro'
  if (f.systemTime < f.validFrom) return 'future'
  return 'aligned'
}

const STROKE = { retro: 'var(--retro)', future: 'var(--future)', aligned: 'var(--rule-strong)' }

/**
 * The same facts plotted against both clocks at once. A fact sits at its valid
 * time on the upper axis and its system time on the lower one, joined by a
 * connector; when the two agree the connector is vertical, and when they do not
 * it leans. The lean is the concept, visible before any explanation of it.
 *
 * Facts not yet recorded at the system cursor are ghosted rather than hidden,
 * so you can see what is about to arrive.
 */
export function TwinTimelines({ log, horizon, validCursor, systemCursor }: Props) {
  const x = linear([horizon.start, horizon.end], [PAD, W - PAD])
  const ticks = monthTicks(horizon.start, horizon.end)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
         aria-label="Facts plotted against valid time and system time">
      {/* Everything to the right of the system cursor has not been recorded yet. */}
      <rect x={x(systemCursor)} y={SYSTEM_Y - 26} width={W - PAD - x(systemCursor)} height={44}
            fill="var(--rule)" opacity={0.45} />

      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={VALID_Y - 22} y2={VALID_Y + 6} stroke="var(--rule)" />
          <line x1={x(t)} x2={x(t)} y1={SYSTEM_Y - 6} y2={SYSTEM_Y + 22} stroke="var(--rule)" />
          <text x={x(t)} y={H - 4} fontSize={10} fill="var(--ink-faint)" textAnchor="middle">
            {formatDay(t)}
          </text>
        </g>
      ))}

      <line x1={PAD} x2={W - PAD} y1={VALID_Y} y2={VALID_Y} stroke="var(--rule-strong)" />
      <line x1={PAD} x2={W - PAD} y1={SYSTEM_Y} y2={SYSTEM_Y} stroke="var(--rule-strong)" />

      <text x={PAD} y={VALID_Y - 28} fontSize={11} fill="var(--ink-soft)" fontWeight={600}>
        valid time — when it was true
      </text>
      <text x={PAD} y={SYSTEM_Y + 36} fontSize={11} fill="var(--ink-soft)" fontWeight={600}>
        system time — when we recorded it
      </text>

      {log.map((f) => {
        const kind = lean(f)
        const known = f.systemTime <= systemCursor
        return (
          <g key={f.id} opacity={known ? 1 : 0.22}>
            <line x1={x(f.validFrom)} y1={VALID_Y} x2={x(f.systemTime)} y2={SYSTEM_Y}
                  stroke={STROKE[kind]} strokeWidth={kind === 'aligned' ? 1 : 1.75}
                  strokeDasharray={known ? undefined : '3 3'} />
            <circle cx={x(f.validFrom)} cy={VALID_Y} r={4} fill={STROKE[kind]} />
            <circle cx={x(f.systemTime)} cy={SYSTEM_Y} r={4} fill={STROKE[kind]} />
          </g>
        )
      })}

      <Cursor x={x(validCursor)} y={VALID_Y} label={formatDay(validCursor)} up />
      <Cursor x={x(systemCursor)} y={SYSTEM_Y} label={formatDay(systemCursor)} />
    </svg>
  )
}

function Cursor({ x, y, label, up }: { x: number; y: number; label: string; up?: boolean }) {
  const y1 = up ? y - 26 : y - 10
  const y2 = up ? y + 10 : y + 26
  return (
    <g>
      <line x1={x} x2={x} y1={y1} y2={y2} stroke="var(--ink)" strokeWidth={1.5} />
      <rect x={x - 26} y={up ? y1 - 15 : y2 + 2} width={52} height={14} rx={3} fill="var(--ink)" />
      <text x={x} y={up ? y1 - 4 : y2 + 12} fontSize={10} fill="#fff" textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

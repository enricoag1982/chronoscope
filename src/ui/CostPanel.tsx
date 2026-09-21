import { useState } from 'react'
import type { CostParams } from '../core/cost'
import { COST_MODELS, costCurve } from '../core/cost'
import { HORIZON } from '../core/log'
import { STRATEGIES } from '../core/strategies/registry'
import { ATTRS } from '../core/types'
import { seriesColour } from './palette'
import { linear } from './scale'

type Props = {
  snapshotInterval: number
}

type Measure = 'storage' | 'read' | 'append' | 'retro'

const MEASURES: { key: Measure; title: string; axis: string }[] = [
  { key: 'storage', title: 'storage', axis: 'records held' },
  { key: 'read', title: 'read', axis: 'records touched / query' },
  { key: 'append', title: 'append', axis: 'records touched / in-order write' },
  { key: 'retro', title: 'retroactive write', axis: 'records touched / correction' },
]

/** Swept fact counts, log-spaced 10 → 10,000 — the "as history grows" axis. */
const FACT_RANGE = [10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000]
const X_MIN = FACT_RANGE[0]!
const X_MAX = FACT_RANGE.at(-1)!

const CHART_W = 268
const CHART_H = 172
const PAD_L = 28
const PAD_R = 60
const PAD_T = 10
const PAD_B = 20

const ATTRS_COUNT = ATTRS.length
const HORIZON_DAYS = HORIZON.end - HORIZON.start

function formatTick(n: number): string {
  if (n === 0) return '0'
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}

/**
 * Log-log axes: the fact range spans three orders of magnitude and the
 * measures span more (O(1) beside O(N·A)), so a linear axis would flatten
 * everything under the biggest curve. y uses log1p so a value of exactly 0
 * (e.g. a strategy that charges nothing for retroactive depth) still plots,
 * instead of producing -Infinity.
 */
function xScale(range: [number, number]) {
  const lin = linear([Math.log10(X_MIN), Math.log10(X_MAX)], range)
  return (facts: number) => lin(Math.log10(Math.max(facts, X_MIN)))
}
function y1pScale(maxY: number, range: [number, number]) {
  const lin = linear([0, Math.log10(maxY + 1)], range)
  return (v: number) => lin(Math.log10(v + 1))
}

/** Nudges overlapping right-end line labels apart so every one stays legible. */
function spreadLabels(entries: { key: string; y: number }[], minGap: number): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a.y - b.y)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const cur = sorted[i]!
    if (cur.y - prev.y < minGap) cur.y = prev.y + minGap
  }
  return new Map(sorted.map((e) => [e.key, e.y]))
}

/**
 * The scale band: how each representation behaves as history grows.
 *
 * An asymptotic table carries the argument on its own; four small-multiple
 * charts (one per measure) show the same argument as curves over a swept
 * number of facts, moved by the two sliders that actually change the
 * mechanics — the snapshot grid (hybrid) and how far back a correction
 * reaches (snapshots).
 */
export function CostPanel({ snapshotInterval }: Props) {
  const [k, setK] = useState(snapshotInterval)
  const [retroDepth, setRetroDepth] = useState(0.4)

  const base: CostParams = {
    facts: 0,
    attrs: ATTRS_COUNT,
    horizonDays: HORIZON_DAYS,
    snapshotInterval: k,
    retroDepth,
  }

  return (
    <div className="panel">
      <p style={{ margin: '0 0 12px', color: 'var(--ink-faint)', fontSize: 12, maxWidth: '70ch' }}>
        Modelled projections, not measurements: closed-form functions of each
        strategy&rsquo;s stated mechanics (see <code>core/cost.ts</code>), not a
        benchmark — nothing here runs a strategy or times anything.
      </p>
      <p style={{ margin: '0 0 12px', color: 'var(--ink-faint)', fontSize: 12, maxWidth: '70ch' }}>
        Growth below is in <strong>N</strong>, the number of facts. Attributes per
        entity (<strong>A</strong>) and horizon length (<strong>H</strong>) are held
        fixed and appear in the notation where a row depends on them, so
        &ldquo;O(1)&rdquo; here means constant in N — not cheap in every dimension.
        The model is held to the implementations by <code>core/costClaims.test.ts</code>,
        which compares how each measure grows against operations the strategies
        actually perform.
      </p>

      <table>
        <thead>
          <tr>
            <th>strategy</th>
            <th>storage</th>
            <th>read</th>
            <th>append</th>
            <th>retroactive</th>
          </tr>
        </thead>
        <tbody>
          {STRATEGIES.map((s) => {
            const model = COST_MODELS[s.key]!
            return (
              <tr key={s.key}>
                <td>
                  <span
                    style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: seriesColour(s.key), marginRight: 7,
                    }}
                  />
                  {s.name}
                  {!s.correct && <span className="tag wrong" style={{ marginLeft: 7 }}>incorrect</span>}
                </td>
                <td className="num">{model.notation.storage}</td>
                <td className="num">{model.notation.read}</td>
                <td className="num">{model.notation.append}</td>
                <td className="num">{model.notation.retro}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p style={{ margin: '8px 0 0', color: 'var(--ink-faint)', fontSize: 12, maxWidth: '74ch' }}>
        The incorrect strategy&rsquo;s append and retroactive figures are the
        cheapest in this table — that cheapness is the trap, not a
        recommendation. It never invalidates the snapshots it leaves stale.
      </p>

      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 10, marginTop: 16,
        }}
      >
        {MEASURES.map((m) => (
          <CostChart key={m.key} measureKey={m.key} title={m.title} axisLabel={m.axis} base={base} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 220px', fontSize: 12, color: 'var(--ink-soft)' }}>
          snapshot interval k <span className="num">{k}d</span>
          <input
            type="range" min={1} max={365} value={k}
            onChange={(e) => setK(Number(e.target.value))}
          />
        </label>
        <label style={{ flex: '1 1 220px', fontSize: 12, color: 'var(--ink-soft)' }}>
          retroactive depth d <span className="num">{retroDepth.toFixed(2)}</span>
          <input
            type="range" min={0} max={1} step={0.01} value={retroDepth}
            onChange={(e) => setRetroDepth(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  )
}

function CostChart({
  measureKey, title, axisLabel, base,
}: {
  measureKey: Measure; title: string; axisLabel: string; base: CostParams
}) {
  const curves = STRATEGIES.map((s) => {
    const model = COST_MODELS[s.key]!
    return { key: s.key, name: s.name, points: costCurve(model[measureKey], base, FACT_RANGE) }
  })

  const maxY = Math.max(1, ...curves.flatMap((c) => c.points.map((p) => p.y)))

  const x = xScale([PAD_L, CHART_W - PAD_R])
  const y = y1pScale(maxY, [CHART_H - PAD_B, PAD_T])

  const xTicks = [10, 100, 1_000, 10_000]
  const yCandidates = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000]
  const yTicks = [0, ...yCandidates.filter((t) => t <= maxY)].slice(-4)

  const labelPositions = spreadLabels(
    curves.map((c) => ({ key: c.key, y: y(c.points.at(-1)!.y) })),
    9,
  )

  return (
    <div>
      <h3 style={{ marginBottom: 2 }}>{title}</h3>
      <p style={{ margin: '0 0 4px', fontSize: 10.5, color: 'var(--ink-faint)' }}>{axisLabel}</p>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" role="img"
        aria-label={`${title} versus number of facts recorded, for all five strategies`}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L} x2={CHART_W - PAD_R} y1={y(t)} y2={y(t)}
              stroke="var(--rule)" strokeWidth={1}
            />
            <text x={PAD_L - 4} y={y(t) + 3} fontSize={8} textAnchor="end" fill="var(--ink-faint)">
              {formatTick(t)}
            </text>
          </g>
        ))}

        <line
          x1={PAD_L} x2={CHART_W - PAD_R} y1={CHART_H - PAD_B} y2={CHART_H - PAD_B}
          stroke="var(--rule-strong)"
        />
        {xTicks.map((t) => (
          <text
            key={t} x={x(t)} y={CHART_H - PAD_B + 11} fontSize={8}
            textAnchor="middle" fill="var(--ink-faint)"
          >
            {formatTick(t)}
          </text>
        ))}
        <text
          x={(PAD_L + CHART_W - PAD_R) / 2} y={CHART_H - 2} fontSize={8}
          textAnchor="middle" fill="var(--ink-faint)"
        >
          facts recorded (log scale)
        </text>

        {curves.map((c) => {
          const d = c.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x)},${y(p.y)}`).join(' ')
          return <path key={c.key} d={d} fill="none" stroke={seriesColour(c.key)} strokeWidth={2} />
        })}

        {curves.map((c) => (
          <text
            key={c.key} x={CHART_W - PAD_R + 4} y={labelPositions.get(c.key)! + 3}
            fontSize={8} fill="var(--ink-soft)"
          >
            {c.name}
          </text>
        ))}
      </svg>
    </div>
  )
}

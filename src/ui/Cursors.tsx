import { formatDayLong } from '../core/dates'
import type { Day } from '../core/types'

type Props = {
  horizon: { start: Day; end: Day }
  validCursor: Day
  systemCursor: Day
  clock: Day
  onValid: (d: Day) => void
  onSystem: (d: Day) => void
}

/**
 * The two coordinates every answer in this tool depends on. Kept adjacent and
 * labelled with the question each one asks, because "salary was 60,000" is not
 * a fact here — "salary was 60,000 on 1 May, as far as we knew on 1 June" is.
 */
export function Cursors({ horizon, validCursor, systemCursor, clock, onValid, onSystem }: Props) {
  return (
    <div className="panel" style={{ display: 'grid', gap: 14 }}>
      <Slider
        label="Valid time" question="when was it true?"
        value={validCursor} horizon={horizon} onChange={onValid} />
      <Slider
        label="System time" question="what did we know, and when?"
        value={systemCursor} horizon={horizon} onChange={onSystem}
        max={clock} maxNote="the clock" />
    </div>
  )
}

function Slider({
  label, question, value, horizon, onChange, max, maxNote,
}: {
  label: string; question: string; value: Day
  horizon: { start: Day; end: Day }
  onChange: (d: Day) => void
  max?: Day; maxNote?: string
}) {
  const ceiling = max ?? horizon.end
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>
          <strong style={{ fontSize: 13 }}>{label}</strong>{' '}
          <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{question}</span>
        </span>
        <span className="num" style={{ fontSize: 13 }}>{formatDayLong(value)}</span>
      </span>
      <input
        type="range"
        min={horizon.start}
        max={ceiling}
        value={Math.min(value, ceiling)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {maxNote !== undefined && (
        <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
          cannot run past {maxNote} — nothing is known before it is recorded
        </span>
      )}
    </label>
  )
}

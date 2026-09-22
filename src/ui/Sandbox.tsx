import { useState } from 'react'
import { formatDay, formatDayLong } from '../core/dates'
import { HORIZON } from '../core/log'
import { ATTRS } from '../core/types'
import type { Attr, Value } from '../core/types'
import type { Action, AppState } from '../state'

/**
 * The scenario is a starting point, not a fence: this is where a fact gets
 * written by hand.
 *
 * System time has no control here at all — not a disabled one, not one that
 * validates after the fact. Every addFact this form dispatches is recorded at
 * state.clock, because the reducer stamps it there; there is simply nothing
 * in the form for a system time to come from. Valid time is the only date the
 * form lets you choose, and it is free to land anywhere in HORIZON.
 */
export function Sandbox({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const [attr, setAttr] = useState<Attr>('salary')
  const [numValue, setNumValue] = useState(0)
  const [textValue, setTextValue] = useState('')
  const [validFrom, setValidFrom] = useState(state.clock)

  const value: Value = attr === 'salary' ? numValue : textValue

  return (
    <div className="panel" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>add fact</strong>

        <select value={attr} onChange={(e) => setAttr(e.target.value as Attr)} aria-label="attribute">
          {ATTRS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {attr === 'salary' ? (
          <input type="number" value={numValue} style={{ width: 100 }} aria-label="value"
                 onChange={(e) => setNumValue(Number(e.target.value))} />
        ) : (
          <input type="text" value={textValue} style={{ width: 120 }} aria-label="value"
                 onChange={(e) => setTextValue(e.target.value)} />
        )}

        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>valid from</span>
        <input type="range" min={HORIZON.start} max={HORIZON.end} value={validFrom}
               style={{ width: 140 }} aria-label="valid from"
               onChange={(e) => setValidFrom(Number(e.target.value))} />
        <span className="num" style={{ fontSize: 12, minWidth: 60 }}>{formatDay(validFrom)}</span>

        <button className="primary" style={{ marginLeft: 'auto' }}
                disabled={attr === 'manager' && textValue.trim() === ''}
                onClick={() => dispatch({ type: 'addFact', attr, value, validFrom })}>
          add
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
        Recorded at the clock — <strong className="num">{formatDayLong(state.clock)}</strong> — never
        earlier: system time is the record of what we did, and a store that lets
        you write into its own past has stopped being an audit log.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>clock</span>
        {/* One step. Advancing the clock is how you separate two recordings in
            system time; how far you advance it changes nothing that matters. */}
        <button onClick={() => dispatch({ type: 'advanceClock', days: 1 })}>+1 day</button>

        <button style={{ marginLeft: 'auto' }} disabled={state.log.length === 0}
                onClick={() => dispatch({ type: 'undo' })}>
          undo
        </button>
        <button onClick={() => dispatch({ type: 'reset' })}>reset</button>
      </div>
    </div>
  )
}

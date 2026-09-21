import { useMemo, useReducer, useState } from 'react'
import { formatDayLong } from '../core/dates'
import { HORIZON } from '../core/log'
import { divergenceFor, planeFor } from '../core/plane'
import { referenceQuery } from '../core/reference'
import { materialize } from '../core/strategies/index'
import { INCORRECT_STRATEGIES } from '../core/strategies/registry'
import { ATTRS } from '../core/types'
import type { Attr } from '../core/types'
import { initialState, reducer } from '../state'
import { BitemporalPlane } from './BitemporalPlane'
import { Cursors } from './Cursors'
import { TwinTimelines } from './TwinTimelines'
import { coloursFor } from './palette'

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [attr, setAttr] = useState<Attr>('salary')
  const { log, validCursor, systemCursor, clock, snapshotInterval } = state

  const colours = useMemo(
    () => coloursFor(log.filter((f) => f.attr === attr).map((f) => f.value)),
    [log, attr],
  )

  const rects = useMemo(() => planeFor(log, attr, HORIZON), [log, attr])

  // The wrong region is drawn from the incorrect strategy itself, not asserted.
  const divergence = useMemo(() => {
    const stale = INCORRECT_STRATEGIES[0]!
    const { state: s } = materialize(stale, log, { snapshotInterval })
    return divergenceFor(log, attr, HORIZON, (a, v, sys) => stale.query(s, a, v, sys))
  }, [log, attr, snapshotInterval])

  const truth = referenceQuery(log, attr, validCursor, systemCursor)

  return (
    <div className="app">
      <header className="masthead">
        <h1>Chronoscope</h1>
        <p>
          Knowledge of the past changes. Once it can, how you store history stops
          being an implementation detail — the same facts under different
          representations cost wildly different things, and one common shortcut is
          quietly wrong.
        </p>
      </header>

      <section className="band">
        <header>
          <h2>Logical history</h2>
          <p>
            Every answer here needs two coordinates. Not “salary was 60,000”, but
            “salary was 60,000 on 1 May, as far as we knew on 1 June”.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 14 }}>
          <Cursors
            horizon={HORIZON} validCursor={validCursor} systemCursor={systemCursor}
            clock={clock}
            onValid={(d) => dispatch({ type: 'setValidCursor', day: d })}
            onSystem={(d) => dispatch({ type: 'setSystemCursor', day: d })}
          />

          <div className="panel" style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{attr}</div>
              <div className="num" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>
                {truth === undefined ? '—'
                  : typeof truth === 'number' ? truth.toLocaleString('en-GB') : truth}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              valid {formatDayLong(validCursor)}
              <br />
              as recorded on {formatDayLong(systemCursor)}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {ATTRS.map((a) => (
                <button key={a} className={a === attr ? 'primary' : ''}
                        onClick={() => setAttr(a)}>{a}</button>
              ))}
            </div>
          </div>

          <div className="panel">
            <TwinTimelines log={log} horizon={HORIZON}
                           validCursor={validCursor} systemCursor={systemCursor} />
          </div>

          <div className="panel" style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
            <BitemporalPlane
              attr={attr} rects={rects} divergence={divergence} horizon={HORIZON}
              validCursor={validCursor} systemCursor={systemCursor} colours={colours}
              onPick={(v, s) => {
                dispatch({ type: 'setValidCursor', day: v })
                dispatch({ type: 'setSystemCursor', day: s })
              }}
            />
            {divergence.length > 0 && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)', maxWidth: '62ch' }}>
                <span className="tag wrong">hatched</span>{' '}
                where the uninvalidated snapshot strategy disagrees with the truth.
                Click inside it.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

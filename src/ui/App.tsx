import { useMemo, useReducer } from 'react'
import { HORIZON } from '../core/log'
import { divergenceFor, planeFor } from '../core/plane'
import { materialize } from '../core/strategies/index'
import { INCORRECT_STRATEGIES } from '../core/strategies/registry'
import { ATTRS } from '../core/types'
import type { Attr } from '../core/types'
import { initialState, reducer } from '../state'
import { BitemporalPlane } from './BitemporalPlane'
import { Readout } from './Readout'
import { TwinTimelines } from './TwinTimelines'
import { coloursFor } from './palette'

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const { log, validCursor, systemCursor, clock, snapshotInterval } = state

  // The wrong region is drawn from the incorrect strategy itself, not asserted.
  const planes = useMemo(() => {
    const stale = INCORRECT_STRATEGIES[0]!
    const { state: s } = materialize(stale, log, { snapshotInterval })
    return ATTRS.map((attr: Attr) => ({
      attr,
      rects: planeFor(log, attr, HORIZON),
      divergence: divergenceFor(log, attr, HORIZON, (a, v, sys) => stale.query(s, a, v, sys)),
      colours: coloursFor(log.filter((f) => f.attr === attr).map((f) => f.value)),
    }))
  }, [log, snapshotInterval])

  const wrongAnywhere = planes.some((p) => p.divergence.length > 0)

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
            Every answer needs two coordinates. Not “salary was 60,000”, but “salary
            was 60,000 on 1 May, as far as we knew on 1 June”. Drag either axis.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 14 }}>
          <Readout log={log} validCursor={validCursor} systemCursor={systemCursor} />

          <div className="panel">
            <TwinTimelines
              log={log} horizon={HORIZON} clock={clock}
              validCursor={validCursor} systemCursor={systemCursor}
              onValid={(d) => dispatch({ type: 'setValidCursor', day: d })}
              onSystem={(d) => dispatch({ type: 'setSystemCursor', day: d })}
            />
          </div>

          <div className="planes">
            {planes.map((p) => (
              <div className="panel" key={p.attr}>
                <h3 style={{ marginBottom: 6 }}>{p.attr}</h3>
                <BitemporalPlane
                  attr={p.attr} rects={p.rects} divergence={p.divergence}
                  horizon={HORIZON} validCursor={validCursor} systemCursor={systemCursor}
                  colours={p.colours}
                  onPick={(v, s) => {
                    dispatch({ type: 'setValidCursor', day: v })
                    dispatch({ type: 'setSystemCursor', day: s })
                  }}
                />
              </div>
            ))}
          </div>

          {wrongAnywhere && (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)' }}>
              <span className="tag wrong">hatched</span>{' '}
              where the uninvalidated snapshot strategy disagrees with the truth. Click
              inside it — and note it is wrong about salary while manager is untouched,
              because the stale snapshot was taken when the manager changed.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

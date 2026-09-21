import { useReducer } from 'react'
import { HORIZON } from '../core/log'
import { initialState, reducer } from '../state'
import { Readout } from './Readout'
import { TwinTimelines } from './TwinTimelines'

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const { log, validCursor, systemCursor, clock } = state

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
        </div>
      </section>
    </div>
  )
}

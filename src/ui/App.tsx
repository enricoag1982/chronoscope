import { useReducer } from 'react'
import { HORIZON } from '../core/log'
import { STRATEGIES } from '../core/strategies/registry'
import { initialState, reducer } from '../state'
import { CostPanel } from './CostPanel'
import { Readout } from './Readout'
import { Sandbox } from './Sandbox'
import { StrategyRow } from './StrategyRow'
import { TwinTimelines } from './TwinTimelines'

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const { log, validCursor, systemCursor, clock, snapshotInterval } = state
  const config = { snapshotInterval }

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
          <Sandbox state={state} dispatch={dispatch} />
        </div>
      </section>

      <section className="band">
        <header>
          <h2>Representations</h2>
          <p>
            The same facts, stored five ways. Four are correct and disagree only
            about cost; the fifth is the shortcut people actually ship. Add a
            retroactive fact above and watch the rows react differently to it.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 10 }}>
          {STRATEGIES.map((strategy) => (
            <StrategyRow
              key={strategy.key} strategy={strategy} log={log} config={config}
              validCursor={validCursor} systemCursor={systemCursor} horizon={HORIZON}
            />
          ))}
        </div>
      </section>

      <section className="band">
        <header>
          <h2>Scale</h2>
          <p>
            Where each choice pays its complexity cost as history grows from a
            handful of facts to thousands.
          </p>
        </header>
        <CostPanel snapshotInterval={snapshotInterval} />
      </section>

      <footer style={{ borderTop: '1px solid var(--rule)', paddingTop: 14, fontSize: 12,
                       color: 'var(--ink-faint)' }}>
        Valid time and system time are the formal names for the two axes here,
        called “valid” and “recorded” throughout the interface.{' '}
        <a href="https://github.com/enricoag1982/chronoscope"
           style={{ color: 'var(--ink-soft)' }}>Source</a>.
      </footer>
    </div>
  )
}

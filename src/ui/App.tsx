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
          Most systems store one timestamp per fact and quietly assume we learn
          things the moment they happen. Reality disagrees constantly: a raise is
          approved in June and effective from March, a correction lands weeks after
          the mistake, a late invoice arrives against a quarter already closed.
        </p>
        <p>
          With one clock you can always say what is true now. What you cannot do is
          reproduce what you said last Tuesday — so every report you have already
          sent becomes unrepeatable, every “why did the system claim that?” becomes
          unanswerable, and a correction is indistinguishable from someone editing
          the past.
        </p>
        <p>
          Bitemporal modelling fixes that by keeping two clocks per fact: when it
          was true, and when we found out. This tool is about what that costs. The
          same history is stored five ways below — add a fact dated in the past and
          watch them diverge. Four stay correct and disagree only about the bill.
          The fifth is the shortcut most systems actually ship, and it starts
          returning wrong answers that nothing in the logs will point at.
        </p>
      </header>

      <section className="band">
        <header>
          <h2>Logical history</h2>
          <p>
            One timestamp answers “what was the salary on 1 May?”. Two are needed
            for “what would we have said on 1 June?” — and that second question is
            what audits, payroll restatements, regulatory reporting and most
            interesting bug reports are made of. Drag the upper axis to move through
            history; drag the lower one to move through what we knew.
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
            All five hold the same logical history, and if facts only ever arrived
            in order they would be hard to tell apart. Add one retroactive fact and
            they stop agreeing about cost — and one stops agreeing about the answer.
            Only hybrid has a knob; the others have no parameter to tune, which is
            itself part of what distinguishes them. This is where a design that
            never expected late facts turns painful:
            corrections stop being writes and become rebuilds, deleting a fact means
            deciding whether it was wrong or merely superseded, and a snapshot
            somebody forgot to invalidate quietly reverts a value forever.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 10 }}>
          {STRATEGIES.map((strategy) => (
            <StrategyRow
              key={strategy.key} strategy={strategy} log={log} config={config}
              validCursor={validCursor} systemCursor={systemCursor} horizon={HORIZON}
              control={strategy.key !== 'hybrid' ? undefined : (
                <>
                  <span style={{ color: 'var(--ink-faint)' }}>snapshot every</span>
                  <input
                    type="range" min={1} max={5} value={snapshotInterval} style={{ width: 92 }}
                    aria-label="hybrid snapshot interval"
                    onChange={(e) =>
                      dispatch({ type: 'setSnapshotInterval', every: Number(e.target.value) })}
                  />
                  <strong className="num">{snapshotInterval}</strong>
                  <span style={{ color: 'var(--ink-faint)' }}>events</span>
                </>
              )}
            />
          ))}
        </div>
      </section>

      <section className="band">
        <header>
          <h2>Scale</h2>
          <p>
            Four facts hide all of this — every strategy looks fine on a toy history.
            These are the shapes each choice takes as history grows into the
            thousands, and where the bill for a retroactive write actually lands.
          </p>
        </header>
        <CostPanel snapshotInterval={snapshotInterval} />
      </section>

      <footer style={{ borderTop: '1px solid var(--rule)', paddingTop: 14, fontSize: 12,
                       color: 'var(--ink-faint)' }}>
        The two axes are what the literature calls valid time and transaction time.{' '}
        <a href="https://github.com/enricoag1982/chronoscope"
           style={{ color: 'var(--ink-soft)' }}>Source</a>.
      </footer>
    </div>
  )
}

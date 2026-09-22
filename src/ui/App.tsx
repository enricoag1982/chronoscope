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
        <h1>Chronoscope: a bitemporal modeling playground</h1>
        <p className="lede">Two clocks per fact, and why one is never enough.</p>

        <div className="intro">
          <p>
            Bitemporal modeling is a data design approach that gives every fact two
            timestamps: when it became true in the world, and when the system
            recorded it. Facts are recorded rather than overwritten, so the store can
            answer both “what is true?” and “what did we believe, and when?”.
          </p>
          <p>
            Tax assessment is the standard example. An authority assesses you on the
            figures as they stood when you filed, not as they stand after later
            corrections. A store with one timestamp cannot reproduce that filing,
            because the values behind it have since changed. The same requirement
            appears in regulatory reporting, where a decision has to be explained
            against the data held at the time, and in incident review, where a bug and
            bad data are indistinguishable once the data has been corrected.
          </p>
          <p>
            The difficulty is in the primitives rather than the concept. Depending on
            how history is stored, a fact dated in the past can overwrite later
            changes, a materialised view can keep serving a value that was corrected
            months ago, and amending an entry can mean editing history in place, which
            removes the audit trail. None of these raise an error.
          </p>
          <p>
            This page stores one small history five ways. Drag the two clocks, add
            facts dated in the past, and compare what each representation costs and
            which one returns the wrong answer.
          </p>
        </div>
      </header>

      <section className="band">
        <header>
          <h2>Logical history</h2>
          <p>
            One timestamp answers “what was the salary on 1 May?”. Two are needed for
            “what would we have said on 1 June?”, which is the question audits,
            payroll restatements and regulatory reporting ask. Drag the upper axis to
            move through history; drag the lower one to move through what was known.
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
            All five hold the same logical history and are hard to tell apart while
            facts arrive in order. Add one retroactive fact and they diverge on cost,
            and one diverges on the answer. Only hybrid takes a parameter; the other
            four have nothing to tune. This is also where a design that did not
            anticipate late facts becomes expensive: corrections become rebuilds
            rather than writes, deleting a fact requires deciding whether it was wrong
            or merely superseded, and an uninvalidated snapshot keeps returning a
            superseded value indefinitely.
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
            Every strategy performs acceptably on four facts. These are the shapes
            each choice takes as history grows into the thousands, and where the cost
            of a retroactive write lands.
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

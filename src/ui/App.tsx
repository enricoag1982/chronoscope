import { useReducer } from 'react'
import { formatDayLong } from '../core/dates'
import { initialState, reducer } from '../state'

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  return (
    <div className="app">
      <header className="masthead">
        <h1>Chronoscope</h1>
        <p>
          The same facts, applied to five representations of history. Once knowledge
          of the past can change, how you store it stops being an implementation
          detail.
        </p>
      </header>

      <section className="band">
        <header>
          <h2>Logical history</h2>
          <p>
            Valid time {formatDayLong(state.validCursor)} · recorded as of{' '}
            {formatDayLong(state.systemCursor)}
          </p>
        </header>
        <div className="panel">
          <p style={{ margin: 0, color: 'var(--ink-faint)' }}>
            {state.log.length} facts. Clock at {formatDayLong(state.clock)}.
          </p>
          <button style={{ marginTop: 12 }} onClick={() => dispatch({ type: 'reset' })}>
            Reset
          </button>
        </div>
      </section>
    </div>
  )
}

import { formatDay } from '../../core/dates'
import type { Day, Fact } from '../../core/types'
import type { EventLogState } from '../../core/strategies/events'
import { show } from '../Readout'

/**
 * The whole append-only log, in stored order. Nothing is derived — the point
 * of this renderer is that there is nothing to derive, only a replay cost paid
 * at read time. Facts not yet recorded at the system cursor are dimmed rather
 * than hidden, matching TwinTimelines.
 */
export function EventList({
  state, systemCursor,
}: { state: EventLogState; systemCursor: Day }) {
  if (state.facts.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>no facts</div>
  }

  return (
    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr><th>attr</th><th>value</th><th>valid</th><th>system</th></tr>
        </thead>
        <tbody>
          {state.facts.map((f: Fact) => (
            <tr key={f.id} style={{ opacity: f.systemTime > systemCursor ? 0.35 : 1 }}>
              <td>{f.attr}</td>
              <td className="num">{show(f.value)}</td>
              <td>{formatDay(f.validFrom)}</td>
              <td>{formatDay(f.systemTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

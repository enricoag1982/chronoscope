import { formatDay } from '../../core/dates'
import { referenceQuery } from '../../core/reference'
import { ATTRS, INF } from '../../core/types'
import type { Day, Fact } from '../../core/types'
import type { Snapshot } from '../../core/strategies/snapshots'
import { show } from '../Readout'

/** The shape shared by snapshots.ts, hybrid.ts and snapshotStale.ts. */
export type SnapshotLikeState = { log: Fact[]; snapshots: Snapshot[]; seq: number }

/**
 * Every snapshot this strategy has ever stored, oldest valid-time first. Open
 * snapshots (still current in system time) render solid; closed ones fade but
 * stay, same convention as IntervalRows.
 *
 * "recorded" shows only systemFrom — the moment this snapshot was written,
 * which is what a column headed "system" should mean. A superseded snapshot
 * is not dropped: it stays queryable at an earlier system time, which is the
 * strategy's whole point, so it is called out with an explicit "superseded
 * <date>" status instead of being presented as an open-ended range.
 *
 * With `checkStale`, an open snapshot whose stored values disagree with the
 * oracle at (its validAt, systemCursor) is marked — that is snapshotStale's
 * bug made visible in the storage itself, not only in the answer it returns.
 */
export function SnapshotStack({
  state, systemCursor, checkStale,
}: { state: SnapshotLikeState; systemCursor: Day; checkStale: boolean }) {
  const snaps = [...state.snapshots].sort(
    (a, b) => a.validAt - b.validAt || a.systemFrom - b.systemFrom,
  )
  if (snaps.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>no snapshots</div>
  }

  return (
    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>valid at</th>
            {ATTRS.map((a) => <th key={a}>{a}</th>)}
            <th>recorded</th>
            <th>status</th>
          </tr>
        </thead>
        <tbody>
          {snaps.map((s) => {
            const open = s.systemTo === INF
            const stale = checkStale && open && ATTRS.some(
              (a) => s.state[a] !== referenceQuery(state.log, a, s.validAt, systemCursor),
            )
            return (
              <tr key={s.id} style={{ opacity: open ? 1 : 0.4 }}>
                <td>
                  {formatDay(s.validAt)}
                  {stale && <span className="tag wrong" style={{ marginLeft: 6 }}>stale</span>}
                </td>
                {ATTRS.map((a) => <td key={a} className="num">{show(s.state[a])}</td>)}
                <td className="num">{formatDay(s.systemFrom)}</td>
                <td>{open ? '' : `superseded ${formatDay(s.systemTo)}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

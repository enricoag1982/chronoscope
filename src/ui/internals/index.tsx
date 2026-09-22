import type { ReactNode } from 'react'
import type { Day } from '../../core/types'
import type { EventLogState } from '../../core/strategies/events'
import type { IntervalState } from '../../core/strategies/intervals'
import { EventList } from './EventList'
import { IntervalRows } from './IntervalRows'
import { SnapshotStack } from './SnapshotStack'
import type { SnapshotLikeState } from './SnapshotStack'

export type InternalsProps = {
  horizon: { start: Day; end: Day }
  validCursor: Day
  systemCursor: Day
}

/**
 * Picks the renderer for a strategy's own state shape. One entry per key in
 * the registry; an unknown key renders nothing rather than guessing at a
 * shape it was not built to read.
 */
export function renderInternals(key: string, state: unknown, props: InternalsProps): ReactNode {
  switch (key) {
    case 'events':
      return <EventList state={state as EventLogState} systemCursor={props.systemCursor} />
    case 'intervals':
      return <IntervalRows state={state as IntervalState} horizon={props.horizon} />
    case 'snapshots':
    case 'hybrid':
      return (
        <SnapshotStack
          state={state as SnapshotLikeState} systemCursor={props.systemCursor} checkStale={false}
        />
      )
    case 'snapshotStale':
      return (
        <SnapshotStack
          state={state as SnapshotLikeState} systemCursor={props.systemCursor} checkStale
        />
      )
    default:
      return null
  }
}

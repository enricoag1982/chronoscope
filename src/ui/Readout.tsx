import { formatDayLong } from '../core/dates'
import { referenceQuery } from '../core/reference'
import { ATTRS } from '../core/types'
import type { Day, Fact, Value } from '../core/types'

export const show = (v: Value | undefined) =>
  v === undefined ? '—' : typeof v === 'number' ? v.toLocaleString('en-GB') : v

/**
 * Both attributes at once. A single fact only ever moves one of them, so
 * watching manager hold still while salary rewrites itself under a dragged
 * cursor is most of the lesson — and it is the contrast a second view would
 * have cost a whole panel to make.
 */
export function Readout({
  log, validCursor, systemCursor,
}: { log: readonly Fact[]; validCursor: Day; systemCursor: Day }) {
  return (
    <div className="panel" style={{ display: 'flex', gap: 44, alignItems: 'flex-end' }}>
      {ATTRS.map((attr) => (
        <div key={attr}>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{attr}</div>
          <div className="num" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15 }}>
            {show(referenceQuery(log, attr, validCursor, systemCursor))}
          </div>
        </div>
      ))}
      <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--ink-soft)', textAlign: 'right' }}>
        valid {formatDayLong(validCursor)}
        <br />
        as recorded on {formatDayLong(systemCursor)}
      </div>
    </div>
  )
}

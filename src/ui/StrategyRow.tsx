import { referenceQuery } from '../core/reference'
import { materialize, NO_OPS } from '../core/strategies/index'
import type { Config } from '../core/strategies/index'
import type { AnyStrategy } from '../core/strategies/registry'
import { ATTRS } from '../core/types'
import type { Day, Fact } from '../core/types'
import { renderInternals } from './internals/index'
import { seriesColour } from './palette'
import { show } from './Readout'

type Props = {
  strategy: AnyStrategy
  log: readonly Fact[]
  config: Config
  validCursor: Day
  systemCursor: Day
  horizon: { start: Day; end: Day }
}

/**
 * One strategy's full answer to the same two questions every other row is
 * asked, plus what it cost and what it is holding onto internally. The
 * disagreement marker is the entire point of the tool, so it is the one thing
 * here allowed to be loud.
 */
export function StrategyRow({ strategy, log, config, validCursor, systemCursor, horizon }: Props) {
  const { state } = materialize(strategy, log, config)

  const lastFact = log.length > 0 ? log[log.length - 1]! : undefined
  const lastOps = lastFact === undefined
    ? NO_OPS
    : strategy.apply(materialize(strategy, log.slice(0, -1), config).state, lastFact, config).ops

  const size = strategy.size(state)

  return (
    <div className="panel" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span aria-hidden style={{
          width: 3, minHeight: 34, alignSelf: 'stretch', borderRadius: 2,
          background: seriesColour(strategy.key),
        }} />

        <div style={{ minWidth: 172 }}>
          <div style={{ fontWeight: 600 }}>{strategy.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{strategy.blurb}</div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {ATTRS.map((attr) => {
            const got = strategy.query(state, attr, validCursor, systemCursor)
            const oracle = referenceQuery(log, attr, validCursor, systemCursor)
            const agree = got === oracle
            return (
              <div key={attr}>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{attr}</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 600 }}>
                  {show(got)}
                  {agree ? (
                    <span style={{ color: 'var(--ok)', marginLeft: 6 }} title="agrees with the oracle">
                      ok
                    </span>
                  ) : (
                    <span className="tag wrong" style={{ marginLeft: 6 }}>oracle {show(oracle)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', fontSize: 12, color: 'var(--ink-soft)' }}>
          <OpStat label="written" value={lastOps.written} />
          <OpStat label="rewritten" value={lastOps.rewritten} />
          <OpStat label="invalidated" value={lastOps.invalidated} />
          <OpStat label="records" value={size} />
        </div>
      </div>

      <div>{renderInternals(strategy.key, state, { horizon, validCursor, systemCursor })}</div>
    </div>
  )
}

function OpStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{label}</div>
      <div className="num">{value.toLocaleString('en-GB')}</div>
    </div>
  )
}

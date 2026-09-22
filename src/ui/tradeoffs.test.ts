import { describe, expect, it } from 'vitest'
import { STRATEGIES } from '../core/strategies/registry'
import { TRADEOFFS } from './tradeoffs'

describe('tradeoffs', () => {
  it('covers every registered strategy', () => {
    for (const s of STRATEGIES) expect(TRADEOFFS[s.key], s.key).toBeDefined()
  })

  it('does not describe strategies that do not exist', () => {
    const keys = new Set(STRATEGIES.map((s) => s.key))
    for (const key of Object.keys(TRADEOFFS)) expect(keys.has(key), key).toBe(true)
  })

  it('gives every strategy something against it, including the correct ones', () => {
    for (const s of STRATEGIES) {
      expect(TRADEOFFS[s.key]!.against.length, s.key).toBeGreaterThan(0)
    }
  })

  it('says plainly that the incorrect strategy is wrong', () => {
    const incorrect = STRATEGIES.filter((s) => !s.correct)
    expect(incorrect.length).toBeGreaterThan(0)
    for (const s of incorrect) {
      const text = TRADEOFFS[s.key]!.against.join(' ').toLowerCase()
      expect(text).toContain('wrong')
    }
  })
})

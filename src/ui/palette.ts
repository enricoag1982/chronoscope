import type { Value } from '../core/types'

/**
 * Colour is assigned by the job it does, and the categorical set is validated
 * rather than chosen by eye: these three hues clear every all-pairs gate on a
 * light surface (worst colour-vision-deficient separation 9.2, worst
 * normal-vision 24.0). Three is the cap for all-pairs work — a fourth slot puts
 * yellow beside orange and fails — which is why the generated histories draw
 * from three managers.
 *
 * Aqua sits below 3:1 against the surface, so the relief rule applies: every
 * region on the plane carries a visible label, and colour never has to be read
 * on its own.
 */
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a'] as const

/** Single hue, light to dark — magnitude, not identity. */
export const SEQUENTIAL = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
  '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
] as const

export const NO_VALUE = '#f3f2ef'

/**
 * Colour follows the entity, never its rank in the current view. Both scales
 * are built from the whole log, so dragging a cursor never repaints a value
 * that did not change — which would read as data changing when only the
 * viewport did.
 */
export type ValueColours = (value: Value | undefined) => string

export function coloursFor(allValues: readonly Value[]): ValueColours {
  const numbers = allValues.filter((v): v is number => typeof v === 'number')
  const strings = [...new Set(allValues.filter((v): v is string => typeof v === 'string'))].sort()

  const lo = Math.min(...numbers)
  const hi = Math.max(...numbers)

  return (value) => {
    if (value === undefined) return NO_VALUE
    if (typeof value === 'number') {
      if (numbers.length === 0) return SEQUENTIAL[6]!
      const t = hi === lo ? 0.5 : (value - lo) / (hi - lo)
      const i = Math.round(t * (SEQUENTIAL.length - 1))
      return SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.max(0, i))]!
    }
    const i = strings.indexOf(value)
    // Past the validated three, fall back to ink rather than inventing a hue.
    return i >= 0 && i < CATEGORICAL.length ? CATEGORICAL[i]! : '#55534e'
  }
}

/** Dark fills need light text. Rough luminance is enough for this decision. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const lum = (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255
  return lum > 0.6 ? '#1a1a19' : '#ffffff'
}

/**
 * Line-series hues for the cost curves, in fixed slot order. Validated on the
 * adjacent pairlist that line charts use: worst colour-vision-deficient
 * separation 9.1, worst normal-vision 19.6, both clear. Three of the five sit
 * below 3:1 against the surface, so the relief rule applies — every line
 * carries a direct label at its right end and the panel ships a table view.
 *
 * Keyed by strategy rather than by position in the current chart, so hiding a
 * series never repaints the ones that remain.
 */
export const SERIES: Record<string, string> = {
  events: '#2a78d6',
  intervals: '#eb6834',
  snapshots: '#1baf7a',
  hybrid: '#eda100',
  snapshotStale: '#e87ba4',
}

export const seriesColour = (key: string): string => SERIES[key] ?? '#55534e'

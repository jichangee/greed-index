import type { IndicatorData, Signal } from '@/types/indicator'

export function normalize(
  value: number,
  [min, max]: [number, number],
  inverse = false
): number {
  const clamped = Math.min(Math.max(value, min), max)
  const normalized = (clamped - min) / (max - min)
  return inverse ? 1 - normalized : normalized
}

export function getSignal(totalScore: number): Signal {
  if (totalScore <= 0.35) return 'LOW'
  if (totalScore <= 0.65) return 'MEDIUM'
  return 'HIGH'
}

function scorePart(value: number | null | undefined, range: [number, number], weight: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return weight * 0.5
  return normalize(value, range) * weight
}

export function calculateScore(data: IndicatorData): { totalScore: number; signal: Signal } {
  const rateDividendSpread =
    data.bondYield !== null && data.dividendYield !== null && data.dividendYield !== undefined
      ? data.bondYield - data.dividendYield
      : null

  const totalPoints =
    scorePart(data.cape, [20, 35], 25) +
    scorePart(data.pe, [16, 30], 15) +
    scorePart(data.bondYield, [3, 4.5], 20) +
    scorePart(rateDividendSpread, [1, 3], 15) +
    scorePart(data.vix, [12, 35], 25)

  const totalScore = totalPoints / 100
  return { totalScore, signal: getSignal(totalScore) }
}

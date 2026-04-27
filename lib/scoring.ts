import type { IndicatorData, ScoreResult } from '@/types/indicator'

export function normalize(
  value: number,
  [min, max]: [number, number],
  inverse = false
): number {
  const clamped = Math.min(Math.max(value, min), max)
  const normalized = (clamped - min) / (max - min)
  return inverse ? 1 - normalized : normalized
}

export function getSignal(
  totalScore: number
): 'BUY' | 'HOLD' | 'SELL' | 'DANGER' {
  if (totalScore < 0.35) return 'BUY'
  if (totalScore < 0.55) return 'HOLD'
  if (totalScore < 0.75) return 'SELL'
  return 'DANGER'
}

export function calculateScore(data: IndicatorData): ScoreResult {
  const valuationScore =
    normalize(data.pe, [10, 35]) * 0.4 +
    normalize(data.ps, [2, 10]) * 0.3 +
    normalize(data.bondYield - data.earningsYield, [-3, 2]) * 0.3

  const macroScore =
    normalize(data.bondYield, [1, 5]) * 0.6 +
    normalize(data.vix, [10, 40], true) * 0.4

  const sentimentScore =
    normalize(data.rsi, [30, 80]) * 0.6 +
    normalize(data.vix, [10, 40], true) * 0.4

  const totalScore =
    valuationScore * 0.45 +
    macroScore * 0.35 +
    sentimentScore * 0.2

  return {
    valuationScore,
    macroScore,
    sentimentScore,
    totalScore,
    signal: getSignal(totalScore),
  }
}

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
  if (totalScore < 0.35) return 'BUY'
  if (totalScore < 0.55) return 'HOLD'
  if (totalScore < 0.75) return 'SELL'
  return 'DANGER'
}

export function calculateScore(data: IndicatorData): { totalScore: number; signal: Signal } {
  const valuationScore =
    normalize(data.pe, [10, 35]) * 0.55 +
    normalize(data.bondYield - data.earningsYield, [-3, 2]) * 0.45

  const macroScore =
    normalize(data.bondYield, [1, 5]) * 0.6 +
    normalize(data.vix, [10, 40], true) * 0.4

  const sentimentScore =
    normalize(data.rsi, [30, 80]) * 0.35 +
    normalize(data.stochastic, [20, 80]) * 0.35 +
    normalize(data.weekPosition52, [0.2, 0.95]) * 0.3

  const totalScore =
    valuationScore * 0.45 +
    macroScore * 0.30 +
    sentimentScore * 0.25

  return { totalScore, signal: getSignal(totalScore) }
}

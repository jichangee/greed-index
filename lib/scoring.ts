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

function weightedAverage(parts: { value: number | null | undefined; weight: number }[]): number {
  let weighted = 0
  let weights = 0

  for (const part of parts) {
    if (part.value === null || part.value === undefined || !Number.isFinite(part.value)) continue
    weighted += part.value * part.weight
    weights += part.weight
  }

  return weights > 0 ? weighted / weights : 0.5
}

export function normalizeVxSpread(value: number): number {
  if (value <= -3) return 0
  if (value < 0) return normalize(value, [-3, 0]) * 0.55
  return 0.55 + normalize(value, [0, 2.5]) * 0.45
}

export function calculateScore(data: IndicatorData): { totalScore: number; signal: Signal } {
  const yieldGap =
    data.bondYield !== null && data.earningsYield !== null
      ? data.bondYield - data.earningsYield
      : null

  const valuationScore = weightedAverage([
    { value: data.cape === null ? null : normalize(data.cape, [22, 45]), weight: 0.4 },
    { value: data.pe === null ? null : normalize(data.pe, [16, 35]), weight: 0.35 },
    { value: yieldGap === null ? null : normalize(yieldGap, [-1.5, 2.5]), weight: 0.25 },
  ])

  const ratesScore = weightedAverage([
    { value: data.bondYield === null ? null : normalize(data.bondYield, [2.5, 5.5]), weight: 0.65 },
    { value: yieldGap === null ? null : normalize(yieldGap, [-1.5, 2.5]), weight: 0.35 },
  ])

  const volatilityScore = weightedAverage([
    { value: data.vxSpread === null ? null : normalizeVxSpread(data.vxSpread), weight: 0.6 },
    { value: data.vix === null ? null : normalize(data.vix, [12, 35]), weight: 0.4 },
  ])

  const totalScore =
    valuationScore * 0.35 +
    ratesScore * 0.20 +
    volatilityScore * 0.45

  return { totalScore, signal: getSignal(totalScore) }
}

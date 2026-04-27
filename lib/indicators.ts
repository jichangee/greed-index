import type { DailyBar } from '@/lib/twelvedata'

function assertNonEmpty<T>(arr: T[], name: string): asserts arr is [T, ...T[]] {
  if (!arr.length) throw new Error(`${name} is empty`)
}

/**
 * Finds the first bar at or before dateIso. Bars must be sorted most-recent-first.
 */
export function alignBarsAsOf(barsDesc: DailyBar[], dateIso: string): { asOfDate: string; barsAsOfDesc: DailyBar[] } {
  assertNonEmpty(barsDesc, 'bars')

  const idx = barsDesc.findIndex((b) => b.datetime <= dateIso)
  if (idx === -1) throw new Error(`No bars at or before ${dateIso}`)

  const barsAsOfDesc = barsDesc.slice(idx)
  assertNonEmpty(barsAsOfDesc, 'barsAsOf')
  return { asOfDate: barsAsOfDesc[0].datetime, barsAsOfDesc }
}

/**
 * Computes RSI using Wilder's smoothing (standard RSI-14).
 * Input closes must be ordered oldest->newest.
 */
export function computeRsi(closesAsc: number[], period = 14): number {
  if (period <= 0) throw new Error('RSI period must be > 0')
  if (closesAsc.length < period + 1) throw new Error(`Not enough closes for RSI-${period}`)

  let gainSum = 0
  let lossSum = 0

  for (let i = 1; i <= period; i++) {
    const diff = closesAsc[i] - closesAsc[i - 1]
    if (diff >= 0) gainSum += diff
    else lossSum += -diff
  }

  let avgGain = gainSum / period
  let avgLoss = lossSum / period

  for (let i = period + 1; i < closesAsc.length; i++) {
    const diff = closesAsc[i] - closesAsc[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  const rsi = 100 - 100 / (1 + rs)
  if (!Number.isFinite(rsi)) throw new Error('RSI computed as non-finite')
  return rsi
}

/**
 * Computes Stochastic %K over lookback period.
 * Input arrays must be ordered oldest->newest.
 */
export function computeStochK(highsAsc: number[], lowsAsc: number[], closesAsc: number[], lookback = 14): number {
  if (lookback <= 1) throw new Error('Stoch lookback must be > 1')
  if (highsAsc.length !== lowsAsc.length || highsAsc.length !== closesAsc.length)
    throw new Error('Stoch arrays length mismatch')
  if (closesAsc.length < lookback) throw new Error(`Not enough bars for Stoch-${lookback}`)

  const start = closesAsc.length - lookback
  let highestHigh = -Infinity
  let lowestLow = Infinity

  for (let i = start; i < closesAsc.length; i++) {
    highestHigh = Math.max(highestHigh, highsAsc[i])
    lowestLow = Math.min(lowestLow, lowsAsc[i])
  }

  const close = closesAsc[closesAsc.length - 1]
  const denom = highestHigh - lowestLow
  if (denom === 0) return 50
  const k = ((close - lowestLow) / denom) * 100
  if (!Number.isFinite(k)) throw new Error('Stoch %K computed as non-finite')
  return k
}

/**
 * Computes price position within the trailing window (typically 252 trading days).
 * barsAsc ordered oldest->newest; window must be <= barsAsc.length.
 */
export function computeWindowPosition(
  barsAsc: DailyBar[],
  window = 252
): { position: number; low: number; high: number } {
  if (window <= 1) throw new Error('window must be > 1')
  if (barsAsc.length < window) throw new Error(`Not enough bars for ${window}-day window`)

  const slice = barsAsc.slice(barsAsc.length - window)
  let low = Infinity
  let high = -Infinity
  for (const b of slice) {
    low = Math.min(low, b.low)
    high = Math.max(high, b.high)
  }
  const close = barsAsc[barsAsc.length - 1].close
  const denom = high - low
  const position = denom === 0 ? 0.5 : (close - low) / denom
  if (!Number.isFinite(position)) throw new Error('window position computed as non-finite')
  return { position, low, high }
}


import { calculateScore } from '@/lib/scoring'
import { getQuote } from '@/lib/finnhub'
import { getDailyBars } from '@/lib/twelvedata'
import { getTenYearYield, getTenYearYieldAt, getVix, getVixAt } from '@/lib/fred'
import { alignBarsAsOf, computeRsi, computeStochK, computeWindowPosition } from '@/lib/indicators'
import { getSp500PeAt } from '@/lib/multpl'
import type { IndicatorData, MarketResponse } from '@/types/indicator'

const CACHE_TTL_MS = 5 * 60 * 1000
const SYMBOL = 'SPY'

let cache: { data: MarketResponse; expiresAt: number } | null = null

function parseDateParam(url: URL): string | null {
  const date = url.searchParams.get('date')
  if (!date) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date query param. Expected YYYY-MM-DD')
  return date
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  let dateIso: string | null = null
  try {
    dateIso = parseDateParam(url)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    )
  }

  // Keep existing behavior/caching for "latest".
  if (!dateIso) {
    if (cache && Date.now() < cache.expiresAt) {
      return Response.json(cache.data)
    }
  }

  try {
    if (!dateIso) {
      const [spyQuote, bondYield, vix] = await Promise.all([
        getQuote(SYMBOL),
        getTenYearYield(),
        getVix(),
      ])

      // For latest, compute indicators consistently with backtest, aligned to today's date.
      const todayIso = new Date().toISOString().slice(0, 10)
      const bars = await getDailyBars(SYMBOL, todayIso, 320)
      const { asOfDate, barsAsOfDesc } = alignBarsAsOf(bars, todayIso)
      const barsAsOfAsc = [...barsAsOfDesc].reverse()

      const closesAsc = barsAsOfAsc.map((b) => b.close)
      const highsAsc = barsAsOfAsc.map((b) => b.high)
      const lowsAsc = barsAsOfAsc.map((b) => b.low)

      const price = spyQuote.c
      const rsi = computeRsi(closesAsc, 14)
      const stochastic = computeStochK(highsAsc, lowsAsc, closesAsc, 14)
      const { position: weekPosition52 } = computeWindowPosition(barsAsOfAsc, 252)

      // PE: use Multpl S&P500 PE (<= asOfDate) for both latest & replay.
      const pe = await getSp500PeAt(asOfDate)

      // Keep existing API minimal for "latest" view.
      const raw = { pe, bondYield, vix, price }
      for (const [key, val] of Object.entries(raw)) {
        if (!Number.isFinite(val)) throw new Error(`Non-finite value for ${key}: ${val}`)
      }

      const indicatorData: IndicatorData = {
        pe,
        earningsYield: (1 / pe) * 100,
        bondYield,
        vix,
        rsi,
        stochastic,
        weekPosition52,
        price,
      }

      const { totalScore, signal } = calculateScore(indicatorData)

      const response: MarketResponse = {
        totalScore,
        signal,
        cachedAt: new Date().toISOString(),
      }

      cache = { data: response, expiresAt: Date.now() + CACHE_TTL_MS }
      return Response.json(response)
    }

    // Backtest / replay path for a specific date.
    const barsDesc = await getDailyBars(SYMBOL, dateIso, 320)
    const { asOfDate, barsAsOfDesc } = alignBarsAsOf(barsDesc, dateIso)
    const barsAsOfAsc = [...barsAsOfDesc].reverse()

    const closesAsc = barsAsOfAsc.map((b) => b.close)
    const highsAsc = barsAsOfAsc.map((b) => b.high)
    const lowsAsc = barsAsOfAsc.map((b) => b.low)

    const price = barsAsOfAsc[barsAsOfAsc.length - 1].close
    const rsi = computeRsi(closesAsc, 14)
    const stochastic = computeStochK(highsAsc, lowsAsc, closesAsc, 14)
    const { position: weekPosition52 } = computeWindowPosition(barsAsOfAsc, 252)

    const [bondYield, vix] = await Promise.all([
      getTenYearYieldAt(asOfDate),
      getVixAt(asOfDate),
    ])

    const pe = await getSp500PeAt(asOfDate)
    const peSource: 'multpl' = 'multpl'

    const raw = { pe, bondYield, vix, rsi, stochastic, weekPosition52, price }
    for (const [key, val] of Object.entries(raw)) {
      if (!Number.isFinite(val)) throw new Error(`Non-finite value for ${key}: ${val}`)
    }

    const indicatorData: IndicatorData = {
      pe,
      earningsYield: (1 / pe) * 100,
      bondYield,
      vix,
      rsi,
      stochastic,
      weekPosition52,
      price,
    }

    const { totalScore, signal } = calculateScore(indicatorData)

    const response: MarketResponse & {
      asOfDate: string
      inputs: IndicatorData
      meta: { peSource: 'multpl' | 'twelvedata_latest_fallback' }
    } = {
      totalScore,
      signal,
      cachedAt: new Date().toISOString(),
      asOfDate,
      inputs: indicatorData,
      meta: { peSource },
    }

    return Response.json(response)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch market data' },
      { status: 500 }
    )
  }
}

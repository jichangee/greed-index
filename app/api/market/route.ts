import { calculateScore } from '@/lib/scoring'
import { getDailyBars } from '@/lib/twelvedata'
import { getTenYearYield, getTenYearYieldAt, getVix, getVixAt } from '@/lib/fred'
import { alignBarsAsOf, computeRsi, computeStochK, computeWindowPosition } from '@/lib/indicators'
import {
  getShillerPeAt,
  getSp500DividendYieldAt,
  getSp500EarningsYieldAt,
  getSp500PeAt,
  getTenYearTreasuryRateAt,
} from '@/lib/multpl'
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
      const todayIso = new Date().toISOString().slice(0, 10)
      const [cape, pe, earningsYield, dividendYield, multplBondYield, fredBondYield, vix] = await Promise.all([
        getShillerPeAt(todayIso),
        getSp500PeAt(todayIso),
        getSp500EarningsYieldAt(todayIso),
        getSp500DividendYieldAt(todayIso),
        getTenYearTreasuryRateAt(todayIso),
        getTenYearYield().catch(() => null),
        getVix().catch(() => null),
      ])

      const bondYield = fredBondYield ?? multplBondYield

      const indicatorData: IndicatorData = {
        cape,
        pe,
        earningsYield,
        dividendYield,
        bondYield,
        vix,
        vxSpread: null,
        rsi: null,
        stochastic: null,
        weekPosition52: null,
        price: null,
      }

      const { totalScore, signal } = calculateScore(indicatorData)

      const response: MarketResponse = {
        totalScore,
        signal,
        cachedAt: new Date().toISOString(),
        asOfDate: todayIso,
        inputs: indicatorData,
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

    const [cape, pe, earningsYield, dividendYield] = await Promise.all([
      getShillerPeAt(asOfDate),
      getSp500PeAt(asOfDate),
      getSp500EarningsYieldAt(asOfDate),
      getSp500DividendYieldAt(asOfDate),
    ])
    const peSource = 'multpl' as const

    const raw = { cape, pe, earningsYield, dividendYield, bondYield, vix, rsi, stochastic, weekPosition52, price }
    for (const [key, val] of Object.entries(raw)) {
      if (!Number.isFinite(val)) throw new Error(`Non-finite value for ${key}: ${val}`)
    }

    const indicatorData: IndicatorData = {
      cape,
      pe,
      earningsYield,
      dividendYield,
      bondYield,
      vix,
      vxSpread: null,
      rsi,
      stochastic,
      weekPosition52,
      price,
    }

    const { totalScore, signal } = calculateScore(indicatorData)

    const response: MarketResponse & {
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

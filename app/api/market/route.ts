import { calculateScore } from '@/lib/scoring'
import { getQuote } from '@/lib/finnhub'
import { getRsi, getNdxPe, getStochastic, get52WeekPosition } from '@/lib/twelvedata'
import { getTenYearYield, getVix } from '@/lib/fred'
import type { IndicatorData, MarketResponse } from '@/types/indicator'

const CACHE_TTL_MS = 5 * 60 * 1000

let cache: { data: MarketResponse; expiresAt: number } | null = null

export async function GET() {
  if (cache && Date.now() < cache.expiresAt) {
    return Response.json(cache.data)
  }

  try {
    const [qqqQuote, rsi, stochastic, weekPosition52, bondYield, vix, pe] = await Promise.all([
      getQuote('QQQ'),
      getRsi('QQQ'),
      getStochastic('QQQ'),
      get52WeekPosition('QQQ'),
      getTenYearYield(),
      getVix(),
      getNdxPe(),
    ])

    const raw = { pe, bondYield, vix, rsi, stochastic, weekPosition52, price: qqqQuote.c }
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
      price: qqqQuote.c,
    }

    const { totalScore, signal } = calculateScore(indicatorData)

    const response: MarketResponse = {
      totalScore,
      signal,
      cachedAt: new Date().toISOString(),
    }

    cache = { data: response, expiresAt: Date.now() + CACHE_TTL_MS }
    return Response.json(response)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch market data' },
      { status: 500 }
    )
  }
}

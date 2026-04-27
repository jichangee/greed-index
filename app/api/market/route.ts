import { calculateScore } from '@/lib/scoring'
import { getQuote, getRsi } from '@/lib/finnhub'
import type { IndicatorData, MarketResponse } from '@/types/indicator'

// Fixed mock values — Finnhub free tier does not provide NASDAQ100 aggregate PE/PS
const MOCK_PE = 28
const MOCK_PS = 6
const MOCK_BOND_YIELD = 4.2

const CACHE_TTL_MS = 5 * 60 * 1000

let cache: { data: MarketResponse; expiresAt: number } | null = null

export async function GET() {
  if (cache && Date.now() < cache.expiresAt) {
    return Response.json(cache.data)
  }

  try {
    const [qqqQuote, vixQuote, rsiData] = await Promise.all([
      getQuote('QQQ'),
      getQuote('^VIX').catch(() => ({ c: 20 })), // fallback: VIX may be unavailable on free tier
      getRsi('QQQ'),
    ])

    const pe = MOCK_PE
    const ps = MOCK_PS
    const bondYield = MOCK_BOND_YIELD
    const earningsYield = (1 / pe) * 100
    const price = qqqQuote.c
    const vix = vixQuote.c
    const latestRsi = rsiData.rsi[rsiData.rsi.length - 1]
    const rsi = latestRsi ?? 50 // fallback to neutral if RSI unavailable

    const indicatorData: IndicatorData = {
      pe,
      ps,
      earningsYield,
      bondYield,
      vix,
      rsi,
      price,
    }

    const scores = calculateScore(indicatorData)

    const response: MarketResponse = {
      ...indicatorData,
      ...scores,
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

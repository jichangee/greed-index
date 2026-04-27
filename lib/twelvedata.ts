const BASE_URL = 'https://api.twelvedata.com'

interface StatisticsResponse {
  statistics: {
    valuations_metrics: {
      trailing_pe: number | null
    }
  }
}

interface RsiResponse {
  values: { rsi: string }[]
  status: string
}

interface StochResponse {
  values: { slow_k: string; slow_d: string }[]
  status: string
}

interface QuoteResponse {
  close: string
  fifty_two_week: {
    low: string
    high: string
  }
}

async function tdGet<T>(path: string): Promise<T> {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) throw new Error('TWELVE_DATA_API_KEY is not configured')

  const res = await fetch(`${BASE_URL}${path}&apikey=${apiKey}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Twelve Data request failed: ${res.status}`)
  return res.json() as Promise<T>
}

/** Returns RSI-14 (daily) for the given symbol */
export async function getRsi(symbol: string): Promise<number> {
  const data = await tdGet<RsiResponse>(
    `/rsi?symbol=${encodeURIComponent(symbol)}&interval=1day&time_period=14&outputsize=1`
  )
  if (data.status !== 'ok' || !data.values?.[0]) throw new Error(`Twelve Data: RSI not available for ${symbol}`)
  const value = parseFloat(data.values[0].rsi)
  if (!Number.isFinite(value)) throw new Error(`Twelve Data: invalid RSI value "${data.values[0].rsi}"`)
  return value
}

/** Returns Stochastic slow_k (daily, 14-period) for the given symbol */
export async function getStochastic(symbol: string): Promise<number> {
  const data = await tdGet<StochResponse>(
    `/stoch?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=1`
  )
  if (data.status !== 'ok' || !data.values?.[0]) throw new Error(`Twelve Data: Stochastic not available for ${symbol}`)
  const value = parseFloat(data.values[0].slow_k)
  if (!Number.isFinite(value)) throw new Error(`Twelve Data: invalid Stochastic value "${data.values[0].slow_k}"`)
  return value
}

/** Returns price position within the 52-week range: 0 = at 52w low, 1 = at 52w high */
export async function get52WeekPosition(symbol: string): Promise<number> {
  const data = await tdGet<QuoteResponse>(`/quote?symbol=${encodeURIComponent(symbol)}`)
  const price = parseFloat(data.close)
  const low = parseFloat(data.fifty_two_week.low)
  const high = parseFloat(data.fifty_two_week.high)
  if (!Number.isFinite(price) || !Number.isFinite(low) || !Number.isFinite(high))
    throw new Error(`Twelve Data: invalid quote data for ${symbol}`)
  return (price - low) / (high - low)
}

/** Returns the trailing PE ratio for QQQ (NASDAQ-100 proxy) */
export async function getNdxPe(): Promise<number> {
  const data = await tdGet<StatisticsResponse>('/statistics?symbol=QQQ')
  const pe = data.statistics?.valuations_metrics?.trailing_pe
  if (pe === null || pe === undefined) throw new Error('Twelve Data: trailing_pe not available for QQQ')
  return pe
}

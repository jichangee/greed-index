const BASE_URL = 'https://finnhub.io/api/v1'

interface QuoteResponse {
  c: number
}

interface RsiResponse {
  rsi: number[]
  s: string
}

async function finnhubGet<T>(path: string): Promise<T> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) throw new Error('FINNHUB_API_KEY is not configured')

  const res = await fetch(`${BASE_URL}${path}&token=${apiKey}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Finnhub request failed: ${res.status}`)
  return res.json() as Promise<T>
}

export async function getQuote(symbol: string): Promise<QuoteResponse> {
  return finnhubGet<QuoteResponse>(`/quote?symbol=${encodeURIComponent(symbol)}`)
}

export async function getRsi(symbol: string): Promise<RsiResponse> {
  const to = Math.floor(Date.now() / 1000)
  const from = to - 60 * 60 * 24 * 30 // 30 days back for enough data points
  return finnhubGet<RsiResponse>(
    `/indicator?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&indicator=rsi&timeperiod=14`
  )
}

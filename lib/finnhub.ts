const BASE_URL = 'https://finnhub.io/api/v1'

interface QuoteResponse {
  c: number
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

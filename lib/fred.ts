const BASE_URL = 'https://api.stlouisfed.org/fred'

interface ObservationsResponse {
  observations: { value: string; date: string }[]
}

async function fredGet<T>(path: string): Promise<T> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) throw new Error('FRED_API_KEY is not configured')

  const res = await fetch(`${BASE_URL}${path}&api_key=${apiKey}&file_type=json`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`FRED request failed: ${res.status}`)
  return res.json() as Promise<T>
}

/** Returns the latest CBOE VIX closing value (VIXCLS), e.g. 18.5 */
export async function getVix(): Promise<number> {
  const data = await fredGet<ObservationsResponse>(
    '/series/observations?series_id=VIXCLS&sort_order=desc&limit=5'
  )
  const obs = data.observations.find((o) => o.value !== '.')
  if (!obs) throw new Error('No valid VIXCLS observation found')
  return parseFloat(obs.value)
}

/** Returns the latest 10-year Treasury yield (DGS10) as a percentage, e.g. 4.23 */
export async function getTenYearYield(): Promise<number> {
  const data = await fredGet<ObservationsResponse>(
    '/series/observations?series_id=DGS10&sort_order=desc&limit=5'
  )
  // FRED may return "." for non-trading days; find the latest numeric value
  const obs = data.observations.find((o) => o.value !== '.')
  if (!obs) throw new Error('No valid DGS10 observation found')
  return parseFloat(obs.value)
}

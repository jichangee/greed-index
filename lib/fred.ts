const BASE_URL = 'https://api.stlouisfed.org/fred'

interface ObservationsResponse {
  observations: { value: string; date: string }[]
}

function toIsoDateOnly(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIsoDateOnly(input: string): Date {
  // Interpret YYYY-MM-DD as UTC midnight to avoid TZ drift.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  if (!m) throw new Error(`Invalid date format: ${input}. Expected YYYY-MM-DD`)
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid date: ${input}`)
  return dt
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

export interface FredObservation {
  date: string // YYYY-MM-DD
  value: number
}

export async function getSeriesObservations(
  seriesId: string,
  startIso: string,
  endIso: string
): Promise<FredObservation[]> {
  parseIsoDateOnly(startIso)
  parseIsoDateOnly(endIso)

  const data = await fredGet<ObservationsResponse>(
    `/series/observations?series_id=${encodeURIComponent(seriesId)}` +
      `&observation_start=${encodeURIComponent(startIso)}` +
      `&observation_end=${encodeURIComponent(endIso)}` +
      `&sort_order=asc&limit=100000`
  )

  const out: FredObservation[] = []
  for (const o of data.observations) {
    if (o.value === '.') continue
    const v = parseFloat(o.value)
    if (!Number.isFinite(v)) continue
    out.push({ date: o.date, value: v })
  }
  return out
}

async function getLatestObservationAtOrBefore(seriesId: string, dateIso: string): Promise<number> {
  const end = parseIsoDateOnly(dateIso)
  // Look back enough to survive weekends/holidays; FRED will return '.' on non-business days.
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 14)

  const data = await fredGet<ObservationsResponse>(
    `/series/observations?series_id=${encodeURIComponent(seriesId)}` +
      `&observation_start=${encodeURIComponent(toIsoDateOnly(start))}` +
      `&observation_end=${encodeURIComponent(dateIso)}` +
      `&sort_order=desc&limit=30`
  )
  const obs = data.observations.find((o) => o.value !== '.')
  if (!obs) throw new Error(`No valid ${seriesId} observation found at or before ${dateIso}`)
  const value = parseFloat(obs.value)
  if (!Number.isFinite(value)) throw new Error(`Invalid ${seriesId} value "${obs.value}" at ${obs.date}`)
  return value
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

/** Returns CBOE VIX closing value (VIXCLS) as of date (<= date), e.g. 18.5 */
export async function getVixAt(dateIso: string): Promise<number> {
  return getLatestObservationAtOrBefore('VIXCLS', dateIso)
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

/** Returns 10-year Treasury yield (DGS10) as of date (<= date), percentage, e.g. 4.23 */
export async function getTenYearYieldAt(dateIso: string): Promise<number> {
  return getLatestObservationAtOrBefore('DGS10', dateIso)
}

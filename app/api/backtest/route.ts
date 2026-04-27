import { calculateScore } from '@/lib/scoring'
import { getDailyBars } from '@/lib/twelvedata'
import { getSeriesObservations } from '@/lib/fred'
import { alignBarsAsOf, computeRsi, computeStochK, computeWindowPosition } from '@/lib/indicators'
import { getSp500PeAt } from '@/lib/multpl'
import type { BacktestPoint, BacktestResponse, IndicatorData } from '@/types/indicator'

const SYMBOL = 'SPY'
const LOOKBACK_BARS = 900 // enough for 52w range + 252d window + RSI/stoch + buffer

function parseDateOnly(input: string | null, name: string): string {
  if (!input) throw new Error(`Missing ${name}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error(`Invalid ${name}. Expected YYYY-MM-DD`)
  return input
}

function isoWeekKey(dateIso: string): string {
  // ISO week year-week. Treat input as UTC date.
  const [y, m, d] = dateIso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))

  // Thursday-based ISO week
  const day = (date.getUTCDay() + 6) % 7 // 0=Mon..6=Sun
  date.setUTCDate(date.getUTCDate() - day + 3) // move to Thursday
  const isoYear = date.getUTCFullYear()

  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)

  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

function valueAtOrBefore(obsAsc: { date: string; value: number }[], dateIso: string): number {
  // obsAsc is sorted asc by date
  for (let i = obsAsc.length - 1; i >= 0; i--) {
    if (obsAsc[i].date <= dateIso) return obsAsc[i].value
  }
  throw new Error(`No observation at or before ${dateIso}`)
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  let start: string
  let end: string
  try {
    start = parseDateOnly(url.searchParams.get('start'), 'start')
    end = parseDateOnly(url.searchParams.get('end'), 'end')
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    )
  }

  if (start > end) {
    return Response.json({ error: 'start must be <= end' }, { status: 400 })
  }

  try {
    // Fetch daily bars once, then align and compute for weekly points.
    const barsDesc = await getDailyBars(SYMBOL, end, LOOKBACK_BARS)
    const { barsAsOfDesc: endAlignedDesc } = alignBarsAsOf(barsDesc, end)
    const barsAsc = [...endAlignedDesc].reverse()

    // Determine trading days within [start, end] (inclusive).
    const inRange = barsAsc.filter((b) => b.datetime >= start && b.datetime <= end)
    if (!inRange.length) throw new Error('No trading bars found in range')

    // Weekly points: use last trading day of each ISO week in the range.
    const weekLastDate = new Map<string, string>()
    for (const b of inRange) {
      weekLastDate.set(isoWeekKey(b.datetime), b.datetime)
    }
    const dates = Array.from(weekLastDate.values()).sort()

    // FRED series in bulk; we still value-align per date.
    // Add buffer at start in case the first week needs forward-aligned value.
    const fredStart = start
    const [dgs10Asc, vixAsc] = await Promise.all([
      getSeriesObservations('DGS10', fredStart, end),
      getSeriesObservations('VIXCLS', fredStart, end),
    ])

    const points: BacktestPoint[] = []

    for (const dateIso of dates) {
      // Build a slice up to dateIso (inclusive) for indicator computation.
      const idx = barsAsc.findIndex((b) => b.datetime === dateIso)
      if (idx === -1) continue
      const slice = barsAsc.slice(0, idx + 1)

      const closesAsc = slice.map((b) => b.close)
      const highsAsc = slice.map((b) => b.high)
      const lowsAsc = slice.map((b) => b.low)

      const rsi = computeRsi(closesAsc, 14)
      const stochastic = computeStochK(highsAsc, lowsAsc, closesAsc, 14)
      const { position: weekPosition52 } = computeWindowPosition(slice, 252)

      const bondYield = valueAtOrBefore(dgs10Asc, dateIso)
      const vix = valueAtOrBefore(vixAsc, dateIso)
      const pe = await getSp500PeAt(dateIso)

      const indicatorData: IndicatorData = {
        pe,
        earningsYield: (1 / pe) * 100,
        bondYield,
        vix,
        rsi,
        stochastic,
        weekPosition52,
        price: slice[slice.length - 1].close,
      }

      const { totalScore, signal } = calculateScore(indicatorData)
      points.push({ date: dateIso, totalScore, signal, price: indicatorData.price })
    }

    const response: BacktestResponse = {
      start,
      end,
      frequency: 'week',
      points,
      cachedAt: new Date().toISOString(),
    }

    return Response.json(response)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to run backtest' },
      { status: 500 }
    )
  }
}


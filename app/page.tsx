'use client'

import { useEffect, useState } from 'react'
import { ScoreGauge } from '@/components/ScoreGauge'
import { SignalBadge } from '@/components/SignalBadge'
import { BacktestChart } from '@/components/BacktestChart'
import type { BacktestResponse, MarketResponse } from '@/types/indicator'

function toIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export default function Home() {
  const [data, setData] = useState<MarketResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null)
  const [showBacktest, setShowBacktest] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/market', { signal: controller.signal })
      .then((res) => res.json())
      .then((json: MarketResponse & { error?: string }) => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!showBacktest) return

    const controller = new AbortController()
    const end = toIsoDateOnly(new Date())
    // last 52 weeks ~= 364 days
    const start = toIsoDateOnly(addDaysUtc(new Date(), -364))
    const params = new URLSearchParams({ start, end, freq: 'week' })
    fetch(`/api/backtest?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: BacktestResponse & { error?: string }) => {
        if (json.error) throw new Error(json.error)
        setBacktest(json)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      })
    return () => controller.abort()
  }, [showBacktest])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-white px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">S&amp;P 500</h1>
        <p className="mt-1 text-sm text-gray-500">Greed &amp; Fear Index</p>
      </div>
      <ScoreGauge totalScore={data.totalScore} signal={data.signal} />
      <SignalBadge signal={data.signal} />

      <div className="w-full max-w-6xl">
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
            onClick={() => setShowBacktest((v) => !v)}
          >
            {showBacktest ? '隐藏回测' : '显示回测'}
          </button>
        </div>

        {showBacktest ? (
          backtest ? (
            <BacktestChart points={backtest.points} />
          ) : (
            <div className="text-base text-gray-500">加载回测中…</div>
          )
        ) : null}
      </div>
    </div>
  )
}

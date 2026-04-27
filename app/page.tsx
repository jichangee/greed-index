'use client'

import { useEffect, useState } from 'react'
import { ScoreGauge } from '@/components/ScoreGauge'
import { SignalBadge } from '@/components/SignalBadge'
import type { MarketResponse } from '@/types/indicator'

export default function Home() {
  const [data, setData] = useState<MarketResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-white">
      <ScoreGauge totalScore={data.totalScore} signal={data.signal} />
      <SignalBadge signal={data.signal} />
    </div>
  )
}

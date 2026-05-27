'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MarketResponse, Signal } from '@/types/indicator'

const SIGNAL_LABELS: Record<Signal, string> = {
  LOW: '低风险',
  MEDIUM: '中等风险',
  HIGH: '高风险',
}

function formatValue(value: number | null, suffix = '', digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}${suffix}`
}

function getCapeHint(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '等待数据'
  if (value > 40) return '极高估值区间'
  if (value > 35) return '历史高估区间'
  if (value >= 30) return '明显偏贵'
  if (value >= 20) return '正常偏高'
  return '估值相对便宜'
}

export default function Home() {
  const [data, setData] = useState<MarketResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)

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
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [refreshToken])

  const loadMarket = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshToken((current) => current + 1)
  }, [])

  const scorePercent = data ? Math.round(data.totalScore * 100) : null
  const signal = data?.signal ?? 'MEDIUM'
  const barTone =
    signal === 'LOW'
      ? 'bg-neutral-900'
      : signal === 'MEDIUM'
        ? 'bg-amber-500'
        : 'bg-red-600'

  const metricCards = [
    {
      label: '席勒 CAPE',
      value: formatValue(data?.inputs.cape ?? null, '', 1),
      hint: getCapeHint(data?.inputs.cape),
    },
    {
      label: 'S&P 500 PE',
      value: formatValue(data?.inputs.pe ?? null, '', 1),
      hint: '历史均值 ~16',
    },
    {
      label: '10Y 国债',
      value: formatValue(data?.inputs.bondYield ?? null, '%', 2),
      hint: '与股息的利差',
    },
    {
      label: '股息收益率',
      value: formatValue(data?.inputs.dividendYield ?? null, '%', 2),
      hint: 'S&P 500',
    },
    {
      label: 'VIX',
      value: formatValue(data?.inputs.vix ?? null, '', 2),
      hint: '30天隐含波动率',
    },
  ]

  return (
    <main className="min-h-screen bg-[#fafafa] px-2 py-3 text-neutral-900 sm:px-4">
      <section className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-bold leading-6">美股风险仪表板</h1>
            <p className="text-xs leading-5 text-neutral-600">估值 × 利率 × 波动率</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50 disabled:opacity-60"
            onClick={loadMarket}
            disabled={loading}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path
                d="M20 12a8 8 0 0 1-13.66 5.66M4 12A8 8 0 0 1 17.66 6.34M17 3v4h-4M7 21v-4h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            刷新数据
          </button>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {metricCards.map((card) => (
            <article key={card.label} className="rounded-lg bg-[#f4f2ed] px-3 py-4 sm:min-h-[84px]">
              <div className="text-xs font-medium text-neutral-700">{card.label}</div>
              <div className="mt-3 text-2xl font-semibold leading-none">{card.value}</div>
              <div className="mt-3 text-[11px] leading-4 text-neutral-500">{card.hint}</div>
            </article>
          ))}
        </div>

        <section className="relative rounded-lg border border-neutral-200 bg-white px-5 py-5 shadow-sm">
          <h2 className="text-sm font-semibold">综合风险评分</h2>
          <div className="mt-8 flex items-end gap-3">
            <div className="text-3xl font-bold leading-none">{scorePercent ?? '—'}</div>
            <div className="pb-1 text-sm font-semibold">/ 100</div>
            <div className="pb-1 text-xs font-bold">{SIGNAL_LABELS[signal]}</div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#f0eee8]">
            <div
              className={`h-full rounded-full ${barTone}`}
              style={{ width: `${scorePercent ?? 0}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-neutral-500">0–35 低风险; 36–65 中等; 66–100 高风险</div>
        </section>

        <p className="pb-3 text-[11px] leading-4 text-neutral-500">
          数据源: Multpl, FRED。最近更新: {data?.cachedAt ? new Date(data.cachedAt).toLocaleString() : '—'}
        </p>
      </section>
    </main>
  )
}

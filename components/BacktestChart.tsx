'use client'

import type { BacktestPoint } from '@/types/indicator'

type Props = {
  points: BacktestPoint[]
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

function formatPrice(v: number): string {
  if (v >= 1000) return v.toFixed(0)
  if (v >= 100) return v.toFixed(1)
  return v.toFixed(2)
}

function buildXTicks(n: number, count = 5): number[] {
  if (n <= 1) return [0]
  const ticks: number[] = []
  for (let i = 0; i < count; i++) {
    const t = Math.round((i * (n - 1)) / (count - 1))
    if (!ticks.includes(t)) ticks.push(t)
  }
  return ticks
}

function LineChart({
  points,
  series,
  yDomain,
  yTicks,
  yFormat,
}: {
  points: BacktestPoint[]
  series: (p: BacktestPoint) => number
  yDomain: [number, number]
  yTicks: number[]
  yFormat: (v: number) => string
}) {
  const width = 1100
  const height = 320
  const padL = 104
  const padR = 12
  const padT = 10
  const padB = 86
  const axisFontSize = 32

  const xs = points.map((_, i) => i)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)

  const [yMin, yMax] = yDomain

  const xScale = (x: number) => {
    if (xMax === xMin) return padL
    return padL + ((x - xMin) / (xMax - xMin)) * (width - padL - padR)
  }
  const yScale = (y: number) =>
    padT + (1 - clamp((y - yMin) / (yMax - yMin), 0, 1)) * (height - padT - padB)

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yScale(series(p)).toFixed(2)}`)
    .join(' ')

  const xTicks = buildXTicks(points.length, 3)
  const lastIdx = points.length - 1

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* axes */}
      <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="#d1d5db" strokeWidth="2" />
      <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="#d1d5db" strokeWidth="2" />

      {/* y ticks */}
      {yTicks.map((v) => {
        const y = yScale(v)
        return (
          <g key={v}>
            <line x1={padL - 6} y1={y} x2={padL} y2={y} stroke="#d1d5db" strokeWidth="2" />
            <text
              x={padL - 12}
              y={y}
              textAnchor="end"
              fontSize={axisFontSize}
              fontWeight="600"
              fill="#111827"
              dominantBaseline="middle"
            >
              {yFormat(v)}
            </text>
          </g>
        )
      })}

      {/* x ticks */}
      {xTicks.map((i) => {
        const x = xScale(i)
        const label = points[i]?.date
        const isFirst = i === 0
        const isLast = i === lastIdx
        const textAnchor: 'start' | 'middle' | 'end' = isFirst ? 'start' : isLast ? 'end' : 'middle'
        const dx = isFirst ? 6 : isLast ? -6 : 0
        return (
          <g key={i}>
            <line x1={x} y1={height - padB} x2={x} y2={height - padB + 6} stroke="#d1d5db" strokeWidth="2" />
            {label ? (
              <text
                x={x + dx}
                y={height - 22}
                textAnchor={textAnchor}
                fontSize={axisFontSize}
                fontWeight="600"
                fill="#111827"
              >
                {label}
              </text>
            ) : null}
          </g>
        )
      })}

      {/* series line */}
      <path d={d} fill="none" stroke="#111827" strokeWidth="2.5" />
    </svg>
  )
}

export function BacktestChart({ points }: Props) {
  if (!points.length) {
    return <div className="w-full rounded-lg border border-gray-200 p-4 text-sm text-gray-500">暂无回测数据</div>
  }

  const prices = points.map((p) => p.price).filter((v) => Number.isFinite(v))
  const pMin = Math.min(...prices)
  const pMax = Math.max(...prices)
  const pPad = (pMax - pMin) * 0.05 || 1
  const pDomain: [number, number] = [pMin - pPad, pMax + pPad]
  const pTicks = [pDomain[0], (pDomain[0] + pDomain[1]) / 2, pDomain[1]]

  if (!points.length) {
    return <div className="w-full rounded-lg border border-gray-200 p-4 text-sm text-gray-500">暂无回测数据</div>
  }

  return (
    <div className="w-full rounded-lg bg-white">
      {/* totalScore chart (0..100) */}
      <LineChart
        points={points}
        series={(p) => p.totalScore * 100}
        yDomain={[0, 100]}
        yTicks={[0, 25, 50, 75, 100]}
        yFormat={(v) => String(Math.round(v))}
      />

      {/* price chart */}
      <LineChart
        points={points}
        series={(p) => p.price}
        yDomain={pDomain}
        yTicks={pTicks}
        yFormat={formatPrice}
      />
    </div>
  )
}


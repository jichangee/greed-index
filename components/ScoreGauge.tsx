import type { ScoreResult } from '@/types/indicator'

const SIGNAL_COLORS: Record<ScoreResult['signal'], string> = {
  LOW: '#111827',
  MEDIUM: '#b45309',
  HIGH: '#dc2626',
}

interface ScoreGaugeProps {
  totalScore: number
  signal: ScoreResult['signal']
}

export function ScoreGauge({ totalScore, signal }: ScoreGaugeProps) {
  const cx = 150
  const cy = 150
  const r = 110

  const v = Math.min(Math.max(totalScore, 0.001), 0.999)
  const angleRad = Math.PI * (1 - v)
  const xEnd = cx + r * Math.cos(angleRad)
  const yEnd = cy - r * Math.sin(angleRad)

  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const filledPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${xEnd.toFixed(2)} ${yEnd.toFixed(2)}`

  const color = SIGNAL_COLORS[signal]
  const score = Math.round(totalScore * 100)

  return (
    <svg viewBox="0 0 300 160" className="w-72 h-40">
      <path d={bgPath} fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round" />
      <path d={filledPath} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="48" fontWeight="bold" fill={color}>
        {score}
      </text>
      <text x={cx - r} y={cy + 22} textAnchor="middle" fontSize="12" fill="#9ca3af">0</text>
      <text x={cx + r} y={cy + 22} textAnchor="middle" fontSize="12" fill="#9ca3af">100</text>
    </svg>
  )
}

import type { ScoreResult } from '@/types/indicator'

const SIGNAL_STYLES: Record<ScoreResult['signal'], string> = {
  BUY: 'bg-green-500 text-white',
  HOLD: 'bg-blue-500 text-white',
  SELL: 'bg-orange-500 text-white',
  DANGER: 'bg-red-500 text-white',
}

interface SignalBadgeProps {
  signal: ScoreResult['signal']
}

export function SignalBadge({ signal }: SignalBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-10 py-4 text-3xl font-bold tracking-widest uppercase ${SIGNAL_STYLES[signal]}`}
    >
      {signal}
    </span>
  )
}

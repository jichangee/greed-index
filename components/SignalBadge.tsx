import type { ScoreResult } from '@/types/indicator'

const SIGNAL_STYLES: Record<ScoreResult['signal'], string> = {
  LOW: 'bg-neutral-900 text-white',
  MEDIUM: 'bg-amber-600 text-white',
  HIGH: 'bg-red-600 text-white',
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

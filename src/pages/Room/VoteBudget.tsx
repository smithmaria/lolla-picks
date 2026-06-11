import type { Day, VoteScope } from '../../types'

interface Props {
  remaining: number
  total: number
  scope: VoteScope
  activeDay?: Day
}

const DAY_LABELS: Record<Day, string> = {
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export default function VoteBudget({ remaining, total, scope, activeDay }: Props) {
  const dayLabel =
    scope === 'per_day' && activeDay ? ` (${DAY_LABELS[activeDay]})` : ''

  const filledCount = total - remaining
  const pips = Array.from({ length: total }, (_, i) => i < filledCount)

  return (
    <div
      className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3"
      aria-label={`${remaining} of ${total} votes remaining${dayLabel}`}
    >
      <div className="flex gap-1" aria-hidden="true">
        {pips.map((used, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full ${
              used ? 'bg-indigo-500' : 'bg-gray-600'
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-gray-300">
        <span className="text-white font-semibold">{remaining}</span>
        {' of '}
        <span className="text-white font-semibold">{total}</span>
        {' votes remaining'}
        {dayLabel && (
          <span className="text-gray-400">{dayLabel}</span>
        )}
      </p>
    </div>
  )
}

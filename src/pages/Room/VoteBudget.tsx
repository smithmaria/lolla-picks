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

const DOT_THRESHOLD = 20

export default function VoteBudget({ remaining, total, scope, activeDay }: Props) {
  const dayLabel =
    scope === 'per_day' && activeDay ? ` (${DAY_LABELS[activeDay]})` : ''

  const usedCount = total - remaining
  const usedPct = total > 0 ? (usedCount / total) * 100 : 0

  return (
    <div
      className="bg-grayDark border border-[#333333] px-4 py-3"
      aria-label={`${remaining} of ${total} votes remaining${dayLabel}`}
    >
      {total <= DOT_THRESHOLD ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1 flex-wrap" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`w-3 h-3 ${i < usedCount ? 'bg-yellow' : 'bg-[#444444]'}`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-300">
            <span className="text-white font-semibold">{remaining}</span>
            {' of '}
            <span className="text-white font-semibold">{total}</span>
            {' votes remaining'}
            {dayLabel && <span className="text-gray-400">{dayLabel}</span>}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-300 mb-2">
            <span className="text-white font-semibold">{remaining}</span>
            {' of '}
            <span className="text-white font-semibold">{total}</span>
            {' votes remaining'}
            {dayLabel && <span className="text-gray-400">{dayLabel}</span>}
          </p>
          <div className="w-full h-2 bg-[#444444] overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-yellow transition-all duration-200"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

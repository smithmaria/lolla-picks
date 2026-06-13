import type { Day } from '../../types'

interface Props {
  days: Day[]
  activeDay: Day | null
  onChange: (day: Day) => void
}

const DAY_ACTIVE: Record<Day, string> = {
  thursday: 'bg-teal border-teal text-black',
  friday: 'bg-blue2 border-blue2 text-black',
  saturday: 'bg-blue3 border-blue3 text-black',
  sunday: 'bg-tealgreen border-tealgreen text-black',
}

export default function DayTabs({ days, activeDay, onChange }: Props) {
  // Pair up days so they wrap two at a time (thu+fri, sat+sun) instead of one by one
  const dayPairs: Day[][] = []
  for (let i = 0; i < days.length; i += 2) {
    dayPairs.push(days.slice(i, i + 2))
  }

  return (
    <div
      className="flex gap-2 flex-wrap"
      role="tablist"
      aria-label="Festival days"
    >
      {dayPairs.map(pair => (
        <div key={pair.join('-')} className="flex gap-2">
          {pair.map(day => (
            <button
              key={day}
              type="button"
              role="tab"
              id={`tab-${day}`}
              aria-selected={activeDay === day}
              aria-controls={`panel-${day}`}
              data-testid={`day-tab-${day}`}
              onClick={() => onChange(day)}
              className={`px-4 py-2 border text-lg font-display uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark ${
                activeDay === day
                  ? DAY_ACTIVE[day]
                  : 'bg-grayDark border-[#333333] text-gray-400 hover:border-gray-500'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

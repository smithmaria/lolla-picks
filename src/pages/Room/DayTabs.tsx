import type { Day } from '../../types'

interface Props {
  days: Day[]
  activeDay: Day | null
  onChange: (day: Day) => void
}

export default function DayTabs({ days, activeDay, onChange }: Props) {
  return (
    <div
      className="flex gap-2 mb-4"
      role="tablist"
      aria-label="Festival days"
    >
      {days.map(day => (
        <button
          key={day}
          type="button"
          role="tab"
          id={`tab-${day}`}
          aria-selected={activeDay === day}
          aria-controls={`panel-${day}`}
          data-testid={`day-tab-${day}`}
          onClick={() => onChange(day)}
          className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            activeDay === day
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {day}
        </button>
      ))}
    </div>
  )
}

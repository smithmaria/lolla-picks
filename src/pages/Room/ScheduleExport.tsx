import { useCallback, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import {
  SLOT_MINUTES,
  ceilHour,
  floorHour,
  formatHour,
  normalizeSlotMinutes,
} from './scheduleTime'
import type { Artist, Day } from '../../types'

interface Props {
  artists: Artist[]
  days: Day[]
  selectedIds: Set<string>
  roomName: string
}

const EXPORT_WIDTH = 1280

function to12Hour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const hour = h ?? 0
  const suffix = hour < 12 ? 'AM' : 'PM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:${String(m ?? 0).padStart(2, '0')} ${suffix}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Static, fixed-width render of one day's schedule for image capture */
function ExportDayGrid({
  day,
  artists,
  selectedIds,
  roomName,
}: {
  day: Day
  artists: Artist[]
  selectedIds: Set<string>
  roomName: string
}) {
  const stages: string[] = []
  const seen = new Set<string>()
  for (const a of artists) {
    if (!seen.has(a.stage)) {
      seen.add(a.stage)
      stages.push(a.stage)
    }
  }
  const stageIndexMap = new Map(stages.map((s, i) => [s, i]))

  let earliest = Infinity
  let latest = -Infinity
  for (const a of artists) {
    const [s, e] = normalizeSlotMinutes(a.start, a.end)
    earliest = Math.min(earliest, s)
    latest = Math.max(latest, e)
  }
  const gridStart = floorHour(earliest)
  const gridEnd = ceilHour(latest)
  const totalSlots = (gridEnd - gridStart) / SLOT_MINUTES
  const hourMarkers: number[] = []
  for (let m = gridStart; m < gridEnd; m += 60) hourMarkers.push(m)

  return (
    <div className="bg-pink p-3" style={{ width: EXPORT_WIDTH }}>
      <div className="flex items-baseline justify-between px-1 pb-2">
        <span className="text-3xl font-display uppercase text-black">
          {capitalize(day)}
        </span>
        <span className="text-sm font-display uppercase text-black/60">
          {roomName}
        </span>
      </div>
      <div className="relative bg-teal">
        <div className="absolute pointer-events-none border-t-2 border-tealDark" style={{ top: '5rem', left: '4rem', right: 0, zIndex: 15 }} />
        <div className="absolute pointer-events-none border-l-2 border-tealDark" style={{ top: '5rem', bottom: 0, left: '4rem', zIndex: 15 }} />
        <div className="absolute pointer-events-none border-r-2 border-tealDark" style={{ top: '5rem', bottom: 0, right: 0, zIndex: 15 }} />
        <div className="absolute pointer-events-none border-b-2 border-tealDark" style={{ bottom: 0, left: '4rem', right: 0, zIndex: 15 }} />
        <div
          className="grid"
          style={{
            gridTemplateColumns: `4rem repeat(${stages.length}, minmax(0, 1fr))`,
            gridTemplateRows: `5rem repeat(${totalSlots}, 2rem)`,
          }}
        >
          <div className="bg-pink h-20" style={{ gridColumn: 1, gridRow: 1 }} />

          {stages.map((stage, si) => (
            <div
              key={stage}
              className="bg-pink px-1 pb-1 pt-2 h-20"
              style={{ gridColumn: si + 2, gridRow: 1 }}
            >
              <div className="bg-black h-full flex items-center justify-center px-2">
                <span className="text-2xl font-display uppercase text-white text-center">{stage}</span>
              </div>
            </div>
          ))}

          {hourMarkers.map(hourMinutes => {
            if (hourMinutes >= gridEnd) return null
            const rowStart = (hourMinutes - gridStart) / SLOT_MINUTES + 2
            return (
              <div
                key={`hour-line-${hourMinutes}`}
                className="border-t-2 border-tealDark"
                style={{ gridColumn: '2 / -1', gridRow: rowStart, alignSelf: 'start', zIndex: 1 }}
              />
            )
          })}

          <div
            className="bg-pink"
            style={{ gridColumn: 1, gridRow: `2 / ${totalSlots + 2}` }}
          />

          {hourMarkers.map(hourMinutes => {
            if (hourMinutes >= gridEnd) return null
            const rowStart = (hourMinutes - gridStart) / SLOT_MINUTES + 2
            return (
              <div
                key={`label-${hourMinutes}`}
                className="bg-pink pr-2 flex items-start justify-end"
                style={{ gridColumn: 1, gridRow: rowStart }}
              >
                <span className="text-xs text-black font-semibold leading-none mt-0.5">
                  {formatHour(hourMinutes)}
                </span>
              </div>
            )
          })}

          {artists.map(artist => {
            const colIndex = stageIndexMap.get(artist.stage)!
            const [startMin, endMin] = normalizeSlotMinutes(artist.start, artist.end)
            const rowStart = Math.round((startMin - gridStart) / SLOT_MINUTES) + 2
            const rowEnd = Math.round((endMin - gridStart) / SLOT_MINUTES) + 2
            const selected = selectedIds.has(artist.id)

            return (
              <div
                key={artist.id}
                className="p-0.5"
                style={{ gridColumn: colIndex + 2, gridRow: `${rowStart} / ${rowEnd}`, zIndex: 10 }}
              >
                <div
                  className={`border border-tealDark h-full flex flex-col p-1.5 gap-1 overflow-hidden ${
                    selected ? 'bg-yellow' : 'bg-grayLight'
                  }`}
                >
                  <p className="font-display uppercase leading-tight truncate text-base text-black">
                    {artist.name}
                  </p>
                  <p className="text-black/60 text-xs">
                    {to12Hour(artist.start)}–{to12Hour(artist.end)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ScheduleExport({ artists, days, selectedIds, roomName }: Props) {
  const [exporting, setExporting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleExport = useCallback(async () => {
    if (exporting || days.length === 0) return
    setExporting(true)
    try {
      await document.fonts.ready
      // Give the offscreen grids a frame to lay out
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

      const container = containerRef.current
      if (!container) return

      for (const day of days) {
        const node = container.querySelector<HTMLElement>(`[data-export-day="${day}"]`)
        if (!node) continue
        const dataUrl = await toPng(node, {
          pixelRatio: 2,
          backgroundColor: '#ecade6',
        })
        const link = document.createElement('a')
        link.download = `lolla-schedule-${day}.png`
        link.href = dataUrl
        link.click()
      }
    } finally {
      setExporting(false)
    }
  }, [exporting, days])

  return (
    <>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting || days.length === 0}
        className="bg-yellow hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-display uppercase px-5 py-2.5 transition-opacity"
      >
        {exporting ? 'Exporting…' : `Export image${days.length > 1 ? 's' : ''}`}
      </button>

      {/* Offscreen render targets for image capture */}
      <div
        ref={containerRef}
        aria-hidden="true"
        style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}
      >
        {days.map(day => (
          <div key={day} data-export-day={day}>
            <ExportDayGrid
              day={day}
              artists={artists.filter(a => a.day === day)}
              selectedIds={selectedIds}
              roomName={roomName}
            />
          </div>
        ))}
      </div>
    </>
  )
}

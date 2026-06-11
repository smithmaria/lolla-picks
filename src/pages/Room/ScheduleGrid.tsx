import { useEffect, useMemo, useRef, useState } from 'react'
import ArtistBlock from './ArtistBlock'
import type { Artist } from '../../types'

interface Props {
  artists: Artist[]
  votesByArtist: Record<string, number>
  allRoomVotes: Record<string, number>
  onVote: (artistId: string, delta: 1 | -1) => void
  locked: boolean
  remainingBudget: number
}

interface StageGridProps {
  artists: Artist[]
  stages: string[]
  stageIndexMap: Map<string, number>
  votesByArtist: Record<string, number>
  allRoomVotes: Record<string, number>
  onVote: (artistId: string, delta: 1 | -1) => void
  locked: boolean
  remainingBudget: number
  maxVotes: number
  gridStart: number
  gridEnd: number
  totalSlots: number
  hourMarkers: number[]
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

/** Parse "HH:MM" into total minutes since midnight */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Return [startMinutes, endMinutes] normalized so end > start.
 * Handles artists that span midnight by adding 24h to the end.
 */
function normalizeSlotMinutes(start: string, end: string): [number, number] {
  const s = toMinutes(start)
  let e = toMinutes(end)
  if (e <= s) e += 24 * 60
  return [s, e]
}

/** Round down to previous hour boundary (in minutes) */
function floorHour(minutes: number): number {
  return Math.floor(minutes / 60) * 60
}

/** Round up to next hour boundary (in minutes) */
function ceilHour(minutes: number): number {
  return Math.ceil(minutes / 60) * 60
}

/** Format minutes-since-midnight as "12 PM", "1 PM", etc. */
function formatHour(minutes: number): string {
  const normalized = minutes % (24 * 60)
  const h = Math.floor(normalized / 60)
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

/**
 * Cap intensity so text contrast stays above WCAG AA on a gray-800 base.
 * rgba(99,102,241) at ~0.45 alpha over #1f2937 produces sufficient contrast.
 */
const MAX_INTENSITY = 0.45
const SLOT_MINUTES = 15
const MOBILE_STAGES_PER_PAGE = 3

/** Subscribe to a CSS media query, returns true when the query matches. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Renders the actual CSS grid for a given set of visible stages */
function StageGrid({
  artists,
  stages,
  stageIndexMap,
  votesByArtist,
  allRoomVotes,
  onVote,
  locked,
  remainingBudget,
  maxVotes,
  gridStart,
  gridEnd,
  totalSlots,
  hourMarkers,
  onTouchStart,
  onTouchEnd,
}: StageGridProps) {
  const stageCount = stages.length
  const gridTemplateColumns = `4rem repeat(${stageCount}, minmax(0, 1fr))`
  const gridTemplateRows = `repeat(${totalSlots}, 2rem)`

  return (
    <div
      className="relative overflow-x-auto"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns, gridTemplateRows }}
        role="grid"
        aria-label="Festival schedule"
      >
        {/* Time label header spacer */}
        <div
          className="sticky top-0 z-20 bg-black border-b border-[#333333]"
          style={{ gridColumn: 1, gridRow: 1 }}
          aria-hidden="true"
        />

        {/* Stage column headers */}
        {stages.map((stage, si) => (
          <div
            key={stage}
            className="sticky top-0 z-20 bg-black border-b border-[#333333] flex items-end pb-1 px-1"
            style={{ gridColumn: si + 2, gridRow: 1 }}
            role="columnheader"
          >
            <span className="text-xs font-display uppercase text-gray-400 truncate">{stage}</span>
          </div>
        ))}

        {/* Hour separator lines — one per hour label, behind artist blocks */}
        {hourMarkers.map(hourMinutes => {
          if (hourMinutes >= gridEnd) return null
          const slotIndex = (hourMinutes - gridStart) / SLOT_MINUTES
          const rowStart = slotIndex + 2

          return (
            <div
              key={`hour-line-${hourMinutes}`}
              className="pointer-events-none border-t border-[#333333]/60"
              style={{
                gridColumn: `1 / -1`,
                gridRow: rowStart,
                alignSelf: 'start',
                zIndex: 1,
              }}
              aria-hidden="true"
            />
          )
        })}

        {/* Time labels */}
        {hourMarkers.map(hourMinutes => {
          if (hourMinutes >= gridEnd) return null
          const slotIndex = (hourMinutes - gridStart) / SLOT_MINUTES
          const rowStart = slotIndex + 2

          return (
            <div
              key={`label-${hourMinutes}`}
              className="pr-2 flex items-start justify-end"
              style={{ gridColumn: 1, gridRow: rowStart }}
              aria-hidden="true"
            >
              <span className="text-xs text-gray-500 leading-none mt-0.5">
                {formatHour(hourMinutes)}
              </span>
            </div>
          )
        })}

        {/* Artist blocks — only those whose stage is in this grid */}
        {artists
          .filter(a => stageIndexMap.has(a.stage))
          .map(artist => {
            const colIndex = stageIndexMap.get(artist.stage)!
            const [startMin, endMin] = normalizeSlotMinutes(artist.start, artist.end)

            const startSlot = Math.round((startMin - gridStart) / SLOT_MINUTES)
            const endSlot = Math.round((endMin - gridStart) / SLOT_MINUTES)

            // Row 1 is the header; data rows start at 2
            const rowStart = startSlot + 2
            const rowEnd = endSlot + 2

            const totalArtistVotes = allRoomVotes[artist.id] ?? 0
            const rawIntensity = maxVotes > 0 ? totalArtistVotes / maxVotes : 0
            const intensity = rawIntensity * MAX_INTENSITY
            const userVotes = votesByArtist[artist.id] ?? 0

            return (
              <div
                key={artist.id}
                className="p-0.5"
                style={{
                  gridColumn: colIndex + 2,
                  gridRow: `${rowStart} / ${rowEnd}`,
                  zIndex: 10,
                }}
                role="gridcell"
              >
                <div className="h-full">
                  <ArtistBlock
                    artist={artist}
                    voteCount={userVotes}
                    onVote={delta => onVote(artist.id, delta)}
                    locked={locked}
                    remainingBudget={remainingBudget}
                    intensity={intensity}
                    compact
                  />
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

export default function ScheduleGrid({
  artists,
  votesByArtist,
  allRoomVotes,
  onVote,
  locked,
  remainingBudget,
}: Props) {
  const [stagePage, setStagePage] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const isDesktop = useMediaQuery('(min-width: 768px)')

  // Reset page when the artist list changes (day switch)
  useEffect(() => {
    setStagePage(0)
  }, [artists])

  // Derive ordered unique stages (preserves artist insertion order)
  const stages = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const a of artists) {
      if (!seen.has(a.stage)) {
        seen.add(a.stage)
        result.push(a.stage)
      }
    }
    return result
  }, [artists])

  // O(1) stage → column index lookup for all stages
  const stageIndexMap = useMemo(
    () => new Map(stages.map((s, i) => [s, i])),
    [stages],
  )

  // Derive grid time bounds — floored/ceiled to the hour, midnight-aware
  const { gridStart, gridEnd, totalSlots, hourMarkers } = useMemo(() => {
    if (artists.length === 0) {
      const start = 12 * 60
      const end = 22 * 60
      const total = (end - start) / SLOT_MINUTES
      const hours: number[] = []
      for (let m = start; m < end; m += 60) hours.push(m)
      return { gridStart: start, gridEnd: end, totalSlots: total, hourMarkers: hours }
    }

    let earliest = Infinity
    let latest = -Infinity
    for (const a of artists) {
      const [s, e] = normalizeSlotMinutes(a.start, a.end)
      earliest = Math.min(earliest, s)
      latest = Math.max(latest, e)
    }

    const start = floorHour(earliest)
    const end = ceilHour(latest)
    const total = (end - start) / SLOT_MINUTES

    const hours: number[] = []
    for (let m = start; m < end; m += 60) hours.push(m)

    return { gridStart: start, gridEnd: end, totalSlots: total, hourMarkers: hours }
  }, [artists])

  // Max aggregate votes for intensity normalization
  const maxVotes = useMemo(() => {
    const values = Object.values(allRoomVotes)
    return values.length > 0 ? Math.max(...values) : 0
  }, [allRoomVotes])

  const totalPages = Math.ceil(stages.length / MOBILE_STAGES_PER_PAGE)
  const clampedPage = Math.min(stagePage, Math.max(0, totalPages - 1))

  // Memoized so mobileStageIndexMap dependency is stable
  const visibleStagesMobile = useMemo(
    () =>
      stages.slice(
        clampedPage * MOBILE_STAGES_PER_PAGE,
        clampedPage * MOBILE_STAGES_PER_PAGE + MOBILE_STAGES_PER_PAGE,
      ),
    [stages, clampedPage],
  )

  // O(1) stage → column index lookup for the mobile page
  const mobileStageIndexMap = useMemo(
    () => new Map(visibleStagesMobile.map((s, i) => [s, i])),
    [visibleStagesMobile],
  )

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const endX = e.changedTouches[0]?.clientX ?? 0
    const delta = touchStartX.current - endX
    touchStartX.current = null

    if (Math.abs(delta) < 50) return

    if (delta > 0 && clampedPage < totalPages - 1) {
      setStagePage(clampedPage + 1)
    } else if (delta < 0 && clampedPage > 0) {
      setStagePage(clampedPage - 1)
    }
  }

  if (artists.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-8 font-display uppercase">
        No artists scheduled for this day.
      </p>
    )
  }

  const sharedGridProps = {
    artists,
    votesByArtist,
    allRoomVotes,
    onVote,
    locked,
    remainingBudget,
    maxVotes,
    gridStart,
    gridEnd,
    totalSlots,
    hourMarkers,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  }

  if (isDesktop) {
    return (
      <StageGrid
        {...sharedGridProps}
        stages={stages}
        stageIndexMap={stageIndexMap}
      />
    )
  }

  // Mobile: paginated stage columns
  return (
    <div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            data-testid="stage-page-prev"
            onClick={() => setStagePage(p => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            aria-label="Previous stages"
            className="w-8 h-8 bg-grayDark border border-[#333333] hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-tealDark"
          >
            &#8592;
          </button>
          <span className="text-xs text-gray-500 font-display uppercase" aria-live="polite">
            Stages {clampedPage * MOBILE_STAGES_PER_PAGE + 1}–
            {Math.min((clampedPage + 1) * MOBILE_STAGES_PER_PAGE, stages.length)} of{' '}
            {stages.length}
          </span>
          <button
            type="button"
            data-testid="stage-page-next"
            onClick={() => setStagePage(p => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            aria-label="Next stages"
            className="w-8 h-8 bg-grayDark border border-[#333333] hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-tealDark"
          >
            &#8594;
          </button>
        </div>
      )}
      <StageGrid
        {...sharedGridProps}
        stages={visibleStagesMobile}
        stageIndexMap={mobileStageIndexMap}
      />
    </div>
  )
}

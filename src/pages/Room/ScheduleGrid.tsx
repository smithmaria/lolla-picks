import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArtistBlock from './ArtistBlock'
import {
  SLOT_MINUTES,
  ceilHour,
  floorHour,
  formatHour,
  normalizeSlotMinutes,
} from './scheduleTime'
import type { Artist } from '../../types'

interface Props {
  artists: Artist[]
  votesByArtist: Record<string, number>
  allRoomVotes: Record<string, number>
  votersByArtist: Record<string, string[]>
  onVote: (artistId: string, delta: 1 | -1) => void
  locked: boolean
  remainingBudget: number
  allowMultiVote: boolean
  editMode: boolean
  scheduleMode?: boolean
  scheduleSelectedIds?: Set<string>
  onScheduleToggle?: (artistId: string) => void
}

interface StageGridProps {
  artists: Artist[]
  stages: string[]
  stageIndexMap: Map<string, number>
  votesByArtist: Record<string, number>
  allRoomVotes: Record<string, number>
  votersByArtist: Record<string, string[]>
  onVote: (artistId: string, delta: 1 | -1) => void
  locked: boolean
  remainingBudget: number
  allowMultiVote: boolean
  editMode: boolean
  scheduleMode?: boolean
  scheduleSelectedIds?: Set<string>
  onScheduleToggle?: (artistId: string) => void
  maxVotes: number
  maxUserVotes: number
  gridStart: number
  gridEnd: number
  totalSlots: number
  hourMarkers: number[]
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

// Narrowest a stage column can get before names become unreadable —
// once columns would drop below this, the grid paginates instead of squeezing.
const MIN_STAGE_COLUMN_PX = 160
// Width of the time-label column (4rem)
const TIME_COLUMN_PX = 64

/** Observe an element's content-box width. Callback ref survives conditional rendering. */
function useContainerWidth(): [(el: HTMLElement | null) => void, number] {
  const [width, setWidth] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((el: HTMLElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    observerRef.current = observer
  }, [])

  return [ref, width]
}

/** Renders the actual CSS grid for a given set of visible stages */
function StageGrid({
  artists,
  stages,
  stageIndexMap,
  votesByArtist,
  allRoomVotes,
  votersByArtist,
  onVote,
  locked,
  remainingBudget,
  allowMultiVote,
  editMode,
  scheduleMode,
  scheduleSelectedIds,
  onScheduleToggle,
  maxVotes,
  maxUserVotes,
  gridStart,
  gridEnd,
  totalSlots,
  hourMarkers,
  onTouchStart,
  onTouchEnd,
}: StageGridProps) {
  const stageCount = stages.length
  const gridTemplateColumns = `4rem repeat(${stageCount}, minmax(0, 1fr))`
  const gridTemplateRows = `5rem repeat(${totalSlots}, 2rem)`

  return (
    <div
      className="relative overflow-x-auto bg-teal"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Stage area frame — absolute so they're never covered by grid items */}
      <div className="absolute pointer-events-none border-t-2 border-tealDark" style={{ top: '5rem', left: '4rem', right: 0, zIndex: 15 }} aria-hidden="true" />
      <div className="absolute pointer-events-none border-l-2 border-tealDark" style={{ top: '5rem', bottom: 0, left: '4rem', zIndex: 15 }} aria-hidden="true" />
      <div className="absolute pointer-events-none border-r-2 border-tealDark" style={{ top: '5rem', bottom: 0, right: 0, zIndex: 15 }} aria-hidden="true" />
      <div className="absolute pointer-events-none border-b-2 border-tealDark" style={{ bottom: 0, left: '4rem', right: 0, zIndex: 15 }} aria-hidden="true" />
      <div
        className="grid"
        style={{ gridTemplateColumns, gridTemplateRows }}
        role="grid"
        aria-label="Festival schedule"
      >
        {/* Time label header spacer */}
        <div
          className="sticky top-0 z-20 bg-pink h-20"
          style={{ gridColumn: 1, gridRow: 1 }}
          aria-hidden="true"
        />

        {/* Stage column headers */}
        {stages.map((stage, si) => (
          <div
            key={stage}
            className="sticky top-0 z-20 bg-pink px-1 pb-1 pt-2 h-20"
            style={{ gridColumn: si + 2, gridRow: 1 }}
            role="columnheader"
          >
            <div className="bg-black h-full flex items-center justify-center px-2">
              <span className="text-2xl font-display uppercase text-white text-center">{stage}</span>
            </div>
          </div>
        ))}

        {/* Hour separator lines — behind artist blocks */}
        {hourMarkers.map(hourMinutes => {
          if (hourMinutes >= gridEnd) return null
          const slotIndex = (hourMinutes - gridStart) / SLOT_MINUTES
          const rowStart = slotIndex + 2

          return (
            <div
              key={`hour-line-${hourMinutes}`}
              className="pointer-events-none border-t-2 border-tealDark"
              style={{
                gridColumn: `2 / -1`,
                gridRow: rowStart,
                alignSelf: 'start',
                zIndex: 1,
              }}
              aria-hidden="true"
            />
          )
        })}

        {/* Full-height pink fill for time column — covers rows between hour labels */}
        <div
          className="bg-pink"
          style={{ gridColumn: 1, gridRow: `2 / ${totalSlots + 2}` }}
          aria-hidden="true"
        />

        {/* Time labels */}
        {hourMarkers.map(hourMinutes => {
          if (hourMinutes >= gridEnd) return null
          const slotIndex = (hourMinutes - gridStart) / SLOT_MINUTES
          const rowStart = slotIndex + 2

          return (
            <div
              key={`label-${hourMinutes}`}
              className="bg-pink pr-2 flex items-start justify-end"
              style={{ gridColumn: 1, gridRow: rowStart }}
              aria-hidden="true"
            >
              <span className="text-xs text-black font-semibold leading-none mt-0.5">
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

            const aggregateVotes = allRoomVotes[artist.id] ?? 0
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
                    aggregateVotes={aggregateVotes}
                    voters={votersByArtist[artist.id] ?? []}
                    maxVotes={maxVotes}
                    maxUserVotes={maxUserVotes}
                    onVote={delta => onVote(artist.id, delta)}
                    locked={locked}
                    remainingBudget={remainingBudget}
                    allowMultiVote={allowMultiVote}
                    editMode={editMode}
                    scheduleMode={scheduleMode}
                    scheduleSelected={scheduleSelectedIds?.has(artist.id) ?? false}
                    onScheduleToggle={
                      onScheduleToggle ? () => onScheduleToggle(artist.id) : undefined
                    }
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
  votersByArtist,
  onVote,
  locked,
  remainingBudget,
  allowMultiVote,
  editMode,
  scheduleMode,
  scheduleSelectedIds,
  onScheduleToggle,
}: Props) {
  const [stagePage, setStagePage] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const [containerRef, containerWidth] = useContainerWidth()

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

  // Max aggregate votes for view mode color gradient
  const maxVotes = useMemo(() => {
    const values = Object.values(allRoomVotes)
    return values.length > 0 ? Math.max(...values) : 0
  }, [allRoomVotes])

  // Max personal votes for edit mode multi-vote color gradient
  const maxUserVotes = useMemo(() => {
    const values = Object.values(votesByArtist)
    return values.length > 0 ? Math.max(...values) : 0
  }, [votesByArtist])

  // How many stage columns fit at a readable width. Until the container is
  // measured (width 0), assume everything fits to avoid a pagination flash.
  const stagesPerPage =
    containerWidth > 0
      ? Math.max(
          1,
          Math.min(
            stages.length,
            Math.floor((containerWidth - TIME_COLUMN_PX) / MIN_STAGE_COLUMN_PX),
          ),
        )
      : stages.length

  const totalPages = Math.ceil(stages.length / stagesPerPage)
  const clampedPage = Math.min(stagePage, Math.max(0, totalPages - 1))

  // Memoized so visibleStageIndexMap dependency is stable
  const visibleStages = useMemo(
    () =>
      stages.slice(
        clampedPage * stagesPerPage,
        clampedPage * stagesPerPage + stagesPerPage,
      ),
    [stages, clampedPage, stagesPerPage],
  )

  // O(1) stage → column index lookup for the current page
  const visibleStageIndexMap = useMemo(
    () => new Map(visibleStages.map((s, i) => [s, i])),
    [visibleStages],
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
    votersByArtist,
    onVote,
    locked,
    remainingBudget,
    allowMultiVote,
    editMode,
    scheduleMode,
    scheduleSelectedIds,
    onScheduleToggle,
    maxVotes,
    maxUserVotes,
    gridStart,
    gridEnd,
    totalSlots,
    hourMarkers,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  }

  const pageFirst = clampedPage * stagesPerPage + 1
  const pageLast = Math.min((clampedPage + 1) * stagesPerPage, stages.length)

  // Paginated stage columns — page size adapts to how many fit at a readable width
  return (
    <div className="bg-pink p-3">
      <div ref={containerRef}>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              data-testid="stage-page-prev"
              onClick={() => setStagePage(p => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              aria-label="Previous stages"
              className="w-8 h-8 bg-black border border-tealDark hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-tealDark"
            >
              &#8592;
            </button>
            <span className="text-xs text-black font-display uppercase" aria-live="polite">
              {pageFirst === pageLast
                ? `Stage ${pageFirst} of ${stages.length}`
                : `Stages ${pageFirst}–${pageLast} of ${stages.length}`}
            </span>
            <button
              type="button"
              data-testid="stage-page-next"
              onClick={() => setStagePage(p => Math.min(totalPages - 1, p + 1))}
              disabled={clampedPage >= totalPages - 1}
              aria-label="Next stages"
              className="w-8 h-8 bg-black border border-tealDark hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-tealDark"
            >
              &#8594;
            </button>
          </div>
        )}
        <StageGrid
          {...sharedGridProps}
          stages={visibleStages}
          stageIndexMap={visibleStageIndexMap}
        />
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { Artist } from '../../types'

function to12Hour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const hour = h ?? 0
  const suffix = hour < 12 ? 'AM' : 'PM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:${String(m ?? 0).padStart(2, '0')} ${suffix}`
}

// Interpolates between yellow (#cfdf05 ≈ hsl(64,96%,45%)) and red (#fc4338 ≈ hsl(3,96%,60%))
function voteColor(ratio: number): string {
  const t = Math.min(1, Math.max(0, ratio))
  const hue = Math.round(64 - t * 61)
  const lightness = Math.round(45 + t * 15)
  return `hsl(${hue}, 96%, ${lightness}%)`
}

const YELLOW = '#cfdf05'
const SELECTED_COLOR = voteColor(0.5) // median orange for single-vote selected state

interface Props {
  artist: Artist
  voteCount: number       // this user's votes
  aggregateVotes: number  // all users' votes combined
  voters: string[]        // display names of users who voted for this artist
  maxVotes: number        // highest aggregate vote count on any artist in the room
  maxUserVotes: number    // highest personal vote count on any single artist
  onVote: (delta: 1 | -1) => void
  locked: boolean
  remainingBudget: number
  allowMultiVote: boolean
  editMode: boolean
  scheduleMode?: boolean
  scheduleSelected?: boolean
  onScheduleToggle?: () => void
  compact?: boolean
}

export default function ArtistBlock({
  artist,
  voteCount,
  aggregateVotes,
  voters,
  maxVotes,
  maxUserVotes,
  onVote,
  locked,
  remainingBudget,
  allowMultiVote,
  editMode,
  scheduleMode = false,
  scheduleSelected = false,
  onScheduleToggle,
  compact = false,
}: Props) {
  const canIncrement = !locked && remainingBudget > 0
  const canDecrement = !locked && voteCount > 0

  const isToggleMode = !scheduleMode && editMode && !allowMultiVote && !locked
  const isScheduleToggle = scheduleMode && !!onScheduleToggle

  const grayedOut = scheduleMode
    ? !scheduleSelected
    : !editMode && aggregateVotes === 0

  let backgroundColor: string | undefined
  if (!grayedOut) {
    if (scheduleMode) {
      backgroundColor = YELLOW
    } else if (!editMode && aggregateVotes > 0 && maxVotes > 0) {
      backgroundColor = voteColor(aggregateVotes / maxVotes)
    } else if (editMode && !allowMultiVote && voteCount > 0) {
      backgroundColor = SELECTED_COLOR
    } else if (editMode && allowMultiVote && voteCount > 0 && maxUserVotes > 0) {
      backgroundColor = voteColor(voteCount / maxUserVotes)
    } else {
      backgroundColor = YELLOW
    }
  }

  function handleToggle() {
    if (isScheduleToggle) {
      onScheduleToggle?.()
      return
    }
    onVote(voteCount > 0 ? -1 : 1)
  }

  const clickable = isToggleMode || isScheduleToggle

  const textColor = 'text-black'

  const compactMultiVote = compact && editMode && !locked && allowMultiVote
  const showTooltip = !editMode && !scheduleMode && voters.length > 0
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={showTooltip ? () => setHovered(true) : undefined}
      onMouseLeave={showTooltip ? () => setHovered(false) : undefined}
      className={`border border-tealDark relative overflow-visible h-full transition-colors ${
        compactMultiVote ? 'flex flex-row p-1.5 gap-2' : compact ? 'flex flex-col p-1.5 gap-1' : 'flex flex-col p-4 gap-2'
      } ${grayedOut ? 'bg-grayLight' : ''} ${clickable ? 'cursor-pointer select-none' : ''}`}
      style={backgroundColor ? { backgroundColor } : undefined}
      onClick={clickable ? handleToggle : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleToggle()
              }
            }
          : undefined
      }
      aria-pressed={
        isScheduleToggle ? scheduleSelected : isToggleMode ? voteCount > 0 : undefined
      }
      aria-label={
        isScheduleToggle
          ? `${scheduleSelected ? 'Remove' : 'Add'} ${artist.name} ${scheduleSelected ? 'from' : 'to'} schedule`
          : isToggleMode
            ? `${voteCount > 0 ? 'Remove vote from' : 'Vote for'} ${artist.name}`
            : undefined
      }
    >
      {/* Voter tooltip — shown on hover in room votes mode */}
      {showTooltip && hovered && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none"
        >
          <div className="bg-black border border-[#333333] px-2.5 py-1.5 text-xs text-white whitespace-nowrap shadow-lg">
            {voters.join(', ')}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#333333]" />
        </div>
      )}

      {/* Compact multi-vote: left text column + right vertical controls */}
      {compactMultiVote && (
        <>
          <div className="flex flex-col justify-between flex-1 min-w-0">
            <p className={`font-display uppercase leading-tight truncate text-base ${textColor}`}>
              {artist.name}
            </p>
            <p className="text-black/60 text-xs">
              {to12Hour(artist.start)}–{to12Hour(artist.end)}
            </p>
          </div>

          <div
            className="flex flex-col items-center justify-between shrink-0"
            role="group"
            aria-label={`Votes for ${artist.name}`}
          >
            <button
              type="button"
              data-testid={`increment-${artist.id}`}
              onClick={() => onVote(1)}
              disabled={!canIncrement}
              aria-label={`Add vote for ${artist.name}`}
              className="bg-black hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold w-5 h-5 text-xs flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark"
            >
              +
            </button>
            <span
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''}`}
              className={`text-center font-semibold text-xs w-4 ${textColor}`}
            >
              {voteCount}
            </span>
            <button
              type="button"
              data-testid={`decrement-${artist.id}`}
              onClick={() => onVote(-1)}
              disabled={!canDecrement}
              aria-label={`Remove vote from ${artist.name}`}
              className="bg-black hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold w-5 h-5 text-xs flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark"
            >
              −
            </button>
          </div>
        </>
      )}

      {/* All other layouts */}
      {!compactMultiVote && (
        <>
          {/* Artist name */}
          <p
            className={`relative z-10 font-display uppercase leading-tight truncate ${textColor} ${
              compact ? 'text-base' : 'text-xl'
            }`}
          >
            {artist.name}
          </p>

          {/* Time + controls row */}
          <div className={`relative z-10 flex items-center ${compact ? 'gap-1' : 'gap-4'}`}>
            <div className="flex-1 min-w-0">
              {!compact && (
                <p className="text-black/60 text-sm">
                  {artist.stage} · {to12Hour(artist.start)}–{to12Hour(artist.end)}
                </p>
              )}
              {compact && (
                <p className="text-black/60 text-xs">
                  {to12Hour(artist.start)}–{to12Hour(artist.end)}
                </p>
              )}
            </div>

            {/* View mode: aggregate count */}
            {!scheduleMode && !editMode && aggregateVotes > 0 && (
              <p
                role="status"
                aria-label={`${aggregateVotes} vote${aggregateVotes !== 1 ? 's' : ''} for ${artist.name}`}
                className="flex items-center gap-1"
              >
                <span
                  className={`font-medium text-center ${compact ? 'text-xs w-4' : 'text-sm w-5'} ${textColor}`}
                  aria-hidden="true"
                >
                  {aggregateVotes}
                </span>
                {!compact && (
                  <span className="text-xs text-black/50 uppercase tracking-wide" aria-hidden="true">
                    votes
                  </span>
                )}
              </p>
            )}

            {/* Edit mode, admin-locked: show user's vote count */}
            {editMode && locked && voteCount > 0 && (
              <p
                role="status"
                aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''} for ${artist.name}`}
                className="flex items-center gap-1"
              >
                <span
                  className={`font-medium text-center ${compact ? 'text-xs w-4' : 'text-sm w-5'} ${textColor}`}
                  aria-hidden="true"
                >
                  {voteCount}
                </span>
              </p>
            )}

            {/* Edit mode, multi-vote, non-compact: inline +/− buttons */}
            {editMode && !locked && allowMultiVote && !compact && (
              <div
                className="flex items-center gap-2"
                role="group"
                aria-label={`Votes for ${artist.name}`}
              >
                <button
                  type="button"
                  data-testid={`decrement-${artist.id}`}
                  onClick={() => onVote(-1)}
                  disabled={!canDecrement}
                  aria-label={`Remove vote from ${artist.name}`}
                  className="bg-black hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold w-8 h-8 text-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark"
                >
                  −
                </button>
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''}`}
                  className={`text-center font-semibold w-6 text-sm ${textColor}`}
                >
                  {voteCount}
                </span>
                <button
                  type="button"
                  data-testid={`increment-${artist.id}`}
                  onClick={() => onVote(1)}
                  disabled={!canIncrement}
                  aria-label={`Add vote for ${artist.name}`}
                  className="bg-black hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold w-8 h-8 text-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

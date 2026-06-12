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
  maxVotes: number        // highest aggregate vote count on any artist in the room
  maxUserVotes: number    // highest personal vote count on any single artist
  onVote: (delta: 1 | -1) => void
  locked: boolean
  remainingBudget: number
  allowMultiVote: boolean
  editMode: boolean
  compact?: boolean
}

export default function ArtistBlock({
  artist,
  voteCount,
  aggregateVotes,
  maxVotes,
  maxUserVotes,
  onVote,
  locked,
  remainingBudget,
  allowMultiVote,
  editMode,
  compact = false,
}: Props) {
  const canIncrement = !locked && remainingBudget > 0
  const canDecrement = !locked && voteCount > 0

  const isToggleMode = editMode && !allowMultiVote && !locked

  const grayedOut = !editMode && aggregateVotes === 0

  let backgroundColor: string | undefined
  if (!grayedOut) {
    if (!editMode && aggregateVotes > 0 && maxVotes > 0) {
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
    onVote(voteCount > 0 ? -1 : 1)
  }

  const textColor = 'text-black'

  const compactMultiVote = compact && editMode && !locked && allowMultiVote

  return (
    <div
      className={`border border-tealDark relative overflow-hidden h-full transition-colors ${
        compactMultiVote ? 'flex flex-row p-1.5 gap-2' : compact ? 'flex flex-col p-1.5 gap-1' : 'flex flex-col p-4 gap-2'
      } ${grayedOut ? 'bg-grayLight' : ''} ${isToggleMode ? 'cursor-pointer select-none' : ''}`}
      style={backgroundColor ? { backgroundColor } : undefined}
      onClick={isToggleMode ? handleToggle : undefined}
      role={isToggleMode ? 'button' : undefined}
      tabIndex={isToggleMode ? 0 : undefined}
      onKeyDown={
        isToggleMode
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleToggle()
              }
            }
          : undefined
      }
      aria-pressed={isToggleMode ? voteCount > 0 : undefined}
      aria-label={
        isToggleMode
          ? `${voteCount > 0 ? 'Remove vote from' : 'Vote for'} ${artist.name}`
          : undefined
      }
    >
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
            {!editMode && aggregateVotes > 0 && (
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

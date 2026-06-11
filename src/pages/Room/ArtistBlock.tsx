import type { Artist } from '../../types'

function to12Hour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const hour = h ?? 0
  const suffix = hour < 12 ? 'AM' : 'PM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:${String(m ?? 0).padStart(2, '0')} ${suffix}`
}

interface Props {
  artist: Artist
  voteCount: number
  onVote: (delta: 1 | -1) => void
  locked: boolean
  remainingBudget: number
  intensity?: number
  compact?: boolean
}

export default function ArtistBlock({
  artist,
  voteCount,
  onVote,
  locked,
  remainingBudget,
  intensity = 0,
  compact = false,
}: Props) {
  const canIncrement = !locked && remainingBudget > 0
  const canDecrement = !locked && voteCount > 0

  return (
    <div
      className={`border border-tealDark flex flex-col relative overflow-hidden bg-yellow h-full ${
        compact ? 'p-1.5 gap-1' : 'p-4 gap-2'
      }`}
    >
      {/* Popularity intensity overlay — darker tint on yellow */}
      {intensity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `rgba(0, 0, 0, ${intensity * 0.6})` }}
          aria-hidden="true"
        />
      )}

      {/* Artist name */}
      <p
        className={`relative z-10 font-display uppercase text-black leading-tight ${
          compact ? 'text-sm' : 'text-xl'
        }`}
      >
        {artist.name}
      </p>

      {/* Time + vote controls row */}
      <div className={`relative z-10 flex items-center ${compact ? 'gap-1' : 'gap-4'}`}>
        {/* Time / stage */}
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

        {/* Vote controls */}
        {locked ? (
          <p
            role="status"
            aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''} for ${artist.name}`}
            className="flex items-center gap-1"
          >
            <span
              className={`text-black font-medium text-center ${compact ? 'text-xs w-4' : 'text-sm w-5'}`}
              aria-hidden="true"
            >
              {voteCount}
            </span>
            {!compact && (
              <span className="text-xs text-black/50 uppercase tracking-wide" aria-hidden="true">
                votes
              </span>
            )}
          </p>
        ) : (
          <div
            className={`flex items-center ${compact ? 'gap-0.5' : 'gap-2'}`}
            role="group"
            aria-label={`Votes for ${artist.name}`}
          >
            <button
              type="button"
              data-testid={`decrement-${artist.id}`}
              onClick={() => onVote(-1)}
              disabled={!canDecrement}
              aria-label={`Remove vote from ${artist.name}`}
              className={`bg-black hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark ${
                compact ? 'w-5 h-5 text-xs' : 'w-8 h-8 text-lg'
              }`}
            >
              −
            </button>

            <span
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''}`}
              className={`text-center text-black font-semibold ${compact ? 'w-4 text-xs' : 'w-6 text-sm'}`}
            >
              {voteCount}
            </span>

            <button
              type="button"
              data-testid={`increment-${artist.id}`}
              onClick={() => onVote(1)}
              disabled={!canIncrement}
              aria-label={`Add vote for ${artist.name}`}
              className={`bg-black hover:bg-grayCustom disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark ${
                compact ? 'w-5 h-5 text-xs' : 'w-8 h-8 text-lg'
              }`}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

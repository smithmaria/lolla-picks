import type { Artist } from '../../types'

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
      className={`border border-[#333333] flex items-center relative overflow-hidden bg-grayDark h-full ${
        compact ? 'p-1.5 gap-1' : 'p-4 gap-4'
      }`}
    >
      {/* Popularity intensity overlay — yellow tint */}
      {intensity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `rgba(207, 223, 5, ${intensity})` }}
          aria-hidden="true"
        />
      )}

      {/* Artist name + subtitle */}
      <div className="relative z-10 flex-1 min-w-0">
        <p
          className={`text-white font-semibold truncate ${compact ? 'text-xs leading-tight' : ''}`}
        >
          {artist.name}
        </p>
        {!compact && (
          <p className="text-gray-400 text-sm">
            {artist.stage} · {artist.start}–{artist.end}
          </p>
        )}
        {compact && (
          <p className="text-gray-400 text-xs truncate">
            {artist.start}–{artist.end}
          </p>
        )}
      </div>

      {/* Vote controls */}
      {locked ? (
        <p
          role="status"
          aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''} for ${artist.name}`}
          className="relative z-10 flex items-center gap-1"
        >
          <span
            className={`text-gray-300 font-medium text-center ${compact ? 'text-xs w-4' : 'text-sm w-5'}`}
            aria-hidden="true"
          >
            {voteCount}
          </span>
          {!compact && (
            <span className="text-xs text-gray-500 uppercase tracking-wide" aria-hidden="true">
              votes
            </span>
          )}
        </p>
      ) : (
        <div
          className={`relative z-10 flex items-center ${compact ? 'gap-0.5' : 'gap-2'}`}
          role="group"
          aria-label={`Votes for ${artist.name}`}
        >
          <button
            type="button"
            data-testid={`decrement-${artist.id}`}
            onClick={() => onVote(-1)}
            disabled={!canDecrement}
            aria-label={`Remove vote from ${artist.name}`}
            className={`bg-grayCustom hover:bg-[#3a3a3a] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark ${
              compact ? 'w-5 h-5 text-xs' : 'w-8 h-8 text-lg'
            }`}
          >
            −
          </button>

          <span
            aria-live="polite"
            aria-atomic="true"
            aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''}`}
            className={`text-center text-white font-semibold ${compact ? 'w-4 text-xs' : 'w-6 text-sm'}`}
          >
            {voteCount}
          </span>

          <button
            type="button"
            data-testid={`increment-${artist.id}`}
            onClick={() => onVote(1)}
            disabled={!canIncrement}
            aria-label={`Add vote for ${artist.name}`}
            className={`bg-yellow hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-tealDark ${
              compact ? 'w-5 h-5 text-xs' : 'w-8 h-8 text-lg'
            }`}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

import type { Artist } from '../../types'

interface Props {
  artist: Artist
  voteCount: number
  onVote: (delta: 1 | -1) => void
  locked: boolean
  remainingBudget: number
}

export default function ArtistBlock({
  artist,
  voteCount,
  onVote,
  locked,
  remainingBudget,
}: Props) {
  const canIncrement = !locked && remainingBudget > 0
  const canDecrement = !locked && voteCount > 0

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{artist.name}</p>
        <p className="text-gray-400 text-sm">
          {artist.stage} · {artist.start}–{artist.end}
        </p>
      </div>

      {locked ? (
        <p
          role="status"
          aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''} for ${artist.name}`}
          className="flex items-center gap-2"
        >
          <span className="text-gray-300 text-sm font-medium w-5 text-center" aria-hidden="true">
            {voteCount}
          </span>
          <span className="text-xs text-gray-500 uppercase tracking-wide" aria-hidden="true">
            votes
          </span>
        </p>
      ) : (
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
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            −
          </button>

          <span
            aria-live="polite"
            aria-atomic="true"
            aria-label={`${voteCount} vote${voteCount !== 1 ? 's' : ''}`}
            className="w-6 text-center text-white font-semibold text-sm"
          >
            {voteCount}
          </span>

          <button
            type="button"
            data-testid={`increment-${artist.id}`}
            onClick={() => onVote(1)}
            disabled={!canIncrement}
            aria-label={`Add vote for ${artist.name}`}
            className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

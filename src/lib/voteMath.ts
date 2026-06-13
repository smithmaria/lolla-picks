import type { Day, RoomSettings } from '../types'

export type VotesByArtist = Record<string, number>

/** Minimal shape of a lineup entry needed for vote scoping. */
export interface LineupEntry {
  id: string
  day: string
}

/**
 * Total votes a user has spent, respecting the room's vote scope.
 * - 'overall': sum of every vote across all artists.
 * - 'per_day': sum of votes only for artists playing on `day`.
 *   Returns 0 when no day is provided (a per-day total is meaningless without one).
 */
export function votesUsed(
  votesByArtist: VotesByArtist,
  settings: RoomSettings,
  lineup: LineupEntry[],
  day?: Day,
): number {
  if (settings.vote_scope === 'overall') {
    return Object.values(votesByArtist).reduce((sum, n) => sum + n, 0)
  }

  if (!day) return 0

  const artistIdsForDay = new Set(
    lineup.filter(a => a.day === day).map(a => a.id),
  )

  return Object.entries(votesByArtist)
    .filter(([artistId]) => artistIdsForDay.has(artistId))
    .reduce((sum, [, count]) => sum + count, 0)
}

/** Votes still available under the limit (never negative). */
export function votesRemaining(
  votesByArtist: VotesByArtist,
  settings: RoomSettings,
  lineup: LineupEntry[],
  day?: Day,
): number {
  return Math.max(0, settings.votes_per_user - votesUsed(votesByArtist, settings, lineup, day))
}

/** True when the user has spent more than the allowed number of votes. */
export function isOverLimit(
  votesByArtist: VotesByArtist,
  settings: RoomSettings,
  lineup: LineupEntry[],
  day?: Day,
): boolean {
  return votesUsed(votesByArtist, settings, lineup, day) > settings.votes_per_user
}

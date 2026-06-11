import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import lineup from '../data/lineup-2026.json'
import type { Day, RoomSettings } from '../types'

type VotesByArtist = Record<string, number>

interface UseVotesResult {
  votesByArtist: VotesByArtist
  castVote: (artistId: string, delta: 1 | -1) => Promise<void>
  votesRemaining: (day?: Day) => number
  votesError: string | null
}

export function useVotes(
  roomId: string,
  userId: string,
  settings: RoomSettings,
): UseVotesResult {
  const [votesByArtist, setVotesByArtist] = useState<VotesByArtist>({})
  const [votesError, setVotesError] = useState<string | null>(null)

  useEffect(() => {
    // Skip malformed/unready arguments
    if (!roomId || !userId) return

    const controller = new AbortController()

    async function fetchVotes() {
      const { data, error } = await supabase
        .from('votes')
        .select('artist_id, vote_count')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .abortSignal(controller.signal)

      if (controller.signal.aborted) return

      if (error) {
        setVotesError('Failed to load votes. Please refresh.')
        return
      }

      const map: VotesByArtist = {}
      for (const row of data ?? []) {
        map[row.artist_id as string] = row.vote_count as number
      }
      setVotesByArtist(map)
    }

    fetchVotes()
    return () => controller.abort()
  }, [roomId, userId])

  const castVote = useCallback(
    async (artistId: string, delta: 1 | -1) => {
      // Read current from functional updater to avoid stale closure
      let current = 0
      setVotesByArtist(prev => {
        current = prev[artistId] ?? 0
        const next = Math.max(0, current + delta)
        return { ...prev, [artistId]: next }
      })

      const next = Math.max(0, current + delta)

      const { error } = await supabase.from('votes').upsert(
        {
          room_id: roomId,
          user_id: userId,
          artist_id: artistId,
          vote_count: next,
        },
        { onConflict: 'room_id,user_id,artist_id' },
      )

      if (error) {
        // Revert optimistic update on failure
        setVotesByArtist(prev => ({ ...prev, [artistId]: current }))
        setVotesError('Failed to save vote. Please try again.')
      } else {
        setVotesError(null)
      }
    },
    [roomId, userId],
  )

  const votesRemaining = useCallback(
    (day?: Day): number => {
      const { votes_per_user, vote_scope } = settings

      if (vote_scope === 'overall') {
        const used = Object.values(votesByArtist).reduce((sum, n) => sum + n, 0)
        return Math.max(0, votes_per_user - used)
      }

      // per_day: need the day argument to filter artists
      if (!day) return votes_per_user

      const artistIdsForDay = new Set(
        (lineup as Array<{ id: string; day: string }>)
          .filter(a => a.day === day)
          .map(a => a.id),
      )

      const used = Object.entries(votesByArtist)
        .filter(([artistId]) => artistIdsForDay.has(artistId))
        .reduce((sum, [, count]) => sum + count, 0)

      return Math.max(0, votes_per_user - used)
    },
    [settings, votesByArtist],
  )

  return { votesByArtist, castVote, votesRemaining, votesError }
}

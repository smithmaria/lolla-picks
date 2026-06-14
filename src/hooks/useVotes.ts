import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import lineup from '../data/lineup-2026.json'
import type { Day, RoomSettings } from '../types'
import {
  isOverLimit as computeIsOverLimit,
  votesRemaining as computeVotesRemaining,
  type LineupEntry,
  type VotesByArtist,
} from '../lib/voteMath'

interface UseVotesResult {
  votesByArtist: VotesByArtist
  castVote: (artistId: string, delta: 1 | -1) => void
  votesRemaining: (day?: Day) => number
  isOverLimit: (day?: Day) => boolean
  votesError: string | null
}

export function useVotes(
  roomId: string,
  userId: string,
  clientToken: string,
  settings: RoomSettings,
): UseVotesResult {
  const [votesByArtist, setVotesByArtist] = useState<VotesByArtist>({})
  const [votesError, setVotesError] = useState<string | null>(null)

  const intendedVotes = useRef<Record<string, number>>({})
  const pendingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
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

    const channel = supabase
      .channel(`votes-self:${roomId}:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` },
        payload => {
          const row = payload.new as { user_id: string; artist_id: string; vote_count: number }
          if (row.user_id !== userId) return
          if (pendingTimers.current[row.artist_id] !== undefined) return // local state is ahead
          setVotesByArtist(prev => ({ ...prev, [row.artist_id]: row.vote_count }))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` },
        payload => {
          const row = payload.old as { user_id: string; artist_id: string }
          if (row.user_id !== userId) return
          setVotesByArtist(prev => {
            const next = { ...prev }
            delete next[row.artist_id]
            return next
          })
        },
      )
      .subscribe()

    return () => {
      controller.abort()
      supabase.removeChannel(channel)
      for (const t of Object.values(pendingTimers.current)) clearTimeout(t)
    }
  }, [roomId, userId])

  const castVote = useCallback(
    (artistId: string, delta: 1 | -1) => {
      setVotesByArtist(prev => {
        const next = Math.max(0, (prev[artistId] ?? 0) + delta)
        intendedVotes.current[artistId] = next
        return { ...prev, [artistId]: next }
      })

      clearTimeout(pendingTimers.current[artistId])
      pendingTimers.current[artistId] = setTimeout(async () => {
        delete pendingTimers.current[artistId]
        const voteCount = intendedVotes.current[artistId] ?? 0
        const { error } = await supabase.rpc('cast_vote', {
          p_room_id: roomId,
          p_user_id: userId,
          p_client_token: clientToken,
          p_artist_id: artistId,
          p_vote_count: voteCount,
        })
        if (error) {
          setVotesError('Failed to save vote. Please try again.')
        } else {
          setVotesError(null)
        }
      }, 400)
    },
    [roomId, userId, clientToken],
  )

  const votesRemaining = useCallback(
    (day?: Day): number =>
      computeVotesRemaining(votesByArtist, settings, lineup as LineupEntry[], day),
    [settings, votesByArtist],
  )

  const isOverLimit = useCallback(
    (day?: Day): boolean =>
      computeIsOverLimit(votesByArtist, settings, lineup as LineupEntry[], day),
    [settings, votesByArtist],
  )

  return { votesByArtist, castVote, votesRemaining, isOverLimit, votesError }
}

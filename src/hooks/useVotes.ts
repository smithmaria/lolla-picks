import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import lineup from '../data/lineup-2026.json'
import type { Day, RoomSettings } from '../types'

type VotesByArtist = Record<string, number>

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
        const { error } = await supabase.from('votes').upsert(
          { room_id: roomId, user_id: userId, artist_id: artistId, vote_count: voteCount },
          { onConflict: 'room_id,user_id,artist_id' },
        )
        if (error) {
          setVotesError('Failed to save vote. Please try again.')
        } else {
          setVotesError(null)
        }
      }, 400)
    },
    [roomId, userId],
  )

  const votesUsed = useCallback(
    (day?: Day): number => {
      const { vote_scope } = settings

      if (vote_scope === 'overall') {
        return Object.values(votesByArtist).reduce((sum, n) => sum + n, 0)
      }

      if (!day) return 0

      const artistIdsForDay = new Set(
        (lineup as Array<{ id: string; day: string }>)
          .filter(a => a.day === day)
          .map(a => a.id),
      )

      return Object.entries(votesByArtist)
        .filter(([artistId]) => artistIdsForDay.has(artistId))
        .reduce((sum, [, count]) => sum + count, 0)
    },
    [settings, votesByArtist],
  )

  const votesRemaining = useCallback(
    (day?: Day): number => Math.max(0, settings.votes_per_user - votesUsed(day)),
    [settings, votesUsed],
  )

  const isOverLimit = useCallback(
    (day?: Day): boolean => votesUsed(day) > settings.votes_per_user,
    [settings, votesUsed],
  )

  return { votesByArtist, castVote, votesRemaining, isOverLimit, votesError }
}

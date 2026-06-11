import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVotes } from '../../hooks/useVotes'
import DayTabs from './DayTabs'
import NameEntry from './NameEntry'
import ScheduleGrid from './ScheduleGrid'
import VoteBudget from './VoteBudget'
import lineup from '../../data/lineup-2026.json'
import type { Artist, Day, LocalSession, Room as RoomType, RoomSettings } from '../../types'

const allArtists = lineup as Artist[]

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const [room, setRoom] = useState<RoomType | null>(null)
  const [session, setSession] = useState<LocalSession | null>(null)
  const [activeDay, setActiveDay] = useState<Day | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  // Seed: aggregate from all users fetched at load time
  const [roomVotesSeed, setRoomVotesSeed] = useState<Record<string, number>>({})
  const [seedUserVotes, setSeedUserVotes] = useState<Record<string, number>>({})

  const fallbackSettings = useMemo<RoomSettings>(
    () => ({ days: [], votes_per_user: 0, vote_scope: 'overall' }),
    [],
  )

  useEffect(() => {
    if (!roomId) return

    const stored = localStorage.getItem(`lolla-user-${roomId}`)
    if (stored) {
      try {
        setSession(JSON.parse(stored) as LocalSession)
      } catch {
        localStorage.removeItem(`lolla-user-${roomId}`)
      }
    }

    async function fetchRoom() {
      const [roomResult, votesResult] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).single(),
        supabase
          .from('votes')
          .select('artist_id, vote_count, user_id')
          .eq('room_id', roomId),
      ])

      setLoading(false)

      if (roomResult.error || !roomResult.data) {
        setNotFound(true)
        return
      }

      const fetched = roomResult.data as RoomType
      setRoom(fetched)
      setActiveDay(fetched.settings.days[0] ?? null)

      if (!votesResult.error && votesResult.data) {
        const aggregate: Record<string, number> = {}
        const userSeed: Record<string, number> = {}

        // Parse current user id from localStorage (set earlier in this effect)
        let currentUserId: string | null = null
        const stored = localStorage.getItem(`lolla-user-${roomId}`)
        if (stored) {
          try {
            currentUserId = (JSON.parse(stored) as { user_id: string }).user_id
          } catch {
            // ignore
          }
        }

        for (const row of votesResult.data) {
          const id = row.artist_id as string
          const count = row.vote_count as number
          const uid = row.user_id as string
          aggregate[id] = (aggregate[id] ?? 0) + count
          if (currentUserId && uid === currentUserId) {
            userSeed[id] = count
          }
        }
        setRoomVotesSeed(aggregate)
        setSeedUserVotes(userSeed)
      }
    }

    fetchRoom()
  }, [roomId])

  const { votesByArtist, castVote, votesRemaining, votesError } = useVotes(
    roomId ?? '',
    session?.user_id ?? '',
    room?.settings ?? fallbackSettings,
  )

  /**
   * Keep aggregate votes current as the user casts votes.
   * Formula: seed aggregate − user's seed votes + user's current live votes.
   * This means other users' votes from the seed remain intact, and the current
   * user's contribution reflects their real-time state.
   */
  const allRoomVotes = useMemo(() => {
    const merged = { ...roomVotesSeed }
    // Remove seed user votes and apply live user votes (clamp to 0 to guard against race conditions)
    for (const [id, seedCount] of Object.entries(seedUserVotes)) {
      merged[id] = Math.max(0, (merged[id] ?? 0) - seedCount)
    }
    for (const [id, liveCount] of Object.entries(votesByArtist)) {
      merged[id] = (merged[id] ?? 0) + liveCount
    }
    return merged
  }, [roomVotesSeed, seedUserVotes, votesByArtist])

  const handleVote = useCallback(
    (artistId: string, delta: 1 | -1) => {
      if (session) void castVote(artistId, delta)
    },
    [session, castVote],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  if (notFound || !room) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-2">Room not found</p>
          <p className="text-gray-400 text-sm">
            This link may be invalid or the room was deleted.
          </p>
        </div>
      </div>
    )
  }

  const locked = room.status === 'locked'

  const dayArtists = activeDay
    ? allArtists.filter(a => a.day === activeDay)
    : []

  const remaining =
    activeDay !== null
      ? votesRemaining(room.settings.vote_scope === 'per_day' ? activeDay : undefined)
      : room.settings.votes_per_user

  return (
    <div className="min-h-screen bg-gray-950">
      {!session && (
        <NameEntry
          roomId={room.id}
          onSuccess={s => setSession(s)}
        />
      )}

      {/* Narrow header controls */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            {room.display_name ?? 'Lolla Scheduler'}
          </h1>
          <p className="text-gray-400 text-sm">
            {room.settings.vote_scope === 'per_day'
              ? `${room.settings.votes_per_user} votes per day`
              : `${room.settings.votes_per_user} votes total`}
          </p>
          {session?.is_admin && (
            <p className="text-indigo-400 text-xs mt-1">You are the room admin</p>
          )}
          {locked && (
            <p className="text-yellow-400 text-xs mt-1 font-medium">
              Voting is locked
            </p>
          )}
        </div>

        <DayTabs
          days={room.settings.days}
          activeDay={activeDay}
          onChange={setActiveDay}
        />

        {session && (
          <div className="mb-4">
            <VoteBudget
              remaining={remaining}
              total={room.settings.votes_per_user}
              scope={room.settings.vote_scope}
              activeDay={
                room.settings.vote_scope === 'per_day' && activeDay
                  ? activeDay
                  : undefined
              }
            />
          </div>
        )}

        {votesError && (
          <div
            role="alert"
            className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm"
          >
            {votesError}
          </div>
        )}
      </div>

      {/* Full-width schedule grid */}
      <div className="px-32 pb-8">
        <div
          id={activeDay ? `panel-${activeDay}` : undefined}
          role="tabpanel"
          aria-labelledby={activeDay ? `tab-${activeDay}` : undefined}
          tabIndex={0}
          className="focus:outline-none"
        >
          <ScheduleGrid
            artists={dayArtists}
            votesByArtist={votesByArtist}
            allRoomVotes={allRoomVotes}
            onVote={handleVote}
            locked={locked || !session}
            remainingBudget={remaining}
          />
        </div>
      </div>
    </div>
  )
}

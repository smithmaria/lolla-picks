import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRoom } from '../../hooks/useRoom'
import { useVotes } from '../../hooks/useVotes'
import AdminPanel from './AdminPanel'
import DayTabs from './DayTabs'
import NameEntry from './NameEntry'
import ScheduleGrid from './ScheduleGrid'
import VoteBudget from './VoteBudget'
import lineup from '../../data/lineup-2026.json'
import type { Artist, Day, LocalSession, RoomSettings } from '../../types'

const allArtists = lineup as Artist[]

// Per-user vote map: userId -> artistId -> voteCount
type UserVoteMap = Record<string, Record<string, number>>

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const { room, loading, notFound } = useRoom(roomId)
  const [session, setSession] = useState<LocalSession | null>(null)
  const [activeDay, setActiveDay] = useState<Day | null>(null)
  const [allUserVotes, setAllUserVotes] = useState<UserVoteMap>({})
  const [adminOpen, setAdminOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const fallbackSettings = useMemo<RoomSettings>(
    () => ({ days: [], votes_per_user: 0, vote_scope: 'overall' }),
    [],
  )

  // Read session from localStorage
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
  }, [roomId])

  // Set active day when room first loads; fall back if admin removes the active day
  useEffect(() => {
    if (!room) return
    if (!activeDay || !room.settings.days.includes(activeDay)) {
      setActiveDay(room.settings.days[0] ?? null)
    }
  }, [room, activeDay])

  // Fetch all votes for this room + subscribe to real-time changes
  useEffect(() => {
    if (!roomId) return

    supabase
      .from('votes')
      .select('user_id, artist_id, vote_count')
      .eq('room_id', roomId)
      .then(({ data, error }) => {
        if (error || !data) return
        const map: UserVoteMap = {}
        for (const row of data) {
          const uid = row.user_id as string
          if (!map[uid]) map[uid] = {}
          map[uid][row.artist_id as string] = row.vote_count as number
        }
        setAllUserVotes(map)
      })

    const channel = supabase
      .channel(`votes:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          const row = (
            payload.eventType === 'DELETE' ? payload.old : payload.new
          ) as { user_id: string; artist_id: string; vote_count: number }
          const count =
            payload.eventType === 'DELETE'
              ? 0
              : (payload.new as { vote_count: number }).vote_count
          setAllUserVotes(prev => ({
            ...prev,
            [row.user_id]: {
              ...(prev[row.user_id] ?? {}),
              [row.artist_id]: count,
            },
          }))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  const { votesByArtist, castVote, votesRemaining, votesError } = useVotes(
    roomId ?? '',
    session?.user_id ?? '',
    room?.settings ?? fallbackSettings,
  )

  /**
   * Aggregate votes from all users.
   * Other users' votes come from allUserVotes (kept live via subscription).
   * Current user's votes come from votesByArtist (optimistically updated by useVotes).
   * Keeping them separate avoids double-counting during optimistic updates.
   */
  const allRoomVotes = useMemo(() => {
    const aggregate: Record<string, number> = {}
    const currentUserId = session?.user_id
    for (const [uid, votes] of Object.entries(allUserVotes)) {
      if (uid === currentUserId) continue
      for (const [artistId, count] of Object.entries(votes)) {
        aggregate[artistId] = (aggregate[artistId] ?? 0) + count
      }
    }
    for (const [artistId, count] of Object.entries(votesByArtist)) {
      aggregate[artistId] = (aggregate[artistId] ?? 0) + count
    }
    return aggregate
  }, [allUserVotes, votesByArtist, session?.user_id])

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
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">
              {room.display_name ?? 'Lolla Scheduler'}
            </h1>
            <button
              type="button"
              onClick={copyLink}
              className="text-xs font-medium px-3 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            {room.settings.vote_scope === 'per_day'
              ? `${room.settings.votes_per_user} votes per day`
              : `${room.settings.votes_per_user} votes total`}
          </p>
          {session?.is_admin && (
            <button
              type="button"
              onClick={() => setAdminOpen(o => !o)}
              className="text-indigo-400 text-xs mt-1 hover:text-indigo-300 transition-colors"
            >
              {adminOpen ? 'Hide admin panel ▲' : 'Admin panel ▼'}
            </button>
          )}
        </div>

        {session?.is_admin && adminOpen && <AdminPanel room={room} />}

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
            locked={!session}
            remainingBudget={remaining}
          />
        </div>
      </div>
    </div>
  )
}

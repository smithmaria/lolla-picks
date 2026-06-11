import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVotes } from '../../hooks/useVotes'
import NameEntry from './NameEntry'
import ArtistBlock from './ArtistBlock'
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
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      setLoading(false)

      if (error || !data) {
        setNotFound(true)
        return
      }

      const fetched = data as RoomType
      setRoom(fetched)
      setActiveDay(fetched.settings.days[0] ?? null)
    }

    fetchRoom()
  }, [roomId])

  const { votesByArtist, castVote, votesRemaining, votesError } = useVotes(
    roomId ?? '',
    session?.user_id ?? '',
    room?.settings ?? fallbackSettings,
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

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
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

        {/* Day tabs */}
        <div
          className="flex gap-2 mb-4"
          role="tablist"
          aria-label="Festival days"
        >
          {room.settings.days.map(day => (
            <button
              key={day}
              type="button"
              role="tab"
              id={`tab-${day}`}
              aria-selected={activeDay === day}
              aria-controls={`panel-${day}`}
              data-testid={`day-tab-${day}`}
              onClick={() => setActiveDay(day)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                activeDay === day
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Vote budget */}
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

        {/* Error banner */}
        {votesError && (
          <div
            role="alert"
            className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm"
          >
            {votesError}
          </div>
        )}

        {/* Artist list — tabpanel */}
        <div
          id={activeDay ? `panel-${activeDay}` : undefined}
          role="tabpanel"
          aria-labelledby={activeDay ? `tab-${activeDay}` : undefined}
          className="flex flex-col gap-3"
        >
          {dayArtists.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No artists scheduled for this day.
            </p>
          ) : (
            dayArtists.map(artist => (
              <ArtistBlock
                key={artist.id}
                artist={artist}
                voteCount={votesByArtist[artist.id] ?? 0}
                onVote={delta => {
                  if (session) {
                    void castVote(artist.id, delta)
                  }
                }}
                locked={locked || !session}
                remainingBudget={remaining}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

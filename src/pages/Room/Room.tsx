import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRoom } from '../../hooks/useRoom'
import { useRoomMembers } from '../../hooks/useRoomMembers'
import { useVotes } from '../../hooks/useVotes'
import AdminPanel from './AdminPanel'
import DayTabs from './DayTabs'
import MembersPanel from './MembersPanel'
import NameEntry from './NameEntry'
import ScheduleExport from './ScheduleExport'
import ScheduleGrid from './ScheduleGrid'
import VoteBudget from './VoteBudget'
import lineup from '../../data/lineup-2026.json'
import type { Artist, Day, LocalSession, RoomSettings } from '../../types'

const allArtists = lineup as Artist[]

// Per-user vote map: userId -> artistId -> voteCount
type UserVoteMap = Record<string, Record<string, number>>

type Tab = 'picks' | 'votes' | 'schedule'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { room, loading, notFound } = useRoom(roomId)
  const [session, setSession] = useState<LocalSession | null>(null)
  const [activeDay, setActiveDay] = useState<Day | null>(null)
  const [allUserVotes, setAllUserVotes] = useState<UserVoteMap>({})
  const { members, loaded: membersLoaded, removeMember } = useRoomMembers(roomId)
  const [adminOpen, setAdminOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<Tab>('picks')
  const [schedulePicks, setSchedulePicks] = useState<string[]>([])
  const [scheduleAdminOnly, setScheduleAdminOnly] = useState(true)

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
        const parsed = JSON.parse(stored) as LocalSession
        if (!parsed.display_name) {
          localStorage.removeItem(`lolla-user-${roomId}`)
        } else {
          setSession(parsed)
        }
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

  // Sync shared schedule picks from room settings (kept live via room subscription)
  useEffect(() => {
    setSchedulePicks(room?.settings.schedule_picks ?? [])
  }, [room?.settings.schedule_picks])

  // Sync admin-only edit lock from room settings (defaults to locked)
  useEffect(() => {
    setScheduleAdminOnly(room?.settings.schedule_admin_only ?? true)
  }, [room?.settings.schedule_admin_only])

  const toggleScheduleAdminOnly = useCallback(async () => {
    if (!room) return
    const prev = scheduleAdminOnly
    const next = !prev
    setScheduleAdminOnly(next)
    const { error } = await supabase
      .from('rooms')
      .update({ settings: { ...room.settings, schedule_admin_only: next } })
      .eq('id', room.id)
    if (error) setScheduleAdminOnly(prev)
  }, [room, scheduleAdminOnly])

  // Toggle an artist on/off the shared schedule, persisted in room settings
  const toggleSchedulePick = useCallback(
    async (artistId: string) => {
      if (!room) return
      const prev = schedulePicks
      const next = prev.includes(artistId)
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId]
      setSchedulePicks(next)
      const { error } = await supabase
        .from('rooms')
        .update({ settings: { ...room.settings, schedule_picks: next } })
        .eq('id', room.id)
      if (error) setSchedulePicks(prev)
    },
    [room, schedulePicks],
  )

  // Display names for all room users, kept live by the members subscription
  const userNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of members) map[m.id] = m.display_name
    return map
  }, [members])

  // If the admin removes the current user, drop their session back to name entry
  useEffect(() => {
    if (!roomId || !session || !membersLoaded) return
    if (!members.some(m => m.id === session.user_id)) {
      localStorage.removeItem(`lolla-user-${roomId}`)
      setSession(null)
    }
  }, [roomId, session, members, membersLoaded])

  // When a member is removed, clear their votes from local state
  useEffect(() => {
    if (!membersLoaded) return
    const memberIds = new Set(members.map(m => m.id))
    setAllUserVotes(prev => {
      const next = { ...prev }
      let changed = false
      for (const uid of Object.keys(next)) {
        if (!memberIds.has(uid)) {
          delete next[uid]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [members, membersLoaded])

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

  // Per-artist list of voter display names (for room votes tooltip)
  const votersByArtist = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const [uid, votes] of Object.entries(allUserVotes)) {
      const name = userNames[uid] ?? 'Someone'
      for (const [artistId, count] of Object.entries(votes)) {
        if (count > 0) {
          if (!map[artistId]) map[artistId] = []
          map[artistId].push(name)
        }
      }
    }
    return map
  }, [allUserVotes, userNames])

  const handleVote = useCallback(
    (artistId: string, delta: 1 | -1) => {
      if (session) void castVote(artistId, delta)
    },
    [session, castVote],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-400 font-display uppercase tracking-widest">Loading…</p>
      </div>
    )
  }

  if (notFound || !room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
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

  const schedulePickIds = new Set(schedulePicks)

  const remaining =
    activeDay !== null
      ? votesRemaining(room.settings.vote_scope === 'per_day' ? activeDay : undefined)
      : room.settings.votes_per_user

  return (
    <div className="min-h-screen bg-black">
      {!session && (
        <NameEntry
          roomId={room.id}
          onSuccess={s => setSession(s)}
        />
      )}

      {/* Header controls — matches schedule grid width */}
      <div className="px-4 md:px-32 pt-6 pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-display uppercase tracking-widest text-gray-500 hover:text-white transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Home
        </Link>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white">
                {room.display_name ?? 'Lolla Picks'}
              </h1>
              <button
                type="button"
                onClick={copyLink}
                className="text-sm font-display uppercase px-4 py-1.5 border border-[#333333] text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              {session?.is_admin && (
                <button
                  type="button"
                  onClick={() => setAdminOpen(true)}
                  aria-label="Open admin panel"
                  className="text-gray-500 hover:text-yellow transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <circle cx="12" cy="12" r="3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <p className="text-gray-400 text-sm">
                {room.settings.vote_scope === 'per_day'
                  ? `${room.settings.votes_per_user} votes per day`
                  : `${room.settings.votes_per_user} votes total`}
              </p>
              {session && (
                <p className="text-sm text-gray-500">
                  voting as <span className="text-white font-medium">{session.display_name}</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => setMembersOpen(true)}
                aria-label="View room members"
                className="inline-flex items-center gap-1.5 text-xs font-display uppercase text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                {members.length}
              </button>
            </div>
          </div>

          {/* View navigation — top right of header */}
          <div className="flex items-center gap-4 sm:shrink-0">
            <div className="flex border border-[#333333] text-sm font-display uppercase">
              {([
                ['picks', 'My Picks'],
                ['votes', 'Room Votes'],
              ] as [Tab, string][]).map(([value, label], i) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`px-5 py-2.5 transition-colors ${
                    i > 0 ? 'border-l border-[#333333]' : ''
                  } ${
                    tab === value
                      ? 'bg-yellow text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTab('schedule')}
              aria-pressed={tab === 'schedule'}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-display uppercase border transition-colors ${
                tab === 'schedule'
                  ? 'bg-teal border-teal text-black'
                  : 'border-tealDark text-teal hover:bg-teal/10'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="5" width="18" height="16" rx="0" />
                <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              Build Schedule
            </button>
          </div>
        </div>

        {session?.is_admin && adminOpen && (
          <AdminPanel
            room={room}
            onClose={() => setAdminOpen(false)}
            onDeleted={() => navigate('/')}
          />
        )}

        {membersOpen && (
          <MembersPanel
            members={members}
            currentUserId={session?.user_id}
            onRemove={session?.is_admin ? removeMember : undefined}
            onClose={() => setMembersOpen(false)}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <DayTabs
            days={room.settings.days}
            activeDay={activeDay}
            onChange={setActiveDay}
          />

          <div className="flex items-center gap-4 sm:shrink-0">
            {tab === 'schedule' ? (
              <>
                {session?.is_admin && (
                  <button
                    type="button"
                    onClick={toggleScheduleAdminOnly}
                    aria-pressed={scheduleAdminOnly}
                    aria-label={
                      scheduleAdminOnly
                        ? 'Only admin can edit — click to let everyone edit'
                        : 'Everyone can edit — click to lock editing to admin'
                    }
                    title={
                      scheduleAdminOnly
                        ? 'Only admin can edit — click to let everyone edit'
                        : 'Everyone can edit — click to lock editing to admin'
                    }
                    className={`flex items-center gap-2 px-4 py-2.5 border text-sm font-display uppercase transition-colors ${
                      scheduleAdminOnly
                        ? 'border-[#333333] text-gray-400 hover:text-white hover:border-gray-500'
                        : 'border-tealgreen text-tealgreen hover:opacity-80'
                    }`}
                  >
                    {scheduleAdminOnly ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="5" y="11" width="14" height="10" />
                        <path strokeLinecap="round" d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="5" y="11" width="14" height="10" />
                        <path strokeLinecap="round" d="M8 11V7a4 4 0 0 1 7.5-2" />
                      </svg>
                    )}
                    {scheduleAdminOnly ? 'Admin only' : 'Everyone edits'}
                  </button>
                )}
                <ScheduleExport
                  artists={allArtists}
                  days={room.settings.days}
                  selectedIds={schedulePickIds}
                  roomName={room.display_name ?? 'Lolla Picks'}
                />
              </>
            ) : (
              session && (
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
              )
            )}
          </div>
        </div>

        {tab === 'schedule' && scheduleAdminOnly && !session?.is_admin && (
          <div
            role="status"
            className="bg-teal/10 border border-tealDark text-teal px-4 py-3 mb-4 text-sm"
          >
            The admin has schedule editing locked, so only they can pick artists right
            now. You can still browse it and export images.
          </div>
        )}

        {votesError && (
          <div
            role="alert"
            className="bg-red/20 border border-red text-red px-4 py-3 mb-4 text-sm"
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
            allowMultiVote={room.settings.allow_multi_vote ?? false}
            votersByArtist={votersByArtist}
            editMode={tab === 'picks'}
            scheduleMode={tab === 'schedule'}
            scheduleSelectedIds={schedulePickIds}
            onScheduleToggle={
              tab === 'schedule' && session && (session.is_admin || !scheduleAdminOnly)
                ? toggleSchedulePick
                : undefined
            }
          />
        </div>
      </div>
    </div>
  )
}

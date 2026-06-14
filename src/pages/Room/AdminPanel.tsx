import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import lineup from '../../data/lineup-2026.json'
import type { Day, LocalSession, Room, VoteScope } from '../../types'

interface Props {
  room: Room
  session: LocalSession
  onClose: () => void
  onDeleted: () => void
}

const ALL_DAYS: { value: Day; label: string }[] = [
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
]

const DAY_ACTIVE: Record<Day, string> = {
  thursday: 'bg-teal border-teal text-black',
  friday: 'bg-blue2 border-blue2 text-black',
  saturday: 'bg-blue3 border-blue3 text-black',
  sunday: 'bg-tealgreen border-tealgreen text-black',
}

export default function AdminPanel({ room, session, onClose, onDeleted }: Props) {
  const [displayName, setDisplayName] = useState(room.display_name ?? '')
  const [days, setDays] = useState<Day[]>(room.settings.days)
  const [votesPerUser, setVotesPerUser] = useState(room.settings.votes_per_user)
  const [voteScope, setVoteScope] = useState<VoteScope>(room.settings.vote_scope)
  const [allowMultiVote, setAllowMultiVote] = useState(room.settings.allow_multi_vote ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  function copyCode() {
    void navigator.clipboard.writeText(room.join_code!)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  useEffect(() => {
    setDays(room.settings.days)
    setVotesPerUser(room.settings.votes_per_user)
    setVoteScope(room.settings.vote_scope)
    setAllowMultiVote(room.settings.allow_multi_vote ?? true)
  }, [room.settings.days, room.settings.votes_per_user, room.settings.vote_scope, room.settings.allow_multi_vote])

  function toggleDay(day: Day) {
    const order = ALL_DAYS.map(d => d.value)
    setDays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      return next.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    })
  }

  async function handleSave() {
    if (days.length === 0) {
      setError('Select at least one day.')
      return
    }
    setSaving(true)
    setError(null)

    // When multi-vote is turned off, existing stacked votes must collapse to 1.
    const clampVotes = (room.settings.allow_multi_vote ?? true) && !allowMultiVote

    // Votes for artists on removed days are no longer valid and must be deleted.
    const removedDays = room.settings.days.filter(d => !days.includes(d))
    const deleteArtistIds = removedDays.length > 0
      ? (lineup as Array<{ id: string; day: string }>)
          .filter(a => removedDays.includes(a.day as Day))
          .map(a => a.id)
      : []

    // One server-side call applies the settings + both vote cleanups atomically,
    // after verifying the caller is an admin.
    const { error: err } = await supabase.rpc('update_room_settings', {
      p_room_id: room.id,
      p_actor_user_id: session.user_id,
      p_client_token: session.client_token,
      p_display_name: displayName.trim() || null,
      p_settings: {
        ...room.settings,
        days,
        votes_per_user: votesPerUser,
        vote_scope: voteScope,
        allow_multi_vote: allowMultiVote,
      },
      p_clamp_votes: clampVotes,
      p_delete_artist_ids: deleteArtistIds.length > 0 ? deleteArtistIds : null,
    })

    setSaving(false)

    if (err) {
      setError('Failed to save settings.')
      return
    }

    onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    // Votes + members cascade-delete with the room; the server verifies admin.
    const { error: err } = await supabase.rpc('delete_room', {
      p_room_id: room.id,
      p_actor_user_id: session.user_id,
      p_client_token: session.client_token,
    })
    setDeleting(false)
    if (err) {
      setError('Failed to delete room.')
      setConfirmDelete(false)
      return
    }
    onDeleted()
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-panel-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-grayCustom border border-[#333333] w-full max-w-sm shadow-2xl overflow-hidden">
        {confirmDelete ? (
          <>
            <div className="p-6 pb-5">
              <h2 className="text-2xl font-bold text-white mb-2">Delete room?</h2>
              <p className="text-gray-400 text-sm">
                This will permanently delete the room and all votes. This cannot be undone.
              </p>
              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            </div>
            <div className="bg-black px-6 py-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="border border-[#333333] text-gray-400 hover:text-white text-base font-display uppercase px-4 py-2.5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="bg-red hover:opacity-90 disabled:opacity-50 text-white text-base font-display uppercase px-5 py-2.5 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete room'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 pb-5">
              <div className="flex items-start justify-between mb-5">
                <h2 id="admin-panel-title" className="text-2xl font-bold text-white">
                  Admin Panel
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close admin panel"
                  className="text-gray-500 hover:text-white transition-colors text-lg leading-none mt-1"
                >
                  ✕
                </button>
              </div>

              {room.join_code && (
                <div className="bg-grayDark border border-[#333333] px-4 py-3 mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Room code</p>
                    <p className="text-2xl font-display tracking-widest text-yellow">{room.join_code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="text-xs text-gray-400 hover:text-white border border-[#333333] px-3 py-1.5 transition-colors"
                  >
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              <div className="space-y-5">
                {/* Room name */}
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Room name</p>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="e.g. Lolla Trippers"
                    className="w-full bg-white text-black px-3 py-2 text-sm border border-[#000000] focus:outline-none focus:border-tealDark focus:ring-1 focus:ring-tealDark"
                  />
                </div>

                {/* Active days */}
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Active days</p>
                  <div className="flex gap-2">
                    {ALL_DAYS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleDay(value)}
                        className={`px-4 py-2 text-base font-display uppercase border transition-colors ${
                          days.includes(value)
                            ? DAY_ACTIVE[value]
                            : 'bg-grayDark border-[#333333] text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vote budget */}
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Vote budget</p>
                  <div className="flex gap-2">
                    {([['overall', 'Overall'], ['per_day', 'Per day']] as [VoteScope, string][]).map(
                      ([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setVoteScope(value)}
                          className={`px-4 py-2 text-base font-display uppercase border transition-colors ${
                            voteScope === value
                              ? 'bg-pink border-pink text-black'
                              : 'bg-grayDark border-[#333333] text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          {label}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Votes per person + stack votes */}
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Votes per person</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVotesPerUser(v => Math.max(1, v - 1))}
                        className="w-9 h-9 bg-white border border-[#333333] text-black font-bold hover:bg-gray-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-tealDark text-lg"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={160}
                        value={votesPerUser}
                        onChange={e => setVotesPerUser(Math.min(160, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-20 bg-white text-black text-center px-2 py-1.5 text-sm border border-[#000000] focus:outline-none focus:border-tealDark [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setVotesPerUser(v => Math.min(160, v + 1))}
                        className="w-9 h-9 bg-white border border-[#333333] text-black font-bold hover:bg-gray-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-tealDark text-lg"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAllowMultiVote(v => !v)}
                      className={`px-4 py-2 border text-base font-display uppercase transition-colors ${
                        allowMultiVote
                          ? 'bg-tealgreen border-tealgreen text-black'
                          : 'bg-grayDark border-[#333333] text-gray-400'
                      }`}
                    >
                      Stack votes
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}
              </div>
            </div>

            <div className="bg-black px-6 py-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="border border-grayCustom text-red/75 hover:text-red hover:border-red/50 text-base font-display uppercase px-4 py-2.5 transition-colors"
              >
                Delete room
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="bg-yellow hover:opacity-90 disabled:opacity-50 text-black text-base font-display uppercase px-5 py-2.5 transition-colors"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

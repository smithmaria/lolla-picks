import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Day, Room, VoteScope } from '../../types'

interface Props {
  room: Room
}

const ALL_DAYS: { value: Day; label: string }[] = [
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
]

export default function AdminPanel({ room }: Props) {
  const [days, setDays] = useState<Day[]>(room.settings.days)
  const [votesPerUser, setVotesPerUser] = useState(room.settings.votes_per_user)
  const [voteScope, setVoteScope] = useState<VoteScope>(room.settings.vote_scope)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)

  // Keep local state in sync when room updates via realtime
  useEffect(() => {
    setDays(room.settings.days)
    setVotesPerUser(room.settings.votes_per_user)
    setVoteScope(room.settings.vote_scope)
  }, [room.settings.days, room.settings.votes_per_user, room.settings.vote_scope])

  function toggleDay(day: Day) {
    setDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    )
  }

  async function handleSave() {
    if (days.length === 0) {
      setError('Select at least one day.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('rooms')
      .update({ settings: { days, votes_per_user: votesPerUser, vote_scope: voteScope } })
      .eq('id', room.id)
    setSaving(false)
    if (err) {
      setError('Failed to save settings.')
      return
    }
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
      <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">
        Admin Panel
      </h2>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">Active days</p>
          <div className="flex gap-2">
            {ALL_DAYS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  days.includes(value)
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">Votes per person</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVotesPerUser(v => Math.max(1, v - 1))}
              className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold hover:bg-gray-700 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={160}
              value={votesPerUser}
              onChange={e => setVotesPerUser(Math.min(160, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-16 bg-gray-800 text-white text-center rounded-lg px-2 py-1 text-xs border border-gray-700 focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setVotesPerUser(v => Math.min(160, v + 1))}
              className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold hover:bg-gray-700 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">Vote budget</p>
          <div className="flex gap-2">
            {([['overall', 'Overall'], ['per_day', 'Per day']] as [VoteScope, string][]).map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVoteScope(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    voteScope === value
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {savedMsg && <span className="text-green-400 text-xs">Saved!</span>}
        </div>
      </div>
    </div>
  )
}

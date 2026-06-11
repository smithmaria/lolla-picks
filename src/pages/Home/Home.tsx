import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Day, VoteScope } from '../../types'

const ALL_DAYS: { value: Day; label: string }[] = [
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

export default function Home() {
  const navigate = useNavigate()

  const [creatorName, setCreatorName] = useState('')
  const [creatorPassword, setCreatorPassword] = useState('')
  const [roomDisplayName, setRoomDisplayName] = useState('')
  const [selectedDays, setSelectedDays] = useState<Day[]>(['thursday', 'friday', 'saturday', 'sunday'])
  const [votesPerUser, setVotesPerUser] = useState(3)
  const [voteScope, setVoteScope] = useState<VoteScope>('overall')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleDay(day: Day) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!creatorName.trim()) {
      setError('Your name is required.')
      return
    }
    if (!creatorPassword.trim()) {
      setError('Your password is required.')
      return
    }
    if (selectedDays.length === 0) {
      setError('Select at least one day.')
      return
    }

    setLoading(true)

    // 1. Insert the room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        display_name: roomDisplayName.trim() || null,
        settings: {
          days: selectedDays,
          votes_per_user: votesPerUser,
          vote_scope: voteScope,
        },
      })
      .select('id')
      .single()

    if (roomError || !room) {
      setLoading(false)
      setError(roomError?.message ?? 'Failed to create room.')
      return
    }

    // 2. Insert the creator as an admin participant
    const clientToken = crypto.randomUUID()

    const { data: roomUser, error: userError } = await supabase
      .from('room_users')
      .insert({
        room_id: room.id,
        display_name: creatorName.trim(),
        password: creatorPassword,
        client_token: clientToken,
        is_admin: true,
      })
      .select('id')
      .single()

    setLoading(false)

    if (userError || !roomUser) {
      setError(userError?.message ?? 'Failed to create your participant entry.')
      return
    }

    // 3. Store session in localStorage
    localStorage.setItem(
      `lolla-user-${room.id}`,
      JSON.stringify({ user_id: roomUser.id, client_token: clientToken, is_admin: true })
    )

    navigate(`/room/${room.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Lolla Scheduler</h1>
        <p className="text-gray-400 text-sm mb-6">Create a room and share the link with your group.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your name</label>
            <input
              type="text"
              value={creatorName}
              onChange={e => setCreatorName(e.target.value)}
              placeholder="e.g. Maria"
              required
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={creatorPassword}
                onChange={e => setCreatorPassword(e.target.value)}
                placeholder="Choose a password"
                required
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 pr-10 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Used to recover your votes if you clear your browser.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Room name <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={roomDisplayName}
              onChange={e => setRoomDisplayName(e.target.value)}
              placeholder="e.g. Weekend Crew"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Festival days</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_DAYS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDay(value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedDays.includes(value)
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Votes per person
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVotesPerUser(v => Math.max(1, v - 1))}
                className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold hover:bg-gray-700 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={160}
                value={votesPerUser}
                onChange={e => setVotesPerUser(Math.min(160, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20 bg-gray-800 text-white text-center rounded-lg px-2 py-1.5 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setVotesPerUser(v => Math.min(160, v + 1))}
                className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold hover:bg-gray-700 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Vote budget</label>
            <div className="grid grid-cols-2 gap-2">
              {([['overall', 'Overall'], ['per_day', 'Per day']] as [VoteScope, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVoteScope(value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    voteScope === value
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {voteScope === 'overall'
                ? 'One pool of votes shared across all days.'
                : 'Fresh votes for each day.'}
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {loading ? 'Creating…' : 'Create room'}
          </button>
        </form>
      </div>
    </div>
  )
}

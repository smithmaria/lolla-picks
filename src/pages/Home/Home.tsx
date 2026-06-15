import { useEffect, useState } from 'react'
import './Home.css'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Day, VoteScope } from '../../types'
import {
  ALL_DAYS,
  clampVotes,
  isValidJoinCode,
  normalizeJoinCode,
  parseVotesInput,
  toggleDay as toggleDayValue,
  validateCreateForm,
} from './homeValidation'

interface SavedRoom {
  roomId: string
  displayName: string | null
  userName: string
}

export default function Home() {
  const navigate = useNavigate()

  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([])
  const [tab, setTab] = useState<'create' | 'join'>('create')

  useEffect(() => {
    const roomIds: { roomId: string; userName: string }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('lolla-user-')) continue
      const roomId = key.slice('lolla-user-'.length)
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? '') as { display_name?: string }
        if (parsed.display_name) roomIds.push({ roomId, userName: parsed.display_name })
      } catch { /* ignore */ }
    }
    if (roomIds.length === 0) return

    setTab('join')

    supabase
      .from('rooms')
      .select('id, display_name')
      .in('id', roomIds.map(r => r.roomId))
      .then(({ data }) => {
        if (!data) return
        const nameMap = Object.fromEntries(data.map(r => [r.id as string, r.display_name as string | null]))
        setSavedRooms(
          roomIds
            .filter(r => r.roomId in nameMap)
            .map(r => ({ roomId: r.roomId, displayName: nameMap[r.roomId], userName: r.userName }))
        )
      })
  }, [])

  // Join state
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  // Create state
  const [creatorName, setCreatorName] = useState('')
  const [creatorPassword, setCreatorPassword] = useState('')
  const [roomDisplayName, setRoomDisplayName] = useState('')
  const [selectedDays, setSelectedDays] = useState<Day[]>(['thursday', 'friday', 'saturday', 'sunday'])
  const [votesPerUser, setVotesPerUser] = useState(25)
  const [allowMultiVote, setAllowMultiVote] = useState(true)
  const [voteScope, setVoteScope] = useState<VoteScope>('overall')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; password?: string; days?: string; server?: string }>({})

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError(null)

    const trimmed = normalizeJoinCode(joinInput)

    if (!isValidJoinCode(trimmed)) {
      setJoinError('Enter the 6-character room code.')
      return
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('join_code', trimmed)
      .single()
    if (error || !data) {
      setJoinError('Room not found. Check the code and try again.')
      return
    }
    navigate(`/room/${data.id}`)
  }

  function toggleDay(day: Day) {
    setSelectedDays(prev => toggleDayValue(prev, day))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const nextErrors = validateCreateForm({
      name: creatorName,
      password: creatorPassword,
      days: selectedDays,
    })

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoading(true)

    // Create the room + admin creator in one server-side call. The join code is
    // generated server-side and the client_token never leaves the database
    // except as the caller's own returned credential.
    const { data, error } = await supabase
      .rpc('create_room', {
        p_room_display_name: roomDisplayName.trim() || null,
        p_settings: {
          days: selectedDays,
          votes_per_user: votesPerUser,
          allow_multi_vote: allowMultiVote,
          vote_scope: voteScope,
        },
        p_creator_name: creatorName.trim(),
        p_password: creatorPassword,
      })
      .single<{ room_id: string; join_code: string; user_id: string; client_token: string }>()

    setLoading(false)

    if (error || !data) {
      setErrors({ server: error?.message ?? 'Failed to create room.' })
      return
    }

    // Store session in localStorage
    localStorage.setItem(
      `lolla-user-${data.room_id}`,
      JSON.stringify({ user_id: data.user_id, client_token: data.client_token, is_admin: true, display_name: creatorName.trim() })
    )

    navigate(`/room/${data.room_id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="home-card bg-grayCustom">
        <h1 className="font-bold text-white mb-6">Lolla Picks</h1>

        {/* Tab toggle */}
        <div className="flex gap-1 bg-grayDark rounded-lg p-1 mb-6">
          {(['create', 'join'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-lg font-display uppercase transition-colors ${
                tab === t
                  ? 'bg-yellow text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Join form */}
        {tab === 'join' && (
          <div className="space-y-4">
            {savedRooms.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-400 mb-2">Your rooms</p>
                <ul className="divide-y divide-[#333333] border border-[#333333]">
                  {savedRooms.map(r => (
                    <li key={r.roomId}>
                      <button
                        type="button"
                        onClick={() => navigate(`/room/${r.roomId}`)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-grayDark hover:bg-[#2a2a2a] transition-colors text-left"
                      >
                        <span className="text-white text-sm font-medium truncate">
                          {r.displayName ?? 'Lolla Picks'}
                        </span>
                        <span className="text-gray-500 text-xs shrink-0">{r.userName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Room code
              </label>
              <input
                type="text"
                value={joinInput}
                onChange={e => setJoinInput(e.target.value)}
                maxLength={6}
                placeholder="e.g. CAMP4T"
                className="w-full bg-white text-black px-3 py-2 text-sm border border-[#000000] focus:outline-none focus:border-tealDark focus:ring-1 focus:ring-tealDark"
              />
            </div>
            {joinError && <p className="text-red text-sm">{joinError}</p>}
            <button
              type="submit"
              className="w-full bg-red hover:bg-red disabled:opacity-50 text-black font-display uppercase px-4 py-2.5 text-lg transition-colors"
            >
              Go to room
            </button>
          </form>
          </div>
        )}

        {/* Create form */}
        {tab === 'create' && <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your name</label>
            <input
              type="text"
              value={creatorName}
              onChange={e => { setCreatorName(e.target.value); setErrors(prev => ({ ...prev, name: undefined })) }}
              maxLength={40}
              placeholder="Name"
              className={`w-full bg-white text-black px-3 py-2 text-sm border focus:outline-none focus:border-tealDark focus:ring-1 focus:ring-tealDark ${errors.name ? 'border-red' : 'border-[#000000]'}`}
            />
            {errors.name && <p className="text-red text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={creatorPassword}
                onChange={e => { setCreatorPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })) }}
                maxLength={72}
                placeholder="Password"
                className={`w-full bg-white text-black px-3 py-2 pr-10 text-sm border focus:outline-none focus:border-tealDark focus:ring-1 focus:ring-tealDark ${errors.password ? 'border-red' : 'border-[#000000]'}`}
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
            {errors.password
              ? <p className="text-red text-xs mt-1">{errors.password}</p>
              : <p className="text-xs text-gray-500 mt-1">Used to recover your votes if you clear your browser.</p>
            }
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Room name <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={roomDisplayName}
              onChange={e => setRoomDisplayName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Lolla Trippers"
              className="w-full bg-white text-black px-3 py-2 text-sm border border-[#000000] focus:outline-none focus:border-tealDark focus:ring-1 focus:ring-tealDark"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Festival days</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_DAYS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { toggleDay(value); setErrors(prev => ({ ...prev, days: undefined })) }}
                  className={`px-3 py-2 text-lg font-display uppercase border transition-colors ${
                    selectedDays.includes(value)
                      ? value === 'thursday'
                        ? 'bg-teal border-teal text-black'
                        : value === 'friday'
                        ? 'bg-blue2 border-blue2 text-black'
                        : value === 'saturday'
                        ? 'bg-blue3 border-blue3 text-black'
                        : 'bg-tealgreen border-tealgreen text-black'
                      : 'bg-grayDark border-[#333333] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {errors.days && <p className="text-red text-xs mt-1">{errors.days}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Vote budget</label>
            <div className="grid grid-cols-2 gap-2">
              {([['overall', 'Overall'], ['per_day', 'Per day']] as [VoteScope, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVoteScope(value)}
                  className={`px-3 py-2 text-lg font-display uppercase border transition-colors ${
                    voteScope === value
                      ? 'bg-pink border-pink text-black'
                      : 'bg-grayDark border-[#333333] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {voteScope === 'overall'
                ? 'Set the number of votes to use freely across all selected days.'
                : 'Set the number of votes to use per day.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Votes per user
            </label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVotesPerUser(v => clampVotes(v - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-[#333333] text-black font-bold hover:bg-gray-100 flex items-center justify-center"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={160}
                  value={votesPerUser}
                  onChange={e => setVotesPerUser(parseVotesInput(e.target.value))}
                  className="w-20 bg-white text-black text-center px-2 py-1.5 text-sm border border-[#000000] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setVotesPerUser(v => clampVotes(v + 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-[#333333] text-black font-bold hover:bg-gray-100 flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => setAllowMultiVote(v => !v)}
                className={`min-w-[8rem] flex items-center justify-center px-3 py-2 border transition-colors ${
                  allowMultiVote
                    ? 'bg-tealgreen border-tealgreen text-black'
                    : 'bg-grayDark border-[#333333] text-gray-400'
                }`}
              >
                <span className="font-display uppercase text-base">Stack artist votes</span>
              </button>
            </div>
          </div>

          {errors.server && <p className="text-red text-sm">{errors.server}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red hover:bg-red disabled:opacity-50 text-black font-display uppercase px-4 py-2.5 text-lg transition-colors"
          >
            {loading ? 'Creating…' : 'Create room'}
          </button>
        </form>}
      </div>
    </div>
  )
}

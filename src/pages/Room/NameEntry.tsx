import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { LocalSession } from '../../types'

interface Props {
  roomId: string
  onSuccess: (session: LocalSession) => void
}

type Flow = 'idle' | 'new_user' | 'returning_user'

interface ExistingUserRow {
  id: string
  password: string
  client_token: string
  is_admin: boolean
}

export default function NameEntry({ roomId, onSuccess }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [flow, setFlow] = useState<Flow>('idle')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Cache the fetched row so the returning-user path does not re-fetch (avoids TOCTOU)
  const existingUserRef = useRef<ExistingUserRow | null>(null)

  async function handleNameContinue(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const trimmed = displayName.trim()
    if (!trimmed) {
      setError('Please enter a name.')
      setSubmitting(false)
      return
    }

    const { data, error: fetchError } = await supabase
      .from('room_users')
      .select('id, password, client_token, is_admin')
      .eq('room_id', roomId)
      .eq('display_name', trimmed)
      .maybeSingle()

    setSubmitting(false)

    if (fetchError) {
      setError('Something went wrong. Please try again.')
      return
    }

    if (data) {
      existingUserRef.current = data as ExistingUserRow
      setFlow('returning_user')
    } else {
      existingUserRef.current = null
      setFlow('new_user')
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const trimmed = displayName.trim()

    if (flow === 'new_user') {
      if (!password) {
        setError('A password is required.')
        setSubmitting(false)
        return
      }
      if (/\s/.test(password)) {
        setError('Password cannot contain spaces.')
        setSubmitting(false)
        return
      }

      const clientToken = crypto.randomUUID()
      const { data, error: insertError } = await supabase
        .from('room_users')
        .insert({
          room_id: roomId,
          display_name: trimmed,
          password,
          client_token: clientToken,
          is_admin: false,
        })
        .select('id, is_admin')
        .single()

      setSubmitting(false)

      if (insertError || !data) {
        setError('Failed to create account. Please try again.')
        return
      }

      const session: LocalSession = {
        user_id: data.id as string,
        client_token: clientToken,
        is_admin: data.is_admin as boolean,
        display_name: trimmed,
      }
      localStorage.setItem(`lolla-user-${roomId}`, JSON.stringify(session))
      onSuccess(session)
    } else {
      // Use the cached row from the name-check step — no second fetch needed
      const existing = existingUserRef.current
      setSubmitting(false)

      if (!existing) {
        setError('Something went wrong. Please go back and try again.')
        return
      }

      if (existing.password !== password) {
        setError('Incorrect password.')
        return
      }

      const session: LocalSession = {
        user_id: existing.id,
        client_token: existing.client_token,
        is_admin: existing.is_admin,
        display_name: trimmed,
      }
      localStorage.setItem(`lolla-user-${roomId}`, JSON.stringify(session))
      onSuccess(session)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-entry-title"
      aria-describedby="name-entry-desc"
    >
      <div className="bg-grayCustom border border-[#333333] w-full max-w-sm p-6 shadow-2xl">
        <h2
          id="name-entry-title"
          className="text-2xl font-bold text-white mb-1"
        >
          Join the room
        </h2>
        <p id="name-entry-desc" className="text-gray-400 text-sm mb-6">
          Enter your name to get started. If you've been here before, use the
          same name and password.
        </p>

        {flow === 'idle' && (
          <form onSubmit={handleNameContinue} noValidate>
            <div className="mb-4">
              <label
                htmlFor="display-name"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Your name
              </label>
              <input
                id="display-name"
                data-testid="display-name-input"
                type="text"
                autoComplete="nickname"
                autoFocus
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Jess"
                className="w-full bg-white text-black px-3 py-2 text-sm border border-[#000000] placeholder-gray-400 focus:outline-none focus:border-tealDark focus:ring-1 focus:ring-tealDark"
              />
            </div>

            {error && (
              <p role="alert" className="text-red text-sm mb-4">
                {error}
              </p>
            )}

            <button
              type="submit"
              data-testid="name-continue-button"
              disabled={submitting}
              className="w-full bg-yellow hover:opacity-90 disabled:opacity-50 text-black font-display uppercase py-2.5 text-lg transition-colors"
            >
              {submitting ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {(flow === 'new_user' || flow === 'returning_user') && (
          <form onSubmit={handlePasswordSubmit} noValidate>
            <p className="text-gray-300 text-sm mb-4">
              {flow === 'new_user' ? (
                <>
                  Welcome, <span className="font-semibold text-white">{displayName}</span>! Choose a password to protect your votes.
                </>
              ) : (
                <>
                  Welcome back, <span className="font-semibold text-white">{displayName}</span>! Enter your password to continue.
                </>
              )}
            </p>

            <div className="mb-4">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                data-testid="password-input"
                type="password"
                autoComplete={flow === 'new_user' ? 'new-password' : 'current-password'}
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white text-black px-3 py-2 text-sm border border-[#000000] placeholder-gray-400 focus:outline-none focus:border-tealDark focus:ring-1 focus:ring-tealDark"
              />
            </div>

            {error && (
              <p role="alert" className="text-red text-sm mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                data-testid="back-button"
                onClick={() => {
                  setFlow('idle')
                  setError(null)
                  setPassword('')
                }}
                className="flex-1 bg-grayDark hover:bg-[#2a2a2a] text-white font-display uppercase py-2.5 text-lg transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                data-testid="password-submit-button"
                disabled={submitting || !password.trim()}
                className="flex-2 flex-grow bg-yellow hover:opacity-90 disabled:opacity-50 text-black font-display uppercase py-2.5 text-lg transition-colors"
              >
                {submitting
                  ? flow === 'new_user'
                    ? 'Creating…'
                    : 'Verifying…'
                  : flow === 'new_user'
                  ? 'Join'
                  : 'Sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

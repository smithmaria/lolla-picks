import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { LocalSession, Room as RoomType } from '../../types'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const [room, setRoom] = useState<RoomType | null>(null)
  const [session, setSession] = useState<LocalSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!roomId) return

    const stored = localStorage.getItem(`lolla-user-${roomId}`)
    if (stored) {
      setSession(JSON.parse(stored) as LocalSession)
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

      setRoom(data as RoomType)
    }

    fetchRoom()
  }, [roomId])

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
          <p className="text-gray-400 text-sm">This link may be invalid or the room was deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">
          {room.display_name ?? 'Lolla Scheduler'}
        </h1>
        <p className="text-gray-400 text-sm">
          {room.settings.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' · ')}
          {' · '}
          {room.settings.votes_per_user} vote{room.settings.votes_per_user !== 1 ? 's' : ''} {room.settings.vote_scope === 'per_day' ? 'per day' : 'total'}
        </p>
        {session?.is_admin && (
          <p className="text-indigo-400 text-xs mt-1">You are the room admin</p>
        )}
      </div>
    </div>
  )
}

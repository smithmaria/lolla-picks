import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Room } from '../types'

interface UseRoomResult {
  room: Room | null
  loading: boolean
  notFound: boolean
}

export function useRoom(roomId: string | undefined): UseRoomResult {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!roomId) return

    supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()
      .then(({ data, error }) => {
        setLoading(false)
        if (error || !data) {
          setNotFound(true)
          return
        }
        setRoom(data as Room)
      })

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        payload => {
          setRoom(payload.new as Room)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  return { room, loading, notFound }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface RoomMember {
  id: string
  display_name: string
  is_admin: boolean
  created_at: string
}

interface UseRoomMembersResult {
  members: RoomMember[]
  loaded: boolean
  removeMember: (userId: string) => Promise<boolean>
}

export function useRoomMembers(roomId: string | undefined): UseRoomMembersResult {
  const [members, setMembers] = useState<RoomMember[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!roomId) return

    supabase
      .from('room_users')
      .select('id, display_name, is_admin, created_at')
      .eq('room_id', roomId)
      .order('created_at')
      .then(({ data }) => {
        if (data) setMembers(data as RoomMember[])
        setLoaded(true)
      })

    const channel = supabase
      .channel(`room_users:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_users',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          const row = payload.new as RoomMember
          setMembers(prev =>
            prev.some(m => m.id === row.id) ? prev : [...prev, row],
          )
        },
      )
      .on(
        'postgres_changes',
        // DELETE payloads only carry the primary key, so no room filter here
        { event: 'DELETE', schema: 'public', table: 'room_users' },
        payload => {
          const row = payload.old as { id: string }
          setMembers(prev => prev.filter(m => m.id !== row.id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  const removeMember = useCallback(async (userId: string) => {
    // select() back the deleted row so an RLS no-op surfaces as a failure
    const { data, error } = await supabase
      .from('room_users')
      .delete()
      .eq('id', userId)
      .select('id')
    if (error || !data || data.length === 0) return false
    setMembers(prev => prev.filter(m => m.id !== userId))
    return true
  }, [])

  return { members, loaded, removeMember }
}

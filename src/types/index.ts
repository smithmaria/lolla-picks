export type RoomStatus = 'open' | 'locked'
export type VoteScope = 'overall' | 'per_day'
export type Day = 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface RoomSettings {
  days: Day[]
  votes_per_user: number
  vote_scope: VoteScope
  allow_multi_vote?: boolean
  /** Artist ids the admin has picked for the shared schedule */
  schedule_picks?: string[]
  /** When true (default), only the admin can edit the shared schedule */
  schedule_admin_only?: boolean
}

export interface Room {
  id: string
  display_name: string | null
  join_code: string | null
  settings: RoomSettings
  status: RoomStatus
  created_at: string
}

export interface RoomUser {
  id: string
  room_id: string
  display_name: string
  password: string
  client_token: string
  is_admin: boolean
  created_at: string
}

export interface LocalSession {
  user_id: string
  client_token: string
  is_admin: boolean
  display_name: string
}

export interface Vote {
  id: string
  room_id: string
  user_id: string
  artist_id: string
  vote_count: number
}

export interface Artist {
  id: string
  name: string
  stage: string
  day: Day
  start: string
  end: string
}

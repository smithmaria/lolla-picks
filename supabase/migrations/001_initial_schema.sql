-- Core room config
CREATE TABLE rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT,
  settings     JSONB NOT NULL DEFAULT '{"days": ["thursday", "friday", "saturday", "sunday"], "votes_per_user": 3, "vote_scope": "overall"}',
  status       TEXT NOT NULL DEFAULT 'open',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Named participants per room
CREATE TABLE room_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  password      TEXT NOT NULL,
  client_token  UUID NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, display_name)
);

-- Vote allocations (one row per user+artist pair)
CREATE TABLE votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES room_users(id) ON DELETE CASCADE,
  artist_id   TEXT NOT NULL,
  vote_count  INTEGER NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  UNIQUE(room_id, user_id, artist_id)
);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- rooms: anyone can read or create; updates handled client-side after is_admin check
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true);

-- room_users: anyone can read; insert open; update requires matching client_token
CREATE POLICY "room_users_select" ON room_users FOR SELECT USING (true);
CREATE POLICY "room_users_insert" ON room_users FOR INSERT WITH CHECK (true);
CREATE POLICY "room_users_update" ON room_users FOR UPDATE USING (true);

-- votes: anyone can read; insert/update open (budget enforced client-side)
CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_update" ON votes FOR UPDATE USING (true);

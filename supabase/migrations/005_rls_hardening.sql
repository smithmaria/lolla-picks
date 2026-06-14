-- RLS hardening: move all writes + auth behind SECURITY DEFINER functions.
--
-- WHY: the app ships the Supabase anon key in the browser bundle (by design),
-- and the previous policies were all `USING (true)` / `WITH CHECK (true)`.
-- That let anyone hit the REST API directly and read every user's plaintext
-- password + client_token, tamper with or delete any vote/room/member, and
-- mass-insert junk rows. There is no Supabase Auth here, so the only place we
-- can actually enforce ownership is inside the database: secrets live in a
-- table anon can't touch, and every mutation goes through a function that
-- verifies the caller's client_token (or admin status) before writing.
--
-- IMPORTANT: this migration MUST ship together with the client changes that
-- switch the hooks/pages from `.from(...).insert/update/delete/upsert` to the
-- `.rpc(...)` calls below. Applied alone it will break all writes, because
-- direct table writes are revoked at the bottom of this file.

-- pgcrypto provides crypt()/gen_salt() (password hashing) and gen_random_bytes()
-- (join codes). On Supabase it lives in the `extensions` schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. Move secrets out of the publicly-readable room_users table.
-- ---------------------------------------------------------------------------
-- room_users stays SELECT-readable (it feeds the live member list and is in the
-- realtime publication), so it must hold NO secrets. Passwords + client_tokens
-- move to a table with RLS enabled and NO policies -> anon/authenticated have
-- zero direct access; only the SECURITY DEFINER functions below can read them.

CREATE TABLE room_user_secrets (
  user_id       UUID PRIMARY KEY REFERENCES room_users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  client_token  UUID NOT NULL
);

ALTER TABLE room_user_secrets ENABLE ROW LEVEL SECURITY;
-- (intentionally no policies)

-- Backfill from the existing plaintext columns, hashing passwords on the way in.
INSERT INTO room_user_secrets (user_id, password_hash, client_token)
SELECT id, extensions.crypt(password, extensions.gen_salt('bf')), client_token
FROM room_users;

ALTER TABLE room_users DROP COLUMN password;
ALTER TABLE room_users DROP COLUMN client_token;

-- ---------------------------------------------------------------------------
-- 2. Write functions (SECURITY DEFINER — run as the owner, bypassing the
--    revoked table grants; each one authorizes the caller first).
-- ---------------------------------------------------------------------------

-- Create a room + its admin creator in one shot. Returns the new ids, the
-- server-generated join code, and the creator's client_token.
CREATE OR REPLACE FUNCTION create_room(
  p_room_display_name text,
  p_settings          jsonb,
  p_creator_name      text,
  p_password          text
) RETURNS TABLE (room_id uuid, join_code text, user_id uuid, client_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_room_id uuid;
  v_code    text;
  v_user_id uuid;
  v_token   uuid := gen_random_uuid();
BEGIN
  IF length(trim(coalesce(p_creator_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF coalesce(p_password, '') = '' OR p_password ~ '\s' THEN
    RAISE EXCEPTION 'Invalid password';
  END IF;
  IF octet_length(p_settings::text) > 4096 THEN
    RAISE EXCEPTION 'Settings payload too large';
  END IF;

  -- Generate a unique 6-char join code, retrying on the (rare) collision.
  LOOP
    v_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    BEGIN
      INSERT INTO rooms (display_name, join_code, settings)
      VALUES (nullif(trim(p_room_display_name), ''), v_code, p_settings)
      RETURNING id INTO v_room_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- join_code collided; loop and try another
    END;
  END LOOP;

  INSERT INTO room_users (room_id, display_name, is_admin)
  VALUES (v_room_id, trim(p_creator_name), true)
  RETURNING id INTO v_user_id;

  INSERT INTO room_user_secrets (user_id, password_hash, client_token)
  VALUES (v_user_id, crypt(p_password, gen_salt('bf')), v_token);

  RETURN QUERY SELECT v_room_id, v_code, v_user_id, v_token;
END $$;

-- Register a brand-new participant in an existing room. The UNIQUE(room_id,
-- display_name) constraint rejects duplicate names.
CREATE OR REPLACE FUNCTION register_user(
  p_room_id      uuid,
  p_display_name text,
  p_password     text
) RETURNS TABLE (user_id uuid, client_token uuid, is_admin boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_user_id uuid;
  v_token   uuid := gen_random_uuid();
BEGIN
  IF length(trim(coalesce(p_display_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF coalesce(p_password, '') = '' OR p_password ~ '\s' THEN
    RAISE EXCEPTION 'Invalid password';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  INSERT INTO room_users (room_id, display_name, is_admin)
  VALUES (p_room_id, trim(p_display_name), false)
  RETURNING id INTO v_user_id;

  INSERT INTO room_user_secrets (user_id, password_hash, client_token)
  VALUES (v_user_id, crypt(p_password, gen_salt('bf')), v_token);

  RETURN QUERY SELECT v_user_id, v_token, false;
END $$;

-- Returning-user login. Verifies the password server-side and returns the
-- client_token only on success. Returns zero rows on a bad password/name so
-- the client can show "Incorrect password" without ever seeing the hash.
CREATE OR REPLACE FUNCTION authenticate_user(
  p_room_id      uuid,
  p_display_name text,
  p_password     text
) RETURNS TABLE (user_id uuid, client_token uuid, is_admin boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, s.client_token, u.is_admin
  FROM room_users u
  JOIN room_user_secrets s ON s.user_id = u.id
  WHERE u.room_id = p_room_id
    AND u.display_name = trim(p_display_name)
    AND s.password_hash = crypt(p_password, s.password_hash);
END $$;

-- Cast/update a single vote. Verifies the caller owns p_user_id (token match)
-- and that the room is still open, then upserts.
CREATE OR REPLACE FUNCTION cast_vote(
  p_room_id      uuid,
  p_user_id      uuid,
  p_client_token uuid,
  p_artist_id    text,
  p_vote_count   integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM room_users u JOIN room_user_secrets s ON s.user_id = u.id
    WHERE u.id = p_user_id AND u.room_id = p_room_id AND s.client_token = p_client_token
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF (SELECT status FROM rooms WHERE id = p_room_id) IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Voting is closed';
  END IF;

  IF p_vote_count < 0 OR p_vote_count > 100 THEN
    RAISE EXCEPTION 'Invalid vote count';
  END IF;
  IF length(coalesce(p_artist_id, '')) = 0 OR length(p_artist_id) > 100 THEN
    RAISE EXCEPTION 'Invalid artist';
  END IF;

  INSERT INTO votes (room_id, user_id, artist_id, vote_count)
  VALUES (p_room_id, p_user_id, p_artist_id, p_vote_count)
  ON CONFLICT (room_id, user_id, artist_id) DO UPDATE SET vote_count = EXCLUDED.vote_count;
END $$;

-- Remove a participant. Allowed when the caller is an admin (removing anyone)
-- or is removing themselves (leaving the room). Verifies the caller's token.
CREATE OR REPLACE FUNCTION remove_member(
  p_room_id        uuid,
  p_actor_user_id  uuid,
  p_client_token   uuid,
  p_target_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT u.is_admin INTO v_is_admin
  FROM room_users u JOIN room_user_secrets s ON s.user_id = u.id
  WHERE u.id = p_actor_user_id AND u.room_id = p_room_id AND s.client_token = p_client_token;

  IF v_is_admin IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT v_is_admin AND p_actor_user_id <> p_target_user_id THEN
    RAISE EXCEPTION 'Admin only';  -- non-admins may only remove themselves
  END IF;

  DELETE FROM room_users WHERE id = p_target_user_id AND room_id = p_room_id;
  RETURN FOUND;
END $$;

-- Admin deletes the whole room. Votes + members cascade via their FK
-- ON DELETE CASCADE, so a single delete is enough.
CREATE OR REPLACE FUNCTION delete_room(
  p_room_id       uuid,
  p_actor_user_id uuid,
  p_client_token  uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM room_users u JOIN room_user_secrets s ON s.user_id = u.id
    WHERE u.id = p_actor_user_id AND u.room_id = p_room_id
      AND s.client_token = p_client_token AND u.is_admin
  ) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  DELETE FROM rooms WHERE id = p_room_id;
END $$;

-- Admin saves room settings. Optionally clamps existing votes to 1 (when
-- multi-vote is turned off) and deletes votes for artists on removed days,
-- all in one transaction. Mirrors AdminPanel.handleSave.
CREATE OR REPLACE FUNCTION update_room_settings(
  p_room_id          uuid,
  p_actor_user_id    uuid,
  p_client_token     uuid,
  p_display_name     text,
  p_settings         jsonb,
  p_clamp_votes      boolean DEFAULT false,
  p_delete_artist_ids text[] DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM room_users u JOIN room_user_secrets s ON s.user_id = u.id
    WHERE u.id = p_actor_user_id AND u.room_id = p_room_id
      AND s.client_token = p_client_token AND u.is_admin
  ) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF octet_length(p_settings::text) > 4096 THEN
    RAISE EXCEPTION 'Settings payload too large';
  END IF;

  UPDATE rooms
  SET display_name = nullif(trim(coalesce(p_display_name, '')), ''),
      settings     = p_settings
  WHERE id = p_room_id;

  IF p_clamp_votes THEN
    UPDATE votes SET vote_count = 1 WHERE room_id = p_room_id AND vote_count > 1;
  END IF;

  IF p_delete_artist_ids IS NOT NULL AND array_length(p_delete_artist_ids, 1) > 0 THEN
    DELETE FROM votes WHERE room_id = p_room_id AND artist_id = ANY(p_delete_artist_ids);
  END IF;
END $$;

-- Shared-schedule edits (Room.tsx). Allowed by any room member when the room is
-- unlocked (settings.schedule_admin_only = false), admin-only when locked.
-- Updates a single key of the settings jsonb so concurrent edits to other keys
-- don't clobber each other.
CREATE OR REPLACE FUNCTION update_room_schedule(
  p_room_id       uuid,
  p_actor_user_id uuid,
  p_client_token  uuid,
  p_key           text,
  p_value         jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_is_admin   boolean;
  v_admin_only boolean;
BEGIN
  SELECT u.is_admin INTO v_is_admin
  FROM room_users u JOIN room_user_secrets s ON s.user_id = u.id
  WHERE u.id = p_actor_user_id AND u.room_id = p_room_id AND s.client_token = p_client_token;

  IF v_is_admin IS NULL THEN
    RAISE EXCEPTION 'Not authorized';  -- caller is not a member of this room
  END IF;

  IF p_key NOT IN ('schedule_picks', 'schedule_admin_only') THEN
    RAISE EXCEPTION 'Unsupported settings key';
  END IF;

  -- Toggling the lock itself is always admin-only.
  v_admin_only := coalesce((SELECT settings ->> 'schedule_admin_only' FROM rooms WHERE id = p_room_id)::boolean, true);
  IF (p_key = 'schedule_admin_only' OR v_admin_only) AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE rooms SET settings = jsonb_set(settings, ARRAY[p_key], p_value, true)
  WHERE id = p_room_id;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Lock down direct table access.
-- ---------------------------------------------------------------------------

-- Drop the permissive write policies (SELECT policies stay: these tables hold
-- no secrets anymore, and the client reads rooms/members/votes by id).
DROP POLICY IF EXISTS "rooms_insert"        ON rooms;
DROP POLICY IF EXISTS "rooms_update"        ON rooms;
DROP POLICY IF EXISTS "room_users_insert"   ON room_users;
DROP POLICY IF EXISTS "room_users_update"   ON room_users;
DROP POLICY IF EXISTS "room_users_delete"   ON room_users;
DROP POLICY IF EXISTS "votes_insert"        ON votes;
DROP POLICY IF EXISTS "votes_update"        ON votes;

-- Revoke direct writes from the public API roles. SECURITY DEFINER functions
-- run as the table owner and are unaffected; the browser can now only mutate
-- data through the functions below.
REVOKE INSERT, UPDATE, DELETE ON rooms      FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON room_users FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON votes      FROM anon, authenticated;

-- Expose the functions to the public API roles.
GRANT EXECUTE ON FUNCTION create_room(text, jsonb, text, text)                                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_user(uuid, text, text)                                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION authenticate_user(uuid, text, text)                                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cast_vote(uuid, uuid, uuid, text, integer)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION remove_member(uuid, uuid, uuid, uuid)                               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_room(uuid, uuid, uuid)                                       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_room_settings(uuid, uuid, uuid, text, jsonb, boolean, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_room_schedule(uuid, uuid, uuid, text, jsonb)                 TO anon, authenticated;

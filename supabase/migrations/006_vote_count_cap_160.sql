-- The app allows a vote budget up to 160 (MAX_VOTES), and with stacking enabled a
-- single artist can receive the full budget. The original cast_vote guard capped a
-- single vote_count at 100, which rejected legitimate votes in the 101–160 range.
-- Raise the server-side cap to match the client limit.
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

  IF p_vote_count < 0 OR p_vote_count > 160 THEN
    RAISE EXCEPTION 'Invalid vote count';
  END IF;
  IF length(coalesce(p_artist_id, '')) = 0 OR length(p_artist_id) > 100 THEN
    RAISE EXCEPTION 'Invalid artist';
  END IF;

  INSERT INTO votes (room_id, user_id, artist_id, vote_count)
  VALUES (p_room_id, p_user_id, p_artist_id, p_vote_count)
  ON CONFLICT (room_id, user_id, artist_id) DO UPDATE SET vote_count = EXCLUDED.vote_count;
END $$;

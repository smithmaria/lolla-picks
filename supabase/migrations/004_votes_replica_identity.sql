-- Required for Supabase realtime DELETE events to include full row data (user_id, artist_id)
-- Without this, payload.old only contains the primary key (id), making client-side cache
-- invalidation on vote deletion impossible.
ALTER TABLE votes REPLICA IDENTITY FULL;

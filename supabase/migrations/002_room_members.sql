-- Allow removing participants (admin removal is enforced client-side, same as room updates)
CREATE POLICY "room_users_delete" ON room_users FOR DELETE USING (true);

-- Broadcast room_users changes so member lists stay live
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_users;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Short human-readable join code for sharing rooms without pasting a UUID
ALTER TABLE rooms ADD COLUMN join_code TEXT UNIQUE;

CREATE INDEX rooms_join_code_idx ON rooms (join_code);

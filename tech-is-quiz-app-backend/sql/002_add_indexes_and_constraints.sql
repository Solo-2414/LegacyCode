-- Keep the migration idempotent for deployments that run it after the base schema.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt VARCHAR(255);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_key UUID;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_team_room_match;
DROP INDEX IF EXISTS idx_participants_user_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_room_name ON teams(room_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_room_nickname ON participants(room_id, nickname);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_room_user_id ON participants(room_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_participant_question ON submissions(participant_id, question_id);

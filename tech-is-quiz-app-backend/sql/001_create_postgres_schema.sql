CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('SUPERADMIN', 'ADMIN', 'PARTICIPANT');
CREATE TYPE question_type AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'IDENTIFICATION');
CREATE TYPE room_status AS ENUM ('LOBBY', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'PARTICIPANT',
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (quiz_id, round_number)
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  type question_type NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL,
  accepted_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  points INTEGER NOT NULL DEFAULT 100 CHECK (points > 0),
  time_limit_sec INTEGER NOT NULL DEFAULT 30 CHECK (time_limit_sec > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE NOT NULL CHECK (room_code ~ '^[0-9]{6}$'),
  host_key UUID NOT NULL UNIQUE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status room_status NOT NULL DEFAULT 'LOBBY',
  player_limit INTEGER CHECK (player_limit IS NULL OR player_limit BETWEEN 2 AND 500),
  auto_start_when_full BOOLEAN NOT NULL DEFAULT FALSE,
  phase INTEGER NOT NULL DEFAULT 0 CHECK (phase BETWEEN 0 AND 4),
  round_index INTEGER NOT NULL DEFAULT 0 CHECK (round_index >= 0),
  question_index INTEGER NOT NULL DEFAULT 0 CHECK (question_index >= 0),
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (room_id, name)
);

CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  is_connected BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (room_id, nickname),
  UNIQUE (room_id, user_id)
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  submitted_answer JSONB NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (participant_id, question_id)
);

CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_teams_room_id ON teams(room_id);
CREATE INDEX idx_participants_room_id ON participants(room_id);
CREATE INDEX idx_submissions_team_id ON submissions(team_id);
CREATE INDEX idx_questions_round_id ON questions(round_id);

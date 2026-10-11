-- Optional per-quiz setting: award partial credit on multiple-answer questions.
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS partial_credit BOOLEAN NOT NULL DEFAULT FALSE;

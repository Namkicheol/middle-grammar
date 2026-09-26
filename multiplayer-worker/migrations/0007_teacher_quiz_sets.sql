CREATE TABLE IF NOT EXISTS teacher_quiz_sets (
  id TEXT PRIMARY KEY,
  teacher_email TEXT NOT NULL,
  title TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS teacher_quiz_sets_teacher_updated
  ON teacher_quiz_sets (teacher_email, updated_at DESC);

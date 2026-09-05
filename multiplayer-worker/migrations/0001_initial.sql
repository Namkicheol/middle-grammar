CREATE TABLE IF NOT EXISTS room_reports (
  room_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  teacher_email TEXT NOT NULL,
  grade TEXT NOT NULL,
  unit_key TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  participant_count INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_results (
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  correct_count INTEGER NOT NULL,
  answered_count INTEGER NOT NULL,
  average_response_time_ms INTEGER,
  PRIMARY KEY (room_id, player_id),
  FOREIGN KEY (room_id) REFERENCES room_reports(room_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS room_reports_teacher_finished
  ON room_reports (teacher_email, finished_at DESC);

CREATE INDEX IF NOT EXISTS room_reports_code_teacher_finished
  ON room_reports (code, teacher_email, finished_at DESC, created_at DESC);

CREATE TABLE teacher_moderation (
  google_sub TEXT PRIMARY KEY,
  banned INTEGER NOT NULL DEFAULT 0 CHECK (banned IN (0, 1)),
  ban_reason TEXT,
  banned_at INTEGER,
  banned_by TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (google_sub) REFERENCES teacher_identities(google_sub) ON DELETE CASCADE
);

CREATE TABLE teacher_moderation_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('ban', 'unban')),
  actor_email TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_teacher_moderation_audit_subject ON teacher_moderation_audit(google_sub, created_at DESC);

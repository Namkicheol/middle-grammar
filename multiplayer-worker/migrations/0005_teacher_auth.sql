CREATE TABLE IF NOT EXISTS teacher_identities (
  google_sub TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_sessions (
  session_hash TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL,
  email TEXT NOT NULL,
  csrf_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (google_sub) REFERENCES teacher_identities(google_sub) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS teacher_sessions_expires_at ON teacher_sessions (expires_at);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_states_expires_at ON oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_expires_at ON auth_rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS teacher_session_rooms (
  session_hash TEXT NOT NULL,
  room_code TEXT NOT NULL,
  PRIMARY KEY (session_hash, room_code),
  FOREIGN KEY (session_hash) REFERENCES teacher_sessions(session_hash) ON DELETE CASCADE
);

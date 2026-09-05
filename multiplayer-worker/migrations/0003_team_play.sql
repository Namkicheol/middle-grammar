ALTER TABLE room_reports ADD COLUMN play_style TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE room_reports ADD COLUMN team_count INTEGER;
ALTER TABLE player_results ADD COLUMN team_id TEXT;
ALTER TABLE player_results ADD COLUMN team_number INTEGER;

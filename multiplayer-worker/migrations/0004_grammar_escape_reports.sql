ALTER TABLE room_reports ADD COLUMN escape_summary_json TEXT;
ALTER TABLE player_results ADD COLUMN escape_rooms_cleared INTEGER;
ALTER TABLE player_results ADD COLUMN escape_discovered_count INTEGER;
ALTER TABLE player_results ADD COLUMN escape_escaped_at INTEGER;

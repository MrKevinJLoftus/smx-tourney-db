-- MySQL script to delete players who do not have any events assigned
-- (i.e., no records in the event_x_player table)
--
-- IMPORTANT: This script will permanently delete players from the database.
-- Players referenced in matches (match_x_player_x_song, match.winner_id) will
-- also be affected due to CASCADE constraints, but match records will remain.
--
-- RECOMMENDATION: Run the preview query first to see which players will be deleted.

-- ============================================================================
-- STEP 1: PREVIEW - See which players will be deleted (run this first!)
-- ============================================================================
SELECT 
    p.id,
    p.username,
    p.pronouns,
    p.created_at,
    COUNT(DISTINCT ep.id) as event_count,
    COUNT(DISTINCT mps.match_id) as match_count,
    COUNT(DISTINCT m.id) as winner_match_count
FROM player p
LEFT JOIN event_x_player ep ON p.id = ep.player_id
LEFT JOIN match_x_player_x_song mps ON p.id = mps.player_id
LEFT JOIN `match` m ON p.id = m.winner_id
WHERE ep.player_id IS NULL
GROUP BY p.id, p.username, p.pronouns, p.created_at
ORDER BY p.username;

-- ============================================================================
-- STEP 2: DELETE - Remove players without events
-- ============================================================================
-- Uncomment the following DELETE statement after reviewing the preview results

-- DELETE p FROM player p
-- LEFT JOIN event_x_player ep ON p.id = ep.player_id
-- WHERE ep.player_id IS NULL;

-- ============================================================================
-- ALTERNATIVE: If you want to also exclude players who are in matches
-- (uncomment and use this instead if you want to keep players who have matches
--  even if they don't have events assigned)
-- ============================================================================

-- DELETE p FROM player p
-- LEFT JOIN event_x_player ep ON p.id = ep.player_id
-- LEFT JOIN match_x_player_x_song mps ON p.id = mps.player_id
-- LEFT JOIN `match` m ON p.id = m.winner_id
-- WHERE ep.player_id IS NULL
--   AND mps.player_id IS NULL
--   AND m.winner_id IS NULL;


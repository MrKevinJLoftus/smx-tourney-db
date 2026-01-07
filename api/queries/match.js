module.exports = {
  GET_MATCHES_BY_EVENT: `SELECT m.*
    FROM \`match\` m
    WHERE m.event_id = ?
    ORDER BY m.created_at DESC`,
  SEARCH_MATCHES: `SELECT DISTINCT m.*
    FROM \`match\` m
    LEFT JOIN event e ON m.event_id = e.id
    LEFT JOIN match_x_player_x_song mps ON m.id = mps.match_id
    LEFT JOIN player p ON mps.player_id = p.id
    WHERE m.round LIKE ?
    OR e.name LIKE ?
    OR p.username LIKE ?
    ORDER BY m.created_at DESC
    LIMIT 50`,
  GET_MATCH_BY_ID: `SELECT m.*
    FROM \`match\` m
    WHERE m.id = ?`,
  GET_PLAYERS_BY_MATCH: `SELECT DISTINCT mps.player_id, p.username as gamertag
    FROM match_x_player_x_song mps
    LEFT JOIN player p ON mps.player_id = p.id
    WHERE mps.match_id = ?
    ORDER BY mps.player_id ASC`,
  GET_SONGS_BY_MATCH: `SELECT DISTINCT mps.song_id, s.title, s.artist
    FROM match_x_player_x_song mps
    LEFT JOIN song s ON mps.song_id = s.id
    WHERE mps.match_id = ?
    ORDER BY mps.song_id ASC`,
  GET_PLAYER_SONG_SCORES: `SELECT mps.player_id, mps.song_id, mps.song_order, mps.chart_id, mps.score, mps.win, p.username as player_gamertag, s.title as song_title, s.artist as song_artist, 
    sc.mode as chart_mode, sc.difficulty as chart_difficulty
    FROM match_x_player_x_song mps
    LEFT JOIN player p ON mps.player_id = p.id
    LEFT JOIN song s ON mps.song_id = s.id
    LEFT JOIN song_x_chart sc ON mps.chart_id = sc.id
    WHERE mps.match_id = ?
    ORDER BY COALESCE(mps.song_order, mps.song_id) ASC, mps.player_id ASC`,
  CREATE_MATCH: `INSERT INTO \`match\` (event_id, winner_id, round, created_by) 
    VALUES (?, ?, ?, ?)`,
  CREATE_MATCH_PLAYER_SONG: `INSERT INTO match_x_player_x_song (match_id, player_id, song_id, song_order, chart_id, score, win, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  DELETE_MATCH_PLAYER_SONGS: `DELETE FROM match_x_player_x_song WHERE match_id = ?`,
  GET_PLAYER_STATS_BY_MATCH: `SELECT mps.match_id, mps.player_id, mps.wins, mps.losses, mps.draws, p.username as gamertag
    FROM match_x_player_stats mps
    LEFT JOIN player p ON mps.player_id = p.id
    WHERE mps.match_id = ?
    ORDER BY mps.player_id ASC`,
  CREATE_MATCH_PLAYER_STATS: `INSERT INTO match_x_player_stats (match_id, player_id, wins, losses, draws, created_by) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE wins = VALUES(wins), losses = VALUES(losses), draws = VALUES(draws)`,
  DELETE_MATCH_PLAYER_STATS: `DELETE FROM match_x_player_stats WHERE match_id = ?`,
  UPDATE_MATCH: `UPDATE \`match\` SET event_id = ?, winner_id = ?, round = ? 
    WHERE id = ?`,
  DELETE_MATCH: `DELETE FROM \`match\` WHERE id = ?`,
  GET_MATCHES_BY_PLAYER: `SELECT DISTINCT m.*
    FROM \`match\` m
    INNER JOIN match_x_player_x_song mps ON m.id = mps.match_id
    WHERE mps.player_id = ?
    ORDER BY m.created_at DESC`
};


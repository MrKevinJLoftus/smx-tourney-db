module.exports = {
  GET_MATCHES_BY_EVENT: `SELECT m.*, 
    p1.player_id as p1_id, p1.gamertag as p1_gamertag,
    p2.player_id as p2_id, p2.gamertag as p2_gamertag,
    w.player_id as w_id, w.gamertag as w_gamertag,
    s.song_id, s.title as song_title, s.artist as song_artist
    FROM match m
    LEFT JOIN player p1 ON m.player1_id = p1.player_id
    LEFT JOIN player p2 ON m.player2_id = p2.player_id
    LEFT JOIN player w ON m.winner_id = w.player_id
    LEFT JOIN song s ON m.song_id = s.song_id
    WHERE m.event_id = ?
    ORDER BY m.created_at DESC`,
  GET_MATCH_BY_ID: `SELECT m.*, 
    p1.player_id as p1_id, p1.gamertag as p1_gamertag,
    p2.player_id as p2_id, p2.gamertag as p2_gamertag,
    w.player_id as w_id, w.gamertag as w_gamertag,
    s.song_id, s.title as song_title, s.artist as song_artist
    FROM match m
    LEFT JOIN player p1 ON m.player1_id = p1.id
    LEFT JOIN player p2 ON m.player2_id = p2.id
    LEFT JOIN player w ON m.winner_id = w.id
    LEFT JOIN song s ON m.song_id = s.id
    WHERE m.id = ?`,
  CREATE_MATCH: `INSERT INTO match (event_id, created_by) 
    VALUES (?, ?)`,
  UPDATE_MATCH: `UPDATE match SET event_id = ?, created_by = ? 
    WHERE id = ?`,
  DELETE_MATCH: `DELETE FROM match WHERE id = ?`
};


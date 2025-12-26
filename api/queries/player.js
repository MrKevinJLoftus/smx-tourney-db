module.exports = {
  GET_ALL_PLAYERS: `SELECT * FROM player ORDER BY username ASC`,
  GET_PLAYER_BY_ID: `SELECT * FROM player WHERE id = ?`,
  GET_PLAYER_BY_USERNAME: `SELECT * FROM player WHERE username = ?`,
  CREATE_PLAYER: `INSERT INTO player (username, created_by) VALUES (?, ?)`,
  UPDATE_PLAYER: `UPDATE player SET username = ?, created_by = ? WHERE id = ?`,
  GET_PLAYERS_BY_EVENT: `SELECT ep.*, p.id, p.username 
    FROM event_x_player ep 
    INNER JOIN player p ON ep.id = p.id 
    WHERE ep.event_id = ? 
    ORDER BY ep.seed ASC, ep.placement ASC`
};


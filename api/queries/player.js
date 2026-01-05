module.exports = {
  GET_ALL_PLAYERS: `SELECT * FROM player ORDER BY username ASC`,
  GET_PLAYER_BY_ID: `SELECT * FROM player WHERE id = ?`,
  GET_PLAYER_BY_USERNAME: `SELECT * FROM player WHERE username = ?`,
  SEARCH_PLAYERS: `SELECT * FROM player WHERE username LIKE ? ORDER BY username ASC LIMIT 50`,
  CREATE_PLAYER: `INSERT INTO player (username, pronouns, created_by) VALUES (?, ?, ?)`,
  UPDATE_PLAYER: `UPDATE player SET username = ?, pronouns = ?, created_by = ? WHERE id = ?`,
  DELETE_PLAYER: `DELETE FROM player WHERE id = ?`,
  GET_PLAYERS_BY_EVENT: `SELECT ep.*, p.id, p.username, p.pronouns 
    FROM event_x_player ep 
    INNER JOIN player p ON ep.player_id = p.id 
    WHERE ep.event_id = ? 
    ORDER BY ep.seed ASC, ep.placement ASC`
};


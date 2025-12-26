module.exports = {
  ADD_PLAYER_TO_EVENT: `INSERT INTO event_x_player (event_id, player_id, seed, placement) VALUES (?, ?, ?, ?)`,
  UPDATE_EVENT_PLAYER: `UPDATE event_x_player SET seed = ?, placement = ? WHERE id = ?`,
  REMOVE_PLAYER_FROM_EVENT: `DELETE FROM event_x_player WHERE id = ?`,
  GET_EVENT_PLAYER_BY_ID: `SELECT * FROM event_x_player WHERE id = ?`,
  GET_EVENT_PLAYER_BY_EVENT_AND_PLAYER: `SELECT * FROM event_x_player WHERE event_id = ? AND player_id = ?`
};


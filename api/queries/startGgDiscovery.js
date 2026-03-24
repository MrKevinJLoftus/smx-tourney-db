module.exports = {
  GET_STATE: `SELECT last_max_event_start_at FROM start_gg_discovery_state WHERE id = 1`,
  UPDATE_STATE: `UPDATE start_gg_discovery_state SET last_max_event_start_at = ? WHERE id = 1`,
  GET_ALL_IMPORTED_START_GG_IDS: `SELECT start_gg_event_id FROM event WHERE start_gg_event_id IS NOT NULL`,
};

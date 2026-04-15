module.exports = {
  // Admin/internal: includes hidden events.
  GET_ALL_EVENTS: `SELECT * FROM event ORDER BY date DESC`,
  GET_EVENT_BY_ID: `SELECT * FROM event WHERE id = ?`,
  /** Returns at most one row when start.gg event id is already imported. */
  GET_EVENT_BY_START_GG_EVENT_ID: `SELECT * FROM event WHERE start_gg_event_id = ? LIMIT 1`,

  // Public: excludes hidden events.
  GET_ALL_PUBLIC_EVENTS: `SELECT * FROM event WHERE hidden = 0 ORDER BY date DESC`,
  GET_PUBLIC_EVENT_BY_ID: `SELECT * FROM event WHERE id = ? AND hidden = 0`,
  SEARCH_PUBLIC_EVENTS: `SELECT * FROM event 
    WHERE hidden = 0
      AND (
        name LIKE ? 
        OR description LIKE ? 
        OR location LIKE ? 
        OR organizers LIKE ?
      )
    ORDER BY date DESC 
    LIMIT 50`,
  CREATE_EVENT: `INSERT INTO event (name, date, description, location, organizers, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
  CREATE_EVENT_WITH_START_GG: `INSERT INTO event (name, date, description, location, organizers, created_by, start_gg_event_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  UPDATE_EVENT: `UPDATE event SET name = ?, date = ?, description = ?, location = ?, organizers = ? WHERE id = ?`,
  UPDATE_EVENT_HIDDEN: `UPDATE event SET hidden = ? WHERE id = ?`,
  DELETE_EVENT: `DELETE FROM event WHERE id = ?`
};


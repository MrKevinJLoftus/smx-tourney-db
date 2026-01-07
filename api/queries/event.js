module.exports = {
  GET_ALL_EVENTS: `SELECT * FROM event ORDER BY date DESC`,
  GET_EVENT_BY_ID: `SELECT * FROM event WHERE id = ?`,
  SEARCH_EVENTS: `SELECT * FROM event 
    WHERE name LIKE ? 
    OR description LIKE ? 
    OR location LIKE ? 
    OR organizers LIKE ?
    ORDER BY date DESC 
    LIMIT 50`,
  CREATE_EVENT: `INSERT INTO event (name, date, description, location, organizers, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
  UPDATE_EVENT: `UPDATE event SET name = ?, date = ?, description = ?, location = ?, organizers = ? WHERE id = ?`,
  DELETE_EVENT: `DELETE FROM event WHERE id = ?`
};


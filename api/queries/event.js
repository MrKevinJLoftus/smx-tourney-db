module.exports = {
  GET_ALL_EVENTS: `SELECT * FROM event ORDER BY date DESC`,
  GET_EVENT_BY_ID: `SELECT * FROM event WHERE id = ?`,
  CREATE_EVENT: `INSERT INTO event (name, date, description, location, organizers) VALUES (?, ?, ?, ?, ?)`,
  UPDATE_EVENT: `UPDATE event SET name = ?, date = ?, description = ?, location = ?, organizers = ? WHERE id = ?`,
  DELETE_EVENT: `DELETE FROM event WHERE id = ?`
};


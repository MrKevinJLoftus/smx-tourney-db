module.exports = {
  GET_EVENTS_BY_EXTERNAL_SOURCE: `SELECT id, name, external_id FROM event WHERE external_source = ?`,
  GET_EVENT_BY_EXTERNAL_SOURCE_ID: `SELECT id, name FROM event WHERE external_source = ? AND external_id = ? LIMIT 1`,
  CREATE_EVENT_WITH_EXTERNAL_SOURCE: `INSERT INTO event (name, date, description, location, organizers, created_by, external_source, external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  CREATE_MATCH_EXTERNAL_SOURCE: `INSERT INTO match_external_source (match_id, source, source_key) VALUES (?, ?, ?)`,
  /** Pass key count; params = flat array of (source, source_key) per key. */
  GET_MATCH_EXTERNAL_SOURCES_BY_KEYS: (keyCount) => {
    if (keyCount < 1) return null;
    const pairs = Array(keyCount).fill('(?, ?)').join(', ');
    return `SELECT match_id, source, source_key FROM match_external_source WHERE (source, source_key) IN (${pairs})`;
  },
};

module.exports = {
  GET_ALL_SONGS: `SELECT * FROM song ORDER BY title ASC`,
  GET_SONG_BY_ID: `SELECT * FROM song WHERE id = ?`,
  CREATE_SONG: `INSERT INTO song (title, artist) VALUES (?, ?)`,
  UPDATE_SONG: `UPDATE song SET title = ?, artist = ? WHERE id = ?`,
  DELETE_SONG: `DELETE FROM song WHERE id = ?`,
  GET_CHARTS_BY_SONG: `SELECT id, song_id, difficulty, mode, CONCAT(mode, ' ', difficulty) as display_name FROM song_x_chart WHERE song_id = ? ORDER BY mode ASC, difficulty ASC`,
  /** Every song with its charts (one row per chart; chart columns null for songs without charts). */
  GET_SONG_CATALOG: `SELECT s.id AS song_id, s.title, s.artist, c.id AS chart_id, c.mode, c.difficulty
    FROM song s
    LEFT JOIN song_x_chart c ON c.song_id = s.id`,
  /** Pass row count; params = flat array of (song_id, difficulty, mode) per row. */
  CREATE_CHARTS_BATCH: (rowCount) => {
    if (rowCount < 1) return null;
    const values = Array(rowCount).fill('(?, ?, ?)').join(', ');
    return `INSERT INTO song_x_chart (song_id, difficulty, mode) VALUES ${values}`;
  },
  UPDATE_CHART_DIFFICULTY: `UPDATE song_x_chart SET difficulty = ? WHERE id = ?`,
  COUNT_MATCHES_BY_CHARTS: (chartCount) => {
    if (chartCount < 1) return null;
    const placeholders = Array(chartCount).fill('?').join(',');
    return `SELECT chart_id, COUNT(DISTINCT match_id) AS match_count
      FROM match_x_player_x_song
      WHERE chart_id IN (${placeholders})
      GROUP BY chart_id`;
  }
};


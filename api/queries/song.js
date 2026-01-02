module.exports = {
  GET_ALL_SONGS: `SELECT * FROM song ORDER BY title ASC`,
  GET_SONG_BY_ID: `SELECT * FROM song WHERE id = ?`,
  CREATE_SONG: `INSERT INTO song (title, artist) VALUES (?, ?)`,
  UPDATE_SONG: `UPDATE song SET title = ?, artist = ? WHERE id = ?`,
  DELETE_SONG: `DELETE FROM song WHERE id = ?`,
  GET_CHARTS_BY_SONG: `SELECT id, song_id, difficulty, mode, CONCAT(mode, ' ', difficulty) as display_name FROM song_x_chart WHERE song_id = ? ORDER BY mode ASC, difficulty ASC`
};


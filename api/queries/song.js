module.exports = {
  GET_ALL_SONGS: `SELECT * FROM song ORDER BY title ASC`,
  GET_SONG_BY_ID: `SELECT * FROM song WHERE id = ?`,
  CREATE_SONG: `INSERT INTO song (title, artist, difficulty) VALUES (?, ?, ?)`,
  UPDATE_SONG: `UPDATE song SET title = ?, artist = ?, difficulty = ? WHERE id = ?`,
  DELETE_SONG: `DELETE FROM song WHERE id = ?`
};


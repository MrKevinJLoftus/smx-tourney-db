const dbconn = require('../database/connector');
const queries = require('../queries/song');

exports.getAllSongs = async (req, res) => {
  console.log('Fetching all songs');
  const songs = await dbconn.executeMysqlQuery(queries.GET_ALL_SONGS, []);
  res.status(200).json(songs);
};

exports.getSongById = async (req, res) => {
  const songId = req.params.id;
  console.log(`Fetching song with id: ${songId}`);
  const songs = await dbconn.executeMysqlQuery(queries.GET_SONG_BY_ID, [songId]);
  if (!songs || songs.length < 1) {
    return res.status(404).json({ message: 'Song not found' });
  }
  res.status(200).json(songs[0]);
};

exports.createSong = async (req, res) => {
  const { title, artist } = req.body;
  console.log(`Creating new song: ${title}`);
  if (!title) {
    return res.status(400).json({ message: 'Song title is required' });
  }
  const result = await dbconn.executeMysqlQuery(queries.CREATE_SONG, [title, artist || null]);
  const newSong = await dbconn.executeMysqlQuery(queries.GET_SONG_BY_ID, [result.insertId]);
  res.status(201).json(newSong[0]);
};

exports.updateSong = async (req, res) => {
  const songId = req.params.id;
  const { title, artist } = req.body;
  console.log(`Updating song with id: ${songId}`);
  if (!title) {
    return res.status(400).json({ message: 'Song title is required' });
  }
  await dbconn.executeMysqlQuery(queries.UPDATE_SONG, [title, artist || null, songId]);
  const updatedSong = await dbconn.executeMysqlQuery(queries.GET_SONG_BY_ID, [songId]);
  if (!updatedSong || updatedSong.length < 1) {
    return res.status(404).json({ message: 'Song not found' });
  }
  res.status(200).json(updatedSong[0]);
};

exports.deleteSong = async (req, res) => {
  const songId = req.params.id;
  console.log(`Deleting song with id: ${songId}`);
  const song = await dbconn.executeMysqlQuery(queries.GET_SONG_BY_ID, [songId]);
  if (!song || song.length < 1) {
    return res.status(404).json({ message: 'Song not found' });
  }
  await dbconn.executeMysqlQuery(queries.DELETE_SONG, [songId]);
  res.status(200).json({ message: 'Song deleted successfully' });
};

exports.getChartsBySong = async (req, res) => {
  const songId = req.params.id;
  console.log(`Fetching charts for song id: ${songId}`);
  const charts = await dbconn.executeMysqlQuery(queries.GET_CHARTS_BY_SONG, [songId]);
  res.status(200).json(charts);
};


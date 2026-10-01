const dbconn = require('../database/connector');
const queries = require('../queries/song');
const {
  SmxSongCatalogError,
  buildCatalogDiff,
  applyCatalogDiff,
} = require('../services/smxSongCatalog');

function handleCatalogError(res, e, logLabel) {
  if (e instanceof SmxSongCatalogError) {
    return res.status(502).json({ message: e.message });
  }
  console.error(`${logLabel}:`, e);
  return res.status(500).json({ message: e.message || 'Song catalog refresh failed' });
}

/**
 * POST: compare the ddr.tools StepManiaX song data with the local catalog. Writes nothing.
 */
exports.previewSongCatalogRefresh = async (req, res) => {
  try {
    const diff = await buildCatalogDiff();
    res.status(200).json(diff);
  } catch (e) {
    return handleCatalogError(res, e, 'previewSongCatalogRefresh');
  }
};

/**
 * POST body: { applyLevelChanges?: boolean }
 * Adds missing songs and charts (and re-rated levels when asked) in one transaction.
 */
exports.applySongCatalogRefresh = async (req, res) => {
  const applyLevelChanges = req.body?.applyLevelChanges === true;
  try {
    const result = await dbconn.withTransaction(async (connection) => {
      const diff = await buildCatalogDiff(connection);
      const summary = await applyCatalogDiff(diff, { applyLevelChanges }, connection);
      return { diff, summary };
    });
    const { songsAdded, chartsAdded, levelChangesApplied } = result.summary;
    const changed = songsAdded + chartsAdded + levelChangesApplied > 0;
    res.status(200).json({
      message: changed ? 'Song catalog updated' : 'Song catalog already up to date',
      sourceUrl: result.diff.sourceUrl,
      sourceLastUpdated: result.diff.sourceLastUpdated,
      ...result.summary,
    });
  } catch (e) {
    return handleCatalogError(res, e, 'applySongCatalogRefresh');
  }
};

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


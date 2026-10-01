/**
 * Refreshes the local song / song_x_chart catalog from the ddr.tools StepManiaX song data
 * (the same smx.json the seed script and ddr.tools card draws use).
 *
 * Additive by design: songs and charts missing locally are inserted, and level re-rates are
 * applied only when asked. Nothing is deleted, since match rows reference songs and charts.
 */

const dbconn = require('../database/connector');
const songQueries = require('../queries/song');
const { normalizeText, modeFor } = require('./chartResolver');

const DEFAULT_SMX_SONGS_URL =
  'https://raw.githubusercontent.com/noahm/DDRCardDraw/main/src/songs/smx.json';

class SmxSongCatalogError extends Error {}

function sourceUrl() {
  const raw = process.env.SMX_SONGS_JSON_URL;
  return raw && String(raw).trim() ? String(raw).trim() : DEFAULT_SMX_SONGS_URL;
}

/**
 * @returns {Promise<{ url: string, lastUpdated: number|null, songs: Array<{ title: string, artist: string, charts: Array<{ mode: string, difficulty: number }> }> }>}
 */
async function fetchUpstreamSongs() {
  const url = sourceUrl();
  const res = await fetch(url);
  if (!res.ok) {
    throw new SmxSongCatalogError(`Song data source returned ${res.status} (${url}).`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.songs)) {
    throw new SmxSongCatalogError(`Song data at ${url} has no "songs" list.`);
  }

  const byKey = new Map();
  for (const song of data.songs) {
    const title = song?.name ? String(song.name).trim() : '';
    if (!title) continue;
    const artist = song.artist ? String(song.artist).trim() : '';
    const key = songKey(title, artist);
    if (!byKey.has(key)) byKey.set(key, { title, artist, charts: [] });
    const entry = byKey.get(key);
    const modes = new Set(entry.charts.map((c) => c.mode));
    for (const chart of song.charts || []) {
      const plus = Array.isArray(chart.flags) && chart.flags.includes('plus');
      const mode = modeFor(chart.diffClass, plus);
      const difficulty = Number(chart.lvl);
      if (!mode || !Number.isFinite(difficulty) || modes.has(mode)) continue;
      modes.add(mode);
      entry.charts.push({ mode, difficulty });
    }
  }

  return {
    url,
    lastUpdated: Number.isFinite(Number(data.meta?.lastUpdated)) ? Number(data.meta.lastUpdated) : null,
    songs: [...byKey.values()],
  };
}

function songKey(title, artist) {
  return `${normalizeText(title)}|${normalizeText(artist)}`;
}

/**
 * @param {import('mysql').Connection} [connection]
 * @returns {Promise<{ byKey: Map<string, object>, titleOnly: Map<string, object[]>, songs: object[] }>}
 */
async function loadLocalCatalog(connection) {
  const rows = await dbconn.executeMysqlQuery(songQueries.GET_SONG_CATALOG, [], connection);
  const songsById = new Map();
  for (const row of rows || []) {
    let song = songsById.get(row.song_id);
    if (!song) {
      song = { id: row.song_id, title: row.title, artist: row.artist || '', chartsByMode: new Map() };
      songsById.set(row.song_id, song);
    }
    if (row.chart_id != null && row.mode) {
      song.chartsByMode.set(row.mode, { id: row.chart_id, difficulty: Number(row.difficulty) });
    }
  }
  const songs = [...songsById.values()];
  const byKey = new Map();
  const titleOnly = new Map();
  for (const song of songs) {
    const key = songKey(song.title, song.artist);
    if (!byKey.has(key)) byKey.set(key, song);
    if (!normalizeText(song.artist)) {
      const t = normalizeText(song.title);
      if (!titleOnly.has(t)) titleOnly.set(t, []);
      titleOnly.get(t).push(song);
    }
  }
  return { byKey, titleOnly, songs };
}

/**
 * Compares upstream songs with the local catalog.
 * @param {import('mysql').Connection} [connection]
 */
async function buildCatalogDiff(connection) {
  const upstream = await fetchUpstreamSongs();
  const local = await loadLocalCatalog(connection);

  const newSongs = [];
  const newCharts = [];
  const levelChanges = [];
  const matchedLocalIds = new Set();

  for (const song of upstream.songs) {
    let localSong = local.byKey.get(songKey(song.title, song.artist));
    if (!localSong) {
      const artistless = local.titleOnly.get(normalizeText(song.title)) || [];
      localSong = artistless.length === 1 ? artistless[0] : null;
    }
    if (!localSong) {
      newSongs.push(song);
      continue;
    }
    matchedLocalIds.add(localSong.id);
    for (const chart of song.charts) {
      const existing = localSong.chartsByMode.get(chart.mode);
      if (!existing) {
        newCharts.push({ songId: localSong.id, title: localSong.title, artist: localSong.artist, ...chart });
      } else if (existing.difficulty !== chart.difficulty) {
        levelChanges.push({
          chartId: existing.id,
          songId: localSong.id,
          title: localSong.title,
          artist: localSong.artist,
          mode: chart.mode,
          from: existing.difficulty,
          to: chart.difficulty,
          matchCount: 0,
        });
      }
    }
  }

  if (levelChanges.length) {
    const rows = await dbconn.executeMysqlQuery(
      songQueries.COUNT_MATCHES_BY_CHARTS(levelChanges.length),
      levelChanges.map((c) => c.chartId),
      connection
    );
    const counts = new Map((rows || []).map((r) => [r.chart_id, Number(r.match_count)]));
    for (const change of levelChanges) change.matchCount = counts.get(change.chartId) || 0;
  }

  const localOnlySongs = local.songs
    .filter((s) => !matchedLocalIds.has(s.id))
    .map((s) => ({ id: s.id, title: s.title, artist: s.artist }));

  return {
    sourceUrl: upstream.url,
    sourceLastUpdated: upstream.lastUpdated,
    upstreamSongCount: upstream.songs.length,
    upstreamChartCount: upstream.songs.reduce((n, s) => n + s.charts.length, 0),
    localSongCount: local.songs.length,
    newSongs,
    newCharts,
    levelChanges,
    localOnlySongs,
  };
}

/**
 * Applies a diff inside the given transaction.
 * @param {object} diff from buildCatalogDiff
 * @param {{ applyLevelChanges: boolean }} options
 * @param {import('mysql').Connection} connection
 */
async function applyCatalogDiff(diff, { applyLevelChanges }, connection) {
  const chartRows = diff.newCharts.map((c) => [c.songId, c.difficulty, c.mode]);

  for (const song of diff.newSongs) {
    const result = await dbconn.executeMysqlQuery(
      songQueries.CREATE_SONG,
      [song.title, song.artist || null],
      connection
    );
    for (const chart of song.charts) {
      chartRows.push([result.insertId, chart.difficulty, chart.mode]);
    }
  }

  if (chartRows.length) {
    await dbconn.executeMysqlQuery(
      songQueries.CREATE_CHARTS_BATCH(chartRows.length),
      chartRows.flat(),
      connection
    );
  }

  let levelChangesApplied = 0;
  if (applyLevelChanges) {
    for (const change of diff.levelChanges) {
      await dbconn.executeMysqlQuery(
        songQueries.UPDATE_CHART_DIFFICULTY,
        [change.to, change.chartId],
        connection
      );
      levelChangesApplied++;
    }
  }

  return {
    songsAdded: diff.newSongs.length,
    chartsAdded: chartRows.length,
    levelChangesApplied,
    levelChangesSkipped: diff.levelChanges.length - levelChangesApplied,
  };
}

module.exports = {
  SmxSongCatalogError,
  buildCatalogDiff,
  applyCatalogDiff,
};

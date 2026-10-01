const dbconn = require('../database/connector');
const songQueries = require('../queries/song');

/** Case-, accent-, punctuation- and whitespace-insensitive key. */
function normalizeText(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function modeFor(diffClass, plus) {
  const base = String(diffClass || '').trim().toLowerCase();
  if (!base) return '';
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}${plus ? '+' : ''}`;
}

/**
 * Loads the local song/chart catalog once and resolves imported charts against it.
 * @param {import('mysql').Connection} [connection]
 */
async function createChartResolver(connection) {
  const rows = await dbconn.executeMysqlQuery(songQueries.GET_SONG_CATALOG, [], connection);

  /** normalized title -> [{ songId, artistKey, charts: [{ chartId, mode, difficulty }] }] */
  const songsByTitle = new Map();
  const songsById = new Map();
  for (const row of rows || []) {
    let song = songsById.get(row.song_id);
    if (!song) {
      song = { songId: row.song_id, artistKey: normalizeText(row.artist), charts: [] };
      songsById.set(row.song_id, song);
      const titleKey = normalizeText(row.title);
      if (!songsByTitle.has(titleKey)) songsByTitle.set(titleKey, []);
      songsByTitle.get(titleKey).push(song);
    }
    if (row.chart_id != null) {
      song.charts.push({ chartId: row.chart_id, mode: row.mode, difficulty: Number(row.difficulty) });
    }
  }

  const cache = new Map();

  function findSong(title, artist) {
    const candidates = songsByTitle.get(normalizeText(title)) || [];
    const artistKey = normalizeText(artist);
    if (!artistKey) {
      return candidates.length === 1 ? candidates[0] : null;
    }
    return (
      candidates.find((s) => s.artistKey === artistKey) ||
      candidates.find((s) => s.artistKey && (s.artistKey.includes(artistKey) || artistKey.includes(s.artistKey))) ||
      null
    );
  }

  function findChart(song, diffClass, plus, level) {
    const atLevel = song.charts.filter((c) => level == null || c.difficulty === level);
    if (!diffClass) {
      return atLevel.length === 1 ? atLevel[0] : null;
    }
    const modes = plus === null
      ? [modeFor(diffClass, false), modeFor(diffClass, true)]
      : [modeFor(diffClass, plus)];
    for (const mode of modes) {
      const hit = atLevel.find((c) => c.mode === mode);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * @param {{ title: string, artist: string, diffClass: string, plus: boolean|null, level: number|null }} chart
   * @returns {{ songId: number|null, chartId: number|null, resolved: boolean, reason?: string }}
   */
  function resolve(chart) {
    const key = [normalizeText(chart.title), normalizeText(chart.artist), chart.diffClass, chart.plus, chart.level].join('|');
    if (cache.has(key)) return cache.get(key);

    let result;
    const song = findSong(chart.title, chart.artist);
    if (!song) {
      result = { songId: null, chartId: null, resolved: false, reason: 'song not found' };
    } else {
      const hit = findChart(song, chart.diffClass, chart.plus, chart.level);
      result = hit
        ? { songId: song.songId, chartId: hit.chartId, resolved: true }
        : { songId: song.songId, chartId: null, resolved: false, reason: 'chart not found for song' };
    }
    cache.set(key, result);
    return result;
  }

  return { resolve };
}

module.exports = {
  createChartResolver,
  normalizeText,
  modeFor,
};

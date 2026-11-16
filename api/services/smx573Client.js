/**
 * Thin client for the public JSON API behind the smx.573.no score browser.
 * Each resource takes one `q` parameter holding a JSON query (filters plus `_take`/`_skip`
 * paging); plain query parameters are ignored.
 * Charts and songs change rarely; scores are fetched per chart and date range.
 */

const DEFAULT_BASE_URL = 'https://api.smx.573.no';
// The API never returns more than 100 rows per request.
const PAGE_SIZE = 100;
const MAX_SCORE_PAGES = 50;
const MAX_CATALOG_PAGES = 200;
const REQUEST_TIMEOUT_MS = 15 * 1000;

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

class Smx573Error extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'Smx573Error';
    this.status = details.status;
  }
}

function baseUrl() {
  const raw = process.env.SMX573_BASE_URL;
  const url = raw && String(raw).trim() ? String(raw).trim() : DEFAULT_BASE_URL;
  return url.replace(/\/+$/, '');
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * @param {string} resource e.g. 'charts'
 * @param {object} query filters plus `_take`/`_skip`, sent as the `q` parameter
 * @returns {Promise<Array>}
 */
async function fetchPage(resource, query) {
  const url = `${baseUrl()}/${resource}?q=${encodeURIComponent(JSON.stringify(query))}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'smx-tdb-weekly/1.0' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Smx573Error(`smx.573.no did not answer /${resource} within ${REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    throw new Smx573Error(`Could not reach smx.573.no (${err.message}).`);
  }
  if (!res.ok) {
    throw new Smx573Error(`smx.573.no returned HTTP ${res.status} for /${resource}.`, {
      status: res.status,
    });
  }
  // A moved API tends to answer with the site's HTML page and a 200.
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    throw new Smx573Error(
      `smx.573.no returned ${contentType || 'no content type'} instead of JSON for ${baseUrl()}/${resource}; ` +
        'check SMX573_BASE_URL.'
    );
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Smx573Error(`Invalid JSON from smx.573.no for /${resource}.`);
  }
  if (!Array.isArray(json)) throw new Smx573Error(`smx.573.no /${resource} is not an array.`);
  return json;
}

/** Every row matching `filters`, sorted by id ascending. */
async function fetchAll(resource, filters, maxPages) {
  const rows = [];
  for (let page = 0; page < maxPages; page++) {
    const json = await fetchPage(resource, {
      ...filters,
      _sort_by: 'id',
      _order: 'asc',
      _take: PAGE_SIZE,
      _skip: page * PAGE_SIZE,
    });
    rows.push(...json);
    if (json.length < PAGE_SIZE) return rows;
  }
  throw new Smx573Error(`smx.573.no /${resource} has more than ${maxPages * PAGE_SIZE} rows.`);
}

/**
 * @returns {Promise<Array<{ id: number, songId: number, level: number, difficultyName: string, difficultyDisplay: string, isEnabled: boolean, createdAt: string|null }>>}
 */
async function getCharts() {
  const cached = cacheGet('charts');
  if (cached) return cached;

  // Player edits are most of the list and never in the draw.
  const json = await fetchAll('charts', { is_edit: { nin: [true] } }, MAX_CATALOG_PAGES);

  const charts = json
    .map((c) => ({
      id: Number(c.id),
      songId: Number(c.song_id),
      level: Number(c.difficulty),
      difficultyName: String(c.difficulty_name || ''),
      difficultyDisplay: String(c.difficulty_display || c.difficulty_name || ''),
      isEnabled: c.is_enabled !== false,
      createdAt: c.created_at || null,
    }))
    .filter((c) => Number.isFinite(c.id) && Number.isFinite(c.songId) && Number.isFinite(c.level));

  cacheSet('charts', charts, CATALOG_TTL_MS);
  return charts;
}

/**
 * @returns {Promise<Map<number, { id: number, title: string, subtitle: string, artist: string, coverThumb: string|null, isEnabled: boolean }>>}
 */
async function getSongs() {
  const cached = cacheGet('songs');
  if (cached) return cached;

  const json = await fetchAll('songs', {}, MAX_CATALOG_PAGES);

  const songs = new Map();
  for (const s of json) {
    const id = Number(s.id);
    if (!Number.isFinite(id)) continue;
    songs.set(id, {
      id,
      title: String(s.title || '').trim(),
      subtitle: String(s.subtitle || '').trim(),
      artist: String(s.artist || '').trim(),
      coverThumb: s.cover_thumb || null,
      isEnabled: s.is_enabled !== false,
    });
  }

  cacheSet('songs', songs, CATALOG_TTL_MS);
  return songs;
}

function normalizeScore(raw) {
  const gamer = raw && raw.gamer;
  const score = Number(raw && raw.score);
  const gamerId = Number(gamer && gamer.id);
  if (!Number.isFinite(score) || !Number.isFinite(gamerId)) return null;
  return {
    id: Number(raw.id),
    gamerId,
    username: String(gamer.username || '').trim(),
    country: gamer.country || null,
    picturePath: gamer.picture_path || null,
    hexColor: gamer.hex_color || null,
    score,
    fullCombo: Boolean(raw.full_combo),
    createdAt: raw.created_at || null,
  };
}

function isEarlier(a, b) {
  const aMs = Date.parse(a.createdAt);
  const bMs = Date.parse(b.createdAt);
  if (aMs !== bMs) return aMs < bMs;
  return a.id < b.id;
}

/**
 * Each player's first play on one chart, at 100% music speed, in [fromMs, toMs).
 * @param {number} chartId
 * @param {{ fromMs: number, toMs: number }} range
 */
async function getFirstScoresForChart(chartId, { fromMs, toMs }) {
  const byGamer = new Map();
  for (let page = 0; page < MAX_SCORE_PAGES; page++) {
    // Newest first, so plays arriving mid-fetch only repeat rows across pages.
    const json = await fetchPage('scores', {
      song_chart_id: [chartId],
      music_speed: 100,
      created_at: {
        gte: new Date(fromMs).toISOString(),
        lte: new Date(toMs - 1).toISOString(),
      },
      _sort_by: 'id',
      _order: 'desc',
      _take: PAGE_SIZE,
      _skip: page * PAGE_SIZE,
    });

    for (const raw of json) {
      const score = normalizeScore(raw);
      if (!score || !Number.isFinite(Date.parse(score.createdAt))) continue;
      const existing = byGamer.get(score.gamerId);
      if (!existing || isEarlier(score, existing)) byGamer.set(score.gamerId, score);
    }
    if (json.length < PAGE_SIZE) break;
  }
  return [...byGamer.values()].map(({ id, ...score }) => score);
}

module.exports = {
  Smx573Error,
  getCharts,
  getSongs,
  getFirstScoresForChart,
};

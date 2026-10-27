/**
 * Thin client for the public JSON API behind the smx.573.no score browser.
 * Charts and songs change rarely; scores are fetched per chart and date range.
 */

const DEFAULT_BASE_URL = 'https://smx.573.no';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

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

async function fetchJson(path) {
  const url = `${baseUrl()}${path}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'smx-tdb-weekly/1.0' },
    });
  } catch (err) {
    throw new Smx573Error(`Could not reach smx.573.no (${err.message}).`);
  }
  if (!res.ok) {
    throw new Smx573Error(`smx.573.no returned HTTP ${res.status} for ${path}.`, {
      status: res.status,
    });
  }
  try {
    return await res.json();
  } catch {
    throw new Smx573Error(`Invalid JSON from smx.573.no for ${path}.`);
  }
}

/**
 * @returns {Promise<Array<{ id: number, songId: number, level: number, difficultyName: string, difficultyDisplay: string, isEnabled: boolean, createdAt: string|null }>>}
 */
async function getCharts() {
  const cached = cacheGet('charts');
  if (cached) return cached;

  const json = await fetchJson('/api/charts');
  if (!Array.isArray(json)) throw new Smx573Error('smx.573.no chart list is not an array.');

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

  const json = await fetchJson('/api/songs');
  if (!Array.isArray(json)) throw new Smx573Error('smx.573.no song list is not an array.');

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

/**
 * Best score per player on one chart, at 100% music speed, within [from, to] in tz.
 * @param {number} chartId
 * @param {{ from: string, to: string, tz: string }} range dates as YYYY-MM-DD
 */
async function getBestScoresForChart(chartId, { from, to, tz }) {
  const byGamer = new Map();
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      chart_ids: String(chartId),
      best_per_user: '1',
      sort: 'score',
      music_speed: '100',
      from,
      to,
      tz,
      skip: String(page * PAGE_SIZE),
    });
    const json = await fetchJson(`/api/scores?${params.toString()}`);
    if (!Array.isArray(json)) throw new Smx573Error('smx.573.no score list is not an array.');

    for (const raw of json) {
      const score = normalizeScore(raw);
      if (!score) continue;
      const existing = byGamer.get(score.gamerId);
      if (!existing || score.score > existing.score) byGamer.set(score.gamerId, score);
    }
    if (json.length < PAGE_SIZE) break;
  }
  return [...byGamer.values()];
}

module.exports = {
  Smx573Error,
  getCharts,
  getSongs,
  getBestScoresForChart,
};

/**
 * Thin client for the StatManiaX public HTTP API (statmaniax.com).
 * Scores refresh on StatManiaX roughly every 15 minutes.
 */

const STATMANIAX_BASE = 'https://statmaniax.com';

const VALID_MODES = new Set(['beginner', 'easy', 'hard', 'wild', 'dual', 'full']);

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

class StatManiaxError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'StatManiaxError';
    this.status = details.status;
  }
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

function cacheSet(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id);
  const username = raw.username != null ? String(raw.username).trim() : '';
  if (!Number.isFinite(id) || id <= 0 || !username) return null;
  return { id, username };
}

function normalizeUsersPayload(json) {
  const users = json && Array.isArray(json.users) ? json.users : [];
  return users.map(normalizeUser).filter(Boolean);
}

function isCompleteSearchResult(users) {
  return users.length > 0 && users.every((u) => u.id && u.username);
}

async function fetchJson(path, options = {}) {
  const url = path.startsWith('http') ? path : `${STATMANIAX_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'smx-tdb-scout/1.0',
      ...(options.headers || {}),
    },
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new StatManiaxError(`Invalid JSON from StatManiaX (HTTP ${res.status})`, {
      status: res.status,
    });
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      `StatManiaX request failed with HTTP ${res.status}`;
    throw new StatManiaxError(String(msg), { status: res.status });
  }

  return json;
}

/**
 * @param {string} html
 * @returns {{ id: number, username: string }[]}
 */
function parsePlayersFromSearchHtml(html) {
  if (!html || typeof html !== 'string') return [];

  const byId = new Map();
  const blockPattern =
    /<a\s+href="(?:https:\/\/statmaniax\.com\/)?player\/(\d+)"[^>]*>\s*<h2>([^<]+)<\/h2>/gi;

  for (const match of html.matchAll(blockPattern)) {
    const id = Number(match[1]);
    const username = String(match[2] || '').trim();
    if (!Number.isFinite(id) || id <= 0 || !username) continue;
    if (!byId.has(id)) {
      byId.set(id, { id, username });
    }
  }

  return [...byId.values()];
}

/**
 * @param {string} query
 * @returns {Promise<{ id: number, username: string }[]>}
 */
async function searchUsersHtml(query) {
  const form = new URLSearchParams();
  form.set('query', query.trim());
  form.set('search', '');

  const res = await fetch(`${STATMANIAX_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'smx-tdb-scout/1.0',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    throw new StatManiaxError(`StatManiaX search failed with HTTP ${res.status}`, {
      status: res.status,
    });
  }

  const html = await res.text();
  return parsePlayersFromSearchHtml(html);
}

/**
 * @param {number} userId
 * @returns {Promise<{ id: number, username: string } | null>}
 */
async function getUserById(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const cacheKey = `user:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const json = await fetchJson(`/api/users/${id}`);
  const users = normalizeUsersPayload(json);
  const user = users[0] || null;
  if (user) cacheSet(cacheKey, user);
  return user;
}

/**
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ id: number, username: string }[]>}
 */
async function searchUsers(query, opts = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const limit = opts.limit ?? 20;
  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached.slice(0, limit);

  let results = [];

  try {
    const json = await fetchJson(`/api/users/search?q=${encodeURIComponent(q)}`);
    results = normalizeUsersPayload(json);
  } catch {
    results = [];
  }

  if (!isCompleteSearchResult(results)) {
    results = await searchUsersHtml(q);
  }

  const deduped = [];
  const seen = new Set();
  for (const user of results) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    deduped.push(user);
  }

  cacheSet(cacheKey, deduped);
  return deduped.slice(0, limit);
}

/**
 * @param {string} query
 * @returns {Promise<{ id: number, username: string } | null>}
 */
async function resolveUser(query) {
  const raw = String(query || '').trim();
  if (!raw) return null;

  const profileUrlMatch = raw.match(/statmaniax\.com\/player\/(\d+)/i);
  if (profileUrlMatch) {
    return getUserById(Number(profileUrlMatch[1]));
  }

  if (/^\d+$/.test(raw)) {
    return getUserById(Number(raw));
  }

  const results = await searchUsers(raw, { limit: 50 });
  if (!results.length) return null;

  const lower = raw.toLowerCase();
  const exact = results.find((u) => u.username.toLowerCase() === lower);
  if (exact) return exact;

  const prefix = results.filter((u) => u.username.toLowerCase().startsWith(lower));
  if (prefix.length === 1) return prefix[0];

  return results[0];
}

/**
 * @param {string} mode
 * @returns {string}
 */
function normalizeMode(mode) {
  const m = String(mode || 'wild').trim().toLowerCase();
  if (m === 'basic') return 'beginner';
  return VALID_MODES.has(m) ? m : 'wild';
}

function isValidMode(mode) {
  const m = String(mode || '').trim().toLowerCase();
  return VALID_MODES.has(m) || m === 'basic';
}

/**
 * @param {unknown} raw
 * @returns {import('./pocketVetoService').NormalizedScore | null}
 */
function normalizeScore(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const songChartId = String(raw.song_chart_id || raw.songChartId || '').trim();
  const title = String(raw.title || '').trim();
  const artist = String(raw.artist || '').trim();
  const level = Number(raw.difficulty);
  const score = Number(raw.score);
  const gameSongId = raw.game_song_id != null ? Number(raw.game_song_id) : null;
  const difficultyId = raw.difficulty_id != null ? Number(raw.difficulty_id) : null;

  if (!songChartId || !title || !Number.isFinite(level) || !Number.isFinite(score)) {
    return null;
  }

  return {
    songChartId,
    title,
    artist,
    level,
    score,
    gameSongId: Number.isFinite(gameSongId) ? gameSongId : null,
    difficultyId: Number.isFinite(difficultyId) ? difficultyId : null,
  };
}

/**
 * @param {number} userId
 * @param {string} mode
 * @returns {Promise<Map<string, import('./pocketVetoService').NormalizedScore>>}
 */
async function getUserHighscoresByMode(userId, mode) {
  const id = Number(userId);
  const normalizedMode = normalizeMode(mode);
  if (!Number.isFinite(id) || id <= 0) {
    throw new StatManiaxError('Invalid user id.');
  }

  const cacheKey = `scores:${id}:${normalizedMode}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const json = await fetchJson(
    `/api/get_user_highscores_info/${id}/${encodeURIComponent(normalizedMode)}`
  );
  const rawScores = json && json.scores && typeof json.scores === 'object' ? json.scores : {};

  const map = new Map();
  for (const raw of Object.values(rawScores)) {
    const score = normalizeScore(raw);
    if (!score) continue;
    map.set(score.songChartId, score);
  }

  cacheSet(cacheKey, map);
  return map;
}

module.exports = {
  StatManiaxError,
  VALID_MODES,
  getUserById,
  searchUsers,
  resolveUser,
  getUserHighscoresByMode,
  normalizeMode,
  isValidMode,
};

/**
 * Weekly challenge leaderboards built from smx.573.no scores.
 *
 * Nothing is stored: each week's charts come from a PRNG seeded by the week key, so any
 * week can be redrawn on demand, and score snapshots live only in memory.
 */

const smx573 = require('./smx573Client');

const DATA_HOST = 'https://data.stepmaniax.com/';
const BROWSER_URL = 'https://smx.573.no/browser';
const DEFAULT_TZ = 'America/New_York';
const MAX_WEEKS_BACK = 8;
const PAST_WEEK_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_CONCURRENCY = 4;

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', names: ['easy', 'easy2'] },
  { key: 'hard', label: 'Hard', names: ['hard', 'hard2'] },
  { key: 'wild', label: 'Wild', names: ['wild'] },
  { key: 'dual', label: 'Dual', names: ['dual', 'dual2'] },
  { key: 'full', label: 'Full', names: ['full', 'full2'] },
];

class WeeklyChallengeError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'WeeklyChallengeError';
    this.statusCode = statusCode;
  }
}

function timeZone() {
  const raw = process.env.WEEKLY_CHALLENGE_TZ;
  return raw && String(raw).trim() ? String(raw).trim() : DEFAULT_TZ;
}

function refreshTtlMs() {
  const minutes = Number(process.env.WEEKLY_CHALLENGE_REFRESH_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 10) * 60 * 1000;
}

// ---------- Week window ----------

function zonedParts(instantMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function tzOffsetMs(instantMs, tz) {
  const p = zonedParts(instantMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** UTC instant of local midnight at the start of dateKey (YYYY-MM-DD) in tz. */
function zonedMidnightMs(dateKey, tz) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let result = guess - tzOffsetMs(guess, tz);
  result = guess - tzOffsetMs(result, tz);
  return result;
}

function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * @param {number} nowMs
 * @param {number} weekOffset 0 for the current week, -1 for last week, ...
 * @param {string} tz
 */
function weekWindow(nowMs, weekOffset, tz) {
  const p = zonedParts(nowMs, tz);
  const today = new Date(Date.UTC(p.year, p.month - 1, p.day)).toISOString().slice(0, 10);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return windowForWeekKey(addDays(today, -daysSinceMonday + 7 * weekOffset), tz);
}

/** @param {string} weekKey the week's Monday as YYYY-MM-DD */
function windowForWeekKey(weekKey, tz) {
  return {
    weekKey,
    from: weekKey,
    to: addDays(weekKey, 6),
    startsAtMs: zonedMidnightMs(weekKey, tz),
    endsAtMs: zonedMidnightMs(addDays(weekKey, 7), tz),
  };
}

function isWeekKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1 && date.toISOString().startsWith(value);
}

// ---------- Seeded draw ----------

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Splits [min, max] into three contiguous level ranges. */
function levelBuckets(min, max) {
  const span = max - min + 1;
  const b1 = min + Math.round(span / 3);
  const b2 = min + Math.round((2 * span) / 3);
  return [
    { min, max: b1 - 1 },
    { min: b1, max: b2 - 1 },
    { min: b2, max },
  ];
}

/**
 * @param {Array} charts from smx573.getCharts()
 * @param {Map} songs from smx573.getSongs()
 * @param {{ names: string[] }} difficulty
 * @param {number} weekStartMs
 */
function eligiblePool(charts, songs, difficulty, weekStartMs) {
  return charts
    .filter((c) => {
      if (!difficulty.names.includes(c.difficultyName) || !c.isEnabled) return false;
      const song = songs.get(c.songId);
      if (!song || !song.isEnabled) return false;
      const created = c.createdAt ? Date.parse(c.createdAt) : NaN;
      return !Number.isFinite(created) || created < weekStartMs;
    })
    .sort((a, b) => a.id - b.id);
}

function drawDifficulty(pool, difficulty, weekKey) {
  if (!pool.length) return { levelRange: null, picks: [] };

  const levels = pool.map((c) => c.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  const buckets = levelBuckets(min, max);
  const salt = process.env.WEEKLY_CHALLENGE_SALT || '';
  const rng = mulberry32(hashString(`${weekKey}|${difficulty.key}|${salt}`));

  const picked = new Set();
  const picks = [];
  buckets.forEach((bucket, index) => {
    const order = [0, 1, 2]
      .map((i) => ({ i, distance: Math.abs(i - index) }))
      .sort((a, b) => a.distance - b.distance || a.i - b.i)
      .map((o) => buckets[o.i]);
    for (const range of order) {
      const candidates = pool.filter(
        (c) => c.level >= range.min && c.level <= range.max && !picked.has(c.id)
      );
      if (!candidates.length) continue;
      const chart = candidates[Math.floor(rng() * candidates.length)];
      picked.add(chart.id);
      picks.push({ chart, bucket });
      return;
    }
  });

  return { levelRange: { min, max }, picks };
}

/** Draws 3 charts per difficulty for the week. */
async function drawWeek(weekKey, weekStartMs) {
  const [charts, songs] = await Promise.all([smx573.getCharts(), smx573.getSongs()]);
  return {
    songs,
    difficulties: DIFFICULTIES.map((difficulty) => ({
      difficulty,
      ...drawDifficulty(eligiblePool(charts, songs, difficulty, weekStartMs), difficulty, weekKey),
    })),
  };
}

// ---------- Ranking ----------

function compareNames(a, b) {
  return (
    a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }) ||
    a.gamerId - b.gamerId
  );
}

/**
 * Sorts by each value descending in turn. Rows equal on every value share a rank and the
 * next rank skips ahead.
 * @param {Array<{ username: string, gamerId: number }>} rows
 * @param {...(row: any) => number} valueFns
 */
function rankBy(rows, ...valueFns) {
  const compareValues = (a, b) => {
    for (const valueOf of valueFns) {
      const diff = valueOf(b) - valueOf(a);
      if (diff) return diff;
    }
    return 0;
  };
  const sorted = [...rows].sort((a, b) => compareValues(a, b) || compareNames(a, b));
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || compareValues(sorted[index - 1], row) !== 0) rank = index + 1;
    return { rank, ...row };
  });
}

function avatarUrl(picturePath) {
  return picturePath ? DATA_HOST + picturePath : null;
}

function playerFields(s) {
  return {
    gamerId: s.gamerId,
    username: s.username,
    country: s.country,
    avatarUrl: avatarUrl(s.picturePath),
    hexColor: s.hexColor,
  };
}

function browserUrl(chartId, window, tz) {
  const params = new URLSearchParams({
    chart_ids: String(chartId),
    best_per_user: '1',
    sort: 'score',
    music_speed: '100',
    from: window.from,
    to: window.to,
  });
  return `${BROWSER_URL}?${params.toString()}&tz=${encodeURIComponent(tz)}`;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------- Snapshot ----------

async function buildSnapshot(window, weekOffset, nowMs) {
  const tz = timeZone();
  const draw = await drawWeek(window.weekKey, window.startsAtMs);

  const allPicks = draw.difficulties.flatMap((d) => d.picks);
  const scoreLists = await mapWithConcurrency(allPicks, FETCH_CONCURRENCY, ({ chart }) =>
    smx573.getBestScoresForChart(chart.id, { from: window.from, to: window.to, tz })
  );
  const scoresByChart = new Map(allPicks.map((p, i) => [p.chart.id, scoreLists[i]]));

  const difficulties = draw.difficulties.map(({ difficulty, levelRange, picks }) => {
    const players = new Map();

    const charts = picks.map(({ chart, bucket }, chartIndex) => {
      const song = draw.songs.get(chart.songId) || {};
      const scores = scoresByChart.get(chart.id) || [];

      for (const s of scores) {
        if (!players.has(s.gamerId)) {
          players.set(s.gamerId, { ...playerFields(s), scores: picks.map(() => null) });
        }
        players.get(s.gamerId).scores[chartIndex] = s.score;
      }

      return {
        chartId: chart.id,
        songId: chart.songId,
        title: song.title || '',
        subtitle: song.subtitle || '',
        artist: song.artist || '',
        coverUrl: song.coverThumb ? DATA_HOST + song.coverThumb : null,
        level: chart.level,
        difficultyDisplay: chart.difficultyDisplay,
        isPlus: chart.difficultyDisplay.endsWith('+'),
        bucket,
        browserUrl: browserUrl(chart.id, window, tz),
        scores: rankBy(
          scores.map((s) => ({
            ...playerFields(s),
            score: s.score,
            fullCombo: s.fullCombo,
            createdAt: s.createdAt,
          })),
          (row) => row.score
        ),
      };
    });

    const overall = rankBy(
      [...players.values()].map((p) => ({
        ...p,
        total: p.scores.reduce((sum, s) => sum + (s || 0), 0),
        chartsPlayed: p.scores.filter((s) => s != null).length,
      })),
      (row) => row.total
    );

    return { key: difficulty.key, label: difficulty.label, levelRange, charts, overall };
  });

  return {
    weekKey: window.weekKey,
    weekOffset,
    isCurrent: weekOffset === 0,
    from: window.from,
    to: window.to,
    timeZone: tz,
    startsAt: new Date(window.startsAtMs).toISOString(),
    endsAt: new Date(window.endsAtMs).toISOString(),
    refreshedAt: new Date(nowMs).toISOString(),
    difficulties,
  };
}

let warnedBadLaunchWeek = false;

/** @returns {string|null} the first Monday of the challenge, or null when unset */
function launchWeek() {
  const raw = String(process.env.WEEKLY_CHALLENGE_LAUNCH_WEEK || '').trim();
  if (!raw) return null;
  if (!isWeekKey(raw)) {
    if (!warnedBadLaunchWeek) {
      console.error(`WEEKLY_CHALLENGE_LAUNCH_WEEK must be a Monday as YYYY-MM-DD (got "${raw}").`);
      warnedBadLaunchWeek = true;
    }
    return null;
  }
  return raw;
}

/**
 * Oldest week offset that can be viewed: never before the launch week, and never more than
 * MAX_WEEKS_BACK. Without a launch week only the current week is shown.
 */
function minWeekOffset(nowMs, tz) {
  const launch = launchWeek();
  if (!launch) return 0;
  const currentKey = weekWindow(nowMs, 0, tz).weekKey;
  const weeksSinceLaunch = Math.round(
    (Date.parse(`${currentKey}T00:00:00Z`) - Date.parse(`${launch}T00:00:00Z`)) / (7 * 86400000)
  );
  return -Math.min(MAX_WEEKS_BACK, Math.max(0, weeksSinceLaunch));
}

const snapshots = new Map();
const inflight = new Map();

/**
 * Builds a week's snapshot straight from smx.573.no, bypassing the cache.
 * @param {string} weekKey the week's Monday as YYYY-MM-DD
 */
function buildSnapshotForWeek(weekKey) {
  const nowMs = Date.now();
  const tz = timeZone();
  const currentKey = weekWindow(nowMs, 0, tz).weekKey;
  const weekOffset = Math.round(
    (Date.parse(`${weekKey}T00:00:00Z`) - Date.parse(`${currentKey}T00:00:00Z`)) / (7 * 86400000)
  );
  return buildSnapshot(windowForWeekKey(weekKey, tz), weekOffset, nowMs);
}

function refresh(weekOffset, weekKey, nowMs) {
  if (inflight.has(weekKey)) return inflight.get(weekKey);
  const promise = buildSnapshot(windowForWeekKey(weekKey, timeZone()), weekOffset, nowMs)
    .then((snapshot) => {
      const ttl = weekOffset === 0 ? refreshTtlMs() : PAST_WEEK_TTL_MS;
      snapshots.set(weekKey, { snapshot, expiresAt: Date.now() + ttl });
      return snapshot;
    })
    .finally(() => inflight.delete(weekKey));
  inflight.set(weekKey, promise);
  return promise;
}

/**
 * @param {{ weekOffset?: number }} [opts]
 */
async function getWeeklyChallenge({ weekOffset = 0 } = {}) {
  const nowMs = Date.now();
  const tz = timeZone();
  const minOffset = minWeekOffset(nowMs, tz);

  const offset = Number(weekOffset);
  if (!Number.isInteger(offset) || offset > 0) {
    throw new WeeklyChallengeError('week must be a whole number, 0 or below.');
  }
  if (offset < minOffset) {
    const launch = launchWeek();
    const requestedKey = weekWindow(nowMs, offset, tz).weekKey;
    let message;
    if (!launch) message = 'Only the current week is available.';
    else if (requestedKey < launch) message = `The weekly challenge started the week of ${launch}.`;
    else message = `Only the last ${MAX_WEEKS_BACK} weeks can be viewed.`;
    throw new WeeklyChallengeError(message);
  }

  const { weekKey } = weekWindow(nowMs, offset, tz);

  const oldestKey = weekWindow(nowMs, -MAX_WEEKS_BACK, tz).weekKey;
  for (const key of snapshots.keys()) {
    if (key < oldestKey) snapshots.delete(key);
  }

  const cached = snapshots.get(weekKey);
  let snapshot;
  if (!cached) {
    snapshot = await refresh(offset, weekKey, nowMs);
  } else {
    snapshot = cached.snapshot;
    if (Date.now() > cached.expiresAt) {
      refresh(offset, weekKey, nowMs).catch((err) =>
        console.error('weeklyChallenge background refresh failed:', err)
      );
    }
  }
  return {
    ...snapshot,
    weekOffset: offset,
    isCurrent: offset === 0,
    minWeekOffset: minOffset,
  };
}

module.exports = {
  WeeklyChallengeError,
  MAX_WEEKS_BACK,
  DIFFICULTIES,
  timeZone,
  addDays,
  isWeekKey,
  launchWeek,
  weekWindow,
  windowForWeekKey,
  levelBuckets,
  rankBy,
  drawWeek,
  buildSnapshotForWeek,
  getWeeklyChallenge,
};

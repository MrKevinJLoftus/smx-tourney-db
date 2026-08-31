const statmaniaxClient = require('./statmaniaxClient');

/**
 * @typedef {object} NormalizedScore
 * @property {string} songChartId
 * @property {string} title
 * @property {string} artist
 * @property {number} level
 * @property {number} score
 * @property {number | null} gameSongId
 * @property {number | null} difficultyId
 */

/**
 * @typedef {object} ScoutPlayer
 * @property {number} id
 * @property {string} username
 */

/**
 * @typedef {object} ChartComparison
 * @property {string} songChartId
 * @property {string} title
 * @property {string} artist
 * @property {number} level
 * @property {number | null} gameSongId
 * @property {number | null} difficultyId
 * @property {number | null} yourScore
 * @property {{ id: number, username: string, score: number | null }[]} opponentScores
 * @property {number} bestOpponentScore
 * @property {number | null} delta
 * @property {boolean} youUnplayed
 * @property {boolean} opponentsUnplayed
 */

const MAX_RESULTS = 50;
const MAX_OPPONENTS = 8;

/**
 * @param {number | undefined | null} value
 * @returns {number | null}
 */
function parseOptionalLevel(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {NormalizedScore} score
 * @param {number | null} levelMin
 * @param {number | null} levelMax
 */
function passesLevelFilter(score, levelMin, levelMax) {
  if (levelMin != null && score.level < levelMin) return false;
  if (levelMax != null && score.level > levelMax) return false;
  return true;
}

/**
 * @param {Map<string, NormalizedScore>} scoreMap
 * @param {number | null} levelMin
 * @param {number | null} levelMax
 */
function filterScoreMap(scoreMap, levelMin, levelMax) {
  const filtered = new Map();
  for (const [key, score] of scoreMap.entries()) {
    if (passesLevelFilter(score, levelMin, levelMax)) {
      filtered.set(key, score);
    }
  }
  return filtered;
}

/**
 * @param {{
 *   youId: number,
 *   opponentIds: number[],
 *   mode?: string,
 *   levelMin?: number | null,
 *   levelMax?: number | null,
 * }} input
 */
async function comparePlayers(input) {
  const youId = Number(input.youId);
  const opponentIds = [...new Set((input.opponentIds || []).map((id) => Number(id)))].filter(
    (id) => Number.isFinite(id) && id > 0
  );

  if (!Number.isFinite(youId) || youId <= 0) {
    const err = new Error('youId must be a positive number.');
    err.statusCode = 400;
    throw err;
  }

  if (!opponentIds.length) {
    const err = new Error('At least one opponent is required.');
    err.statusCode = 400;
    throw err;
  }

  if (opponentIds.length > MAX_OPPONENTS) {
    const err = new Error(`At most ${MAX_OPPONENTS} opponents are allowed.`);
    err.statusCode = 400;
    throw err;
  }

  if (opponentIds.some((id) => id === youId)) {
    const err = new Error('You cannot list yourself as an opponent.');
    err.statusCode = 400;
    throw err;
  }

  const mode = statmaniaxClient.normalizeMode(input.mode);
  if (input.mode != null && String(input.mode).trim() && !statmaniaxClient.isValidMode(input.mode)) {
    const err = new Error('Invalid mode.');
    err.statusCode = 400;
    throw err;
  }

  const levelMin = parseOptionalLevel(input.levelMin);
  const levelMax = parseOptionalLevel(input.levelMax);
  if (levelMin != null && levelMax != null && levelMin > levelMax) {
    const err = new Error('levelMin cannot be greater than levelMax.');
    err.statusCode = 400;
    throw err;
  }

  const allIds = [youId, ...opponentIds];
  const profileResults = await Promise.all(
    allIds.map((id) => statmaniaxClient.getUserById(id))
  );

  if (!profileResults[0]) {
    const err = new Error('Could not load your StatManiaX profile.');
    err.statusCode = 404;
    throw err;
  }

  const players = /** @type {ScoutPlayer[]} */ (
    profileResults.map((p, i) => {
      if (!p) {
        const err = new Error(`Could not load StatManiaX profile for player id ${allIds[i]}.`);
        err.statusCode = 404;
        throw err;
      }
      return p;
    })
  );

  const you = players[0];
  const opponents = players.slice(1);

  const scoreMaps = await Promise.all(
    allIds.map((id) => statmaniaxClient.getUserHighscoresByMode(id, mode))
  );
  const youScores = filterScoreMap(scoreMaps[0], levelMin, levelMax);
  const opponentScoreMaps = scoreMaps.slice(1).map((m) => filterScoreMap(m, levelMin, levelMax));

  const chartIds = new Set();
  for (const map of [youScores, ...opponentScoreMaps]) {
    for (const id of map.keys()) chartIds.add(id);
  }

  /** @type {ChartComparison[]} */
  const comparisons = [];

  for (const songChartId of chartIds) {
    const yourEntry = youScores.get(songChartId) || null;
    const meta =
      yourEntry ||
      opponentScoreMaps.map((m) => m.get(songChartId)).find(Boolean) ||
      null;
    if (!meta) continue;

    const opponentScores = opponents.map((opp, idx) => {
      const entry = opponentScoreMaps[idx].get(songChartId);
      return {
        id: opp.id,
        username: opp.username,
        score: entry ? entry.score : null,
      };
    });

    const playedOpponentScores = opponentScores
      .map((o) => o.score)
      .filter((s) => s != null);
    const bestOpponentScore = playedOpponentScores.length
      ? Math.max(...playedOpponentScores)
      : 0;

    const yourScore = yourEntry ? yourEntry.score : null;
    const delta = yourScore != null ? yourScore - bestOpponentScore : null;

    comparisons.push({
      songChartId,
      title: meta.title,
      artist: meta.artist,
      level: meta.level,
      gameSongId: meta.gameSongId,
      difficultyId: meta.difficultyId,
      yourScore,
      opponentScores,
      bestOpponentScore,
      delta,
      youUnplayed: yourScore == null,
      opponentsUnplayed: playedOpponentScores.length === 0,
    });
  }

  const pocketPicks = comparisons
    .filter((c) => c.yourScore != null && c.delta != null && c.delta > 0)
    .sort((a, b) => {
      if (b.delta !== a.delta) return b.delta - a.delta;
      return (b.yourScore || 0) - (a.yourScore || 0);
    })
    .slice(0, MAX_RESULTS);

  const closestMatchups =
    pocketPicks.length > 0
      ? []
      : comparisons
          .filter((c) => c.yourScore != null && c.delta != null && c.delta <= 0)
          .sort((a, b) => {
            if (b.delta !== a.delta) return b.delta - a.delta;
            return (b.yourScore || 0) - (a.yourScore || 0);
          })
          .slice(0, MAX_RESULTS);

  const pocketPickMode = pocketPicks.length > 0 ? 'wins' : 'fallback';

  const vetos = comparisons
    .filter((c) => c.bestOpponentScore > (c.yourScore ?? 0))
    .sort((a, b) => {
      const deltaA = a.delta ?? -Infinity;
      const deltaB = b.delta ?? -Infinity;
      if (deltaA !== deltaB) return deltaA - deltaB;
      return b.bestOpponentScore - a.bestOpponentScore;
    })
    .slice(0, MAX_RESULTS);

  return {
    mode,
    levelMin,
    levelMax,
    players,
    you,
    opponents,
    pocketPicks,
    closestMatchups,
    pocketPickMode,
    vetos,
    chartCount: comparisons.length,
  };
}

module.exports = {
  comparePlayers,
  MAX_OPPONENTS,
};

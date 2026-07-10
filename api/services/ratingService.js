const glicko2 = require('./glicko2');

const PROVISIONAL_RD_THRESHOLD = 150;
const PROVISIONAL_MATCHES_THRESHOLD = 5;
const RATING_TIE_EPSILON = 0.5;
const INSERT_BATCH_SIZE = 200;

function getDbDependencies() {
  return {
    dbconn: require('../database/connector'),
    queries: require('../queries/seed'),
  };
}

/**
 * Group chronological match rows by event_id (rating period).
 * @param {Array} rows
 * @returns {Array<{ eventId: number, matches: Array }>}
 */
function groupMatchesByEvent(rows) {
  const periods = [];
  const periodByEvent = new Map();

  for (const row of rows || []) {
    const eventId = Number(row.event_id);
    if (!periodByEvent.has(eventId)) {
      const period = { eventId, matches: [] };
      periodByEvent.set(eventId, period);
      periods.push(period);
    }
    periodByEvent.get(eventId).matches.push(row);
  }

  return periods;
}

/**
 * Replay all 1v1 matches grouped by event and compute Glicko-2 ratings.
 * @param {Array} matchRows
 * @returns {Map<number, { rating: number, rd: number, volatility: number, matchesCounted: number }>}
 */
function computeRatingsFromMatches(matchRows) {
  const ratings = new Map();
  const matchSnapshots = [];
  const periods = groupMatchesByEvent(matchRows);

  for (const period of periods) {
    // Pre-period RD increase for all players with existing ratings.
    for (const [playerId, state] of ratings.entries()) {
      const updated = glicko2.applyPrePeriodRdIncrease(state);
      ratings.set(playerId, { ...state, ...updated });
    }

    const opponentsByPlayer = new Map();

    for (const match of period.matches) {
      const player1Id = Number(match.player1_id);
      const player2Id = Number(match.player2_id);
      const winnerId = Number(match.winner_id);

      if (!opponentsByPlayer.has(player1Id)) opponentsByPlayer.set(player1Id, []);
      if (!opponentsByPlayer.has(player2Id)) opponentsByPlayer.set(player2Id, []);

      const player1Score = winnerId === player1Id ? 1 : 0;
      const player2Score = winnerId === player2Id ? 1 : 0;

      opponentsByPlayer.get(player1Id).push({ opponentId: player2Id, score: player1Score });
      opponentsByPlayer.get(player2Id).push({ opponentId: player1Id, score: player2Score });
    }

    if (opponentsByPlayer.size === 0) {
      continue;
    }

    for (const playerId of opponentsByPlayer.keys()) {
      if (!ratings.has(playerId)) {
        ratings.set(playerId, glicko2.createDefaultPlayer());
      }
    }

    const prePeriod = new Map();
    for (const playerId of opponentsByPlayer.keys()) {
      prePeriod.set(playerId, { ...ratings.get(playerId) });
    }

    for (const match of period.matches) {
      const player1Id = Number(match.player1_id);
      const player2Id = Number(match.player2_id);
      const player1State = prePeriod.get(player1Id) || glicko2.createDefaultPlayer();
      const player2State = prePeriod.get(player2Id) || glicko2.createDefaultPlayer();

      matchSnapshots.push({
        matchId: Number(match.match_id),
        playerId: player1Id,
        rating: Number(player1State.rating.toFixed(2)),
        deviation: Number(player1State.rd.toFixed(2)),
      });
      matchSnapshots.push({
        matchId: Number(match.match_id),
        playerId: player2Id,
        rating: Number(player2State.rating.toFixed(2)),
        deviation: Number(player2State.rd.toFixed(2)),
      });
    }

    for (const [playerId, opponents] of opponentsByPlayer.entries()) {
      const current = prePeriod.get(playerId);
      const glickoOpponents = opponents.map((opp) => {
        const oppState = prePeriod.get(opp.opponentId) || glicko2.createDefaultPlayer();
        return {
          mu: glicko2.toMu(oppState.rating),
          phi: glicko2.toPhi(oppState.rd),
          score: opp.score,
        };
      });

      const updated = glicko2.updatePlayer(current, glickoOpponents);
      ratings.set(playerId, {
        ...current,
        ...updated,
        matchesCounted: current.matchesCounted + opponents.length,
      });
    }
  }

  return { ratings, matchSnapshots };
}

function isProvisional(ratingRow) {
  return (
    Number(ratingRow.matchesCounted || 0) < PROVISIONAL_MATCHES_THRESHOLD ||
    Number(ratingRow.rd || ratingRow.deviation || 0) > PROVISIONAL_RD_THRESHOLD
  );
}

async function insertRatingsBatch(connection, entries) {
  const { dbconn } = getDbDependencies();
  if (!entries.length) return;

  for (let i = 0; i < entries.length; i += INSERT_BATCH_SIZE) {
    const batch = entries.slice(i, i + INSERT_BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const params = batch.flatMap(([playerId, rating, deviation, volatility, matchesCounted]) => [
      playerId,
      rating,
      deviation,
      volatility,
      matchesCounted,
    ]);

    await dbconn.executeMysqlQuery(
      `INSERT INTO player_rating (player_id, rating, deviation, volatility, matches_counted) VALUES ${placeholders}`,
      params,
      connection
    );
  }
}

async function insertMatchSnapshotsBatch(connection, entries) {
  const { dbconn, queries } = getDbDependencies();
  if (!entries.length) return;

  for (let i = 0; i < entries.length; i += INSERT_BATCH_SIZE) {
    const batch = entries.slice(i, i + INSERT_BATCH_SIZE);
    const params = batch.flatMap(({ matchId, playerId, rating, deviation }) => [
      matchId,
      playerId,
      rating,
      deviation,
    ]);
    await dbconn.executeMysqlQuery(
      queries.CREATE_MATCH_PLAYER_RATINGS_BATCH(batch.length),
      params,
      connection
    );
  }
}

/**
 * Rebuild all player ratings from 1v1 match history and persist to player_rating.
 * @returns {Promise<{ playersRated: number, matchesProcessed: number }>}
 */
async function rebuildRatings() {
  const { dbconn, queries } = getDbDependencies();
  const matchRows = await dbconn.executeMysqlQuery(queries.GET_CHRONOLOGICAL_1V1_MATCHES, []);
  const { ratings, matchSnapshots } = computeRatingsFromMatches(matchRows);
  const entries = Array.from(ratings.entries()).map(([playerId, state]) => [
    playerId,
    Number(state.rating.toFixed(2)),
    Number(state.rd.toFixed(2)),
    Number(state.volatility.toFixed(6)),
    state.matchesCounted,
  ]);

  await dbconn.withTransaction(async (connection) => {
    await dbconn.executeMysqlQuery(queries.DELETE_ALL_MATCH_PLAYER_RATINGS, [], connection);
    await dbconn.executeMysqlQuery(queries.DELETE_ALL_PLAYER_RATINGS, [], connection);
    await insertMatchSnapshotsBatch(connection, matchSnapshots);
    await insertRatingsBatch(connection, entries);
  });

  return {
    playersRated: entries.length,
    matchesProcessed: (matchRows || []).length,
  };
}

/**
 * Compare two players for seeding tiebreaks (excluding provisional; apply that last).
 * @returns {Promise<number>} negative if a ranks higher, positive if b ranks higher, 0 if tied
 */
async function comparePlayersForTiebreak(aId, bId, ratingA, ratingB) {
  const { dbconn, queries } = getDbDependencies();
  const ratingDiff = Number(ratingB.rating) - Number(ratingA.rating);
  if (Math.abs(ratingDiff) > RATING_TIE_EPSILON) {
    // Higher rating = better seed = sort earlier (negative return for a when a is stronger).
    return ratingDiff > 0 ? 1 : -1;
  }

  const h2hRows = await dbconn.executeMysqlQuery(queries.GET_HEAD_TO_HEAD_WINS, [
    aId,
    bId,
    bId,
    aId,
  ]);

  let aWins = 0;
  let bWins = 0;
  for (const row of h2hRows || []) {
    if (Number(row.winner_id) === aId) aWins = Number(row.win_count);
    if (Number(row.winner_id) === bId) bWins = Number(row.win_count);
  }

  if (aWins !== bWins) {
    return bWins - aWins;
  }

  const usernameCmp = String(ratingA.username || '').localeCompare(String(ratingB.username || ''));
  if (usernameCmp !== 0) {
    return usernameCmp;
  }

  return 0;
}

/**
 * Sort roster entries best-to-worst (seed 1 first).
 * Tiebreak chain: rating → head-to-head → username → provisional-last.
 * @param {Array} roster
 */
async function sortRosterForSeeding(roster) {
  const comparisonCache = new Map();
  const compareKey = (aId, bId) => `${Math.min(aId, bId)}:${Math.max(aId, bId)}`;

  const compareEntries = async (a, b) => {
    const loId = Math.min(a.playerId, b.playerId);
    const hiId = Math.max(a.playerId, b.playerId);
    const cacheKey = compareKey(a.playerId, b.playerId);

    if (!comparisonCache.has(cacheKey)) {
      const lo = loId === a.playerId ? a : b;
      const hi = hiId === a.playerId ? a : b;
      let result = await comparePlayersForTiebreak(
        lo.playerId,
        hi.playerId,
        { rating: lo.rating, matchesCounted: lo.matchesCounted, username: lo.username },
        { rating: hi.rating, matchesCounted: hi.matchesCounted, username: hi.username }
      );
      if (result === 0 && lo.provisional !== hi.provisional) {
        result = lo.provisional ? 1 : -1;
      }
      comparisonCache.set(cacheKey, result);
    }

    const stored = comparisonCache.get(cacheKey);
    return a.playerId === loId ? stored : -stored;
  };

  const sorted = [...roster];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const cmp = await compareEntries(sorted[i], sorted[j]);
      if (cmp > 0) {
        const tmp = sorted[i];
        sorted[i] = sorted[j];
        sorted[j] = tmp;
      }
    }
  }

  return sorted;
}

/**
 * Normalize and validate guest player inputs from the request body.
 * @param {Array} guestPlayers
 * @returns {Array<{ playerId: number, username: string, rating: number }>}
 */
function normalizeGuestPlayers(guestPlayers) {
  if (!Array.isArray(guestPlayers) || guestPlayers.length === 0) {
    return [];
  }

  const seenIds = new Set();
  const seenUsernames = new Set();
  const normalized = [];

  for (const guest of guestPlayers) {
    const playerId = Number(guest?.id);
    const username = String(guest?.username || '').trim();

    if (!Number.isFinite(playerId) || playerId >= 0) {
      const err = new Error('Each guest player must have a negative id.');
      err.statusCode = 400;
      throw err;
    }

    if (username.length < 2 || username.length > 64) {
      const err = new Error('Each guest player username must be between 2 and 64 characters.');
      err.statusCode = 400;
      throw err;
    }

    const usernameKey = username.toLowerCase();
    if (seenIds.has(playerId) || seenUsernames.has(usernameKey)) {
      const err = new Error('Guest players must have distinct ids and usernames.');
      err.statusCode = 400;
      throw err;
    }

    seenIds.add(playerId);
    seenUsernames.add(usernameKey);
    normalized.push({
      playerId,
      username,
      rating: glicko2.DEFAULT_RATING,
    });
  }

  return normalized;
}

/**
 * Generate a suggested seeding for a hypothetical roster.
 * @param {number[]} playerIds
 * @param {Array} guestPlayers
 */
async function generateSeeding(playerIds, guestPlayers = []) {
  const { dbconn, queries } = getDbDependencies();
  const uniqueIds = [...new Set((playerIds || []).map((id) => Number(id)).filter((id) => id > 0))];
  const guests = normalizeGuestPlayers(guestPlayers);

  if (uniqueIds.length < 1 && guests.length < 1) {
    const err = new Error('At least one distinct player is required.');
    err.statusCode = 400;
    throw err;
  }

  let trackedRoster = [];

  if (uniqueIds.length > 0) {
    const [ratingRows, playerRows] = await Promise.all([
      dbconn.executeMysqlQuery(queries.GET_PLAYER_RATINGS_BY_IDS, [uniqueIds]),
      dbconn.executeMysqlQuery(queries.GET_PLAYERS_BY_IDS, [uniqueIds]),
    ]);

    const usernameById = new Map(
      (playerRows || []).map((row) => [Number(row.player_id), row.username])
    );

    if (usernameById.size !== uniqueIds.length) {
      const err = new Error('One or more player IDs were not found.');
      err.statusCode = 404;
      throw err;
    }

    const ratingById = new Map(
      (ratingRows || []).map((row) => [
        Number(row.player_id),
        {
          rating: Number(row.rating),
          rd: Number(row.deviation),
          volatility: Number(row.volatility),
          matchesCounted: Number(row.matches_counted),
          username: row.username,
        },
      ])
    );

    trackedRoster = uniqueIds.map((id) => {
      const existing = ratingById.get(id);
      if (existing) {
        return {
          playerId: id,
          username: existing.username || usernameById.get(id),
          rating: existing.rating,
          deviation: existing.rd,
          matchesCounted: existing.matchesCounted,
          provisional: isProvisional({ matchesCounted: existing.matchesCounted, rd: existing.rd }),
        };
      }

      return {
        playerId: id,
        username: usernameById.get(id),
        rating: glicko2.DEFAULT_RATING,
        deviation: glicko2.DEFAULT_RD,
        matchesCounted: 0,
        provisional: true,
      };
    });
  }

  if (guests.length > 0 && trackedRoster.length > 0) {
    const trackedUsernameKeys = new Set(
      trackedRoster.map((entry) => String(entry.username || '').trim().toLowerCase())
    );

    for (const guest of guests) {
      const guestUsernameKey = guest.username.trim().toLowerCase();
      if (trackedUsernameKeys.has(guestUsernameKey)) {
        const err = new Error('Guest usernames must not match tracked player usernames on the roster.');
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const guestRoster = guests.map((guest) => ({
    playerId: guest.playerId,
    username: guest.username,
    rating: guest.rating,
    deviation: glicko2.DEFAULT_RD,
    matchesCounted: 0,
    provisional: true,
  }));

  const roster = [...trackedRoster, ...guestRoster];
  const sorted = await sortRosterForSeeding(roster);

  const seeding = sorted.map((entry, index) => ({
    seed: index + 1,
    player: {
      id: entry.playerId,
      username: entry.username,
      isGuest: entry.playerId < 0,
    },
    rating: Math.round(entry.rating * 100) / 100,
    deviation: Math.round(entry.deviation * 100) / 100,
    matchesCounted: entry.matchesCounted,
    provisional: entry.provisional,
  }));

  return {
    playerCount: seeding.length,
    seeding,
    method: 'glicko-2',
    tiebreak: 'rating, head-to-head, username, provisional-last',
  };
}

module.exports = {
  rebuildRatings,
  generateSeeding,
  computeRatingsFromMatches,
  isProvisional,
  comparePlayersForTiebreak,
  sortRosterForSeeding,
};

/**
 * Fire-and-forget safe rebuild used after match imports.
 * @param {string} context
 * @returns {Promise<{ playersRated: number, matchesProcessed: number } | null>}
 */
module.exports.rebuildRatingsAfterMatchImport = async function rebuildRatingsAfterMatchImport(context) {
  try {
    const summary = await rebuildRatings();
    console.log(`[${context}] Player ratings rebuilt:`, summary);
    return summary;
  } catch (error) {
    console.error(`[${context}] Failed to rebuild player ratings:`, error);
    return null;
  }
};

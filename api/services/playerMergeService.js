const dbconn = require('../database/connector');
const queries = require('../queries/player');
const ratingService = require('./ratingService');

class PlayerMergeError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'PlayerMergeError';
    this.statusCode = statusCode;
  }
}

function parsePlayerId(value) {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    return null;
  }
  return id;
}

async function getPlayerRow(playerId, connection) {
  const rows = await dbconn.executeMysqlQuery(
    queries.GET_PLAYER_BASIC_BY_ID,
    [playerId],
    connection
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

async function getEventsForPlayer(playerId, connection) {
  return dbconn.executeMysqlQuery(
    queries.GET_ALL_EVENTS_BY_PLAYER,
    [playerId],
    connection
  );
}

async function getOverlappingEventIds(keepId, absorbId, connection) {
  const rows = await dbconn.executeMysqlQuery(
    queries.GET_OVERLAPPING_EVENT_IDS,
    [keepId, absorbId],
    connection
  );
  return (rows || []).map((row) => Number(row.event_id));
}

/**
 * Load both players, their event histories, and overlap status for admin preview.
 * @param {number|string} keepId
 * @param {number|string} absorbId
 */
async function previewMerge(keepId, absorbId) {
  const keepPlayerId = parsePlayerId(keepId);
  const absorbPlayerId = parsePlayerId(absorbId);

  if (!keepPlayerId || !absorbPlayerId) {
    throw new PlayerMergeError('keepId and absorbId must be positive integers.');
  }
  if (keepPlayerId === absorbPlayerId) {
    throw new PlayerMergeError('Keep and Absorb players must be different.');
  }

  const [keep, absorb] = await Promise.all([
    getPlayerRow(keepPlayerId),
    getPlayerRow(absorbPlayerId),
  ]);

  if (!keep) {
    throw new PlayerMergeError('Keep player not found.', 404);
  }
  if (!absorb) {
    throw new PlayerMergeError('Absorb player not found.', 404);
  }

  const [keepEvents, absorbEvents, overlappingEventIds] = await Promise.all([
    getEventsForPlayer(keepPlayerId),
    getEventsForPlayer(absorbPlayerId),
    getOverlappingEventIds(keepPlayerId, absorbPlayerId),
  ]);

  return {
    keep,
    absorb,
    keepEvents: keepEvents || [],
    absorbEvents: absorbEvents || [],
    overlappingEventIds,
    canMerge: overlappingEventIds.length === 0,
  };
}

/**
 * Remap Absorb history onto Keep, optionally rename Keep, delete Absorb, rebuild ratings.
 * @param {{ keepId: number|string, absorbId: number|string, username?: string }} params
 */
async function mergePlayers({ keepId, absorbId, username }) {
  const keepPlayerId = parsePlayerId(keepId);
  const absorbPlayerId = parsePlayerId(absorbId);

  if (!keepPlayerId || !absorbPlayerId) {
    throw new PlayerMergeError('keepId and absorbId must be positive integers.');
  }
  if (keepPlayerId === absorbPlayerId) {
    throw new PlayerMergeError('Keep and Absorb players must be different.');
  }

  const desiredUsername =
    username !== undefined && username !== null
      ? String(username).trim()
      : null;

  if (desiredUsername !== null && (desiredUsername.length < 1 || desiredUsername.length > 50)) {
    throw new PlayerMergeError('Username must be between 1 and 50 characters.');
  }

  const mergeResult = await dbconn.withTransaction(async (connection) => {
    const keep = await getPlayerRow(keepPlayerId, connection);
    const absorb = await getPlayerRow(absorbPlayerId, connection);

    if (!keep) {
      throw new PlayerMergeError('Keep player not found.', 404);
    }
    if (!absorb) {
      throw new PlayerMergeError('Absorb player not found.', 404);
    }

    const overlappingEventIds = await getOverlappingEventIds(
      keepPlayerId,
      absorbPlayerId,
      connection
    );
    if (overlappingEventIds.length > 0) {
      throw new PlayerMergeError(
        `Cannot merge: players share ${overlappingEventIds.length} event(s).`
      );
    }

    if (desiredUsername !== null && desiredUsername !== keep.username) {
      const existing = await dbconn.executeMysqlQuery(
        queries.GET_PLAYER_BY_USERNAME,
        [desiredUsername],
        connection
      );
      const conflict = (existing || []).find(
        (row) => Number(row.id) !== keepPlayerId && Number(row.id) !== absorbPlayerId
      );
      if (conflict) {
        throw new PlayerMergeError(
          `Username "${desiredUsername}" is already used by another player.`
        );
      }
    }

    // Remap foreign keys from Absorb → Keep before deleting Absorb.
    await dbconn.executeMysqlQuery(
      'UPDATE event_x_player SET player_id = ? WHERE player_id = ?',
      [keepPlayerId, absorbPlayerId],
      connection
    );
    await dbconn.executeMysqlQuery(
      'UPDATE `match` SET winner_id = ? WHERE winner_id = ?',
      [keepPlayerId, absorbPlayerId],
      connection
    );
    await dbconn.executeMysqlQuery(
      'UPDATE match_x_player_x_song SET player_id = ? WHERE player_id = ?',
      [keepPlayerId, absorbPlayerId],
      connection
    );
    await dbconn.executeMysqlQuery(
      'UPDATE match_x_player_stats SET player_id = ? WHERE player_id = ?',
      [keepPlayerId, absorbPlayerId],
      connection
    );
    await dbconn.executeMysqlQuery(
      'UPDATE match_player_rating SET player_id = ? WHERE player_id = ?',
      [keepPlayerId, absorbPlayerId],
      connection
    );

    if (desiredUsername !== null && desiredUsername !== keep.username) {
      await dbconn.executeMysqlQuery(
        queries.UPDATE_PLAYER_USERNAME,
        [desiredUsername, keepPlayerId],
        connection
      );
    }

    await dbconn.executeMysqlQuery(
      queries.DELETE_PLAYER,
      [absorbPlayerId],
      connection
    );

    const survivor = await getPlayerRow(keepPlayerId, connection);
    return {
      player: survivor,
      absorbedPlayerId: absorbPlayerId,
      absorbedUsername: absorb.username,
    };
  });

  const ratingsRebuild = await ratingService.rebuildRatingsAfterMatchImport('playerMerge');

  return {
    ...mergeResult,
    ratingsRebuild,
  };
}

module.exports = {
  PlayerMergeError,
  previewMerge,
  mergePlayers,
};

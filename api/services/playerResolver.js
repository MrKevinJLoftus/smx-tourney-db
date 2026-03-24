const dbconn = require('../database/connector');
const playerQueries = require('../queries/player');

/**
 * Cleans a gamertag by removing clan tags (splits on "|" and takes part after pipe)
 * @param {string} gamertag
 * @returns {string}
 */
const cleanGamertag = (gamertag) => {
  if (!gamertag || typeof gamertag !== 'string') {
    return '';
  }

  const trimmed = gamertag.trim();
  if (trimmed === '') {
    return '';
  }

  const parts = trimmed.split('|');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }

  return trimmed;
};

/**
 * @param {string} gamertag
 * @returns {string}
 */
const normalizeGamertag = (gamertag) => {
  if (!gamertag || typeof gamertag !== 'string') {
    return '';
  }
  return gamertag.toLowerCase().trim();
};

/**
 * @param {string} gamertag
 * @param {number|null} createdBy
 * @param {Map<string, number>} [playerCache] normalized gamertag -> player id
 * @param {import('mysql').Connection} [connection] optional transaction connection
 * @returns {Promise<{ playerId: number, created: boolean }>}
 */
const resolvePlayer = async (gamertag, createdBy, playerCache, connection) => {
  if (!gamertag || gamertag.trim() === '') {
    throw new Error('Gamertag is required');
  }

  const cleanedGamertag = cleanGamertag(gamertag);
  if (cleanedGamertag === '') {
    throw new Error('Gamertag is required after cleaning');
  }

  const normalizedGamertag = normalizeGamertag(cleanedGamertag);

  if (playerCache && playerCache.has(normalizedGamertag)) {
    return { playerId: playerCache.get(normalizedGamertag), created: false };
  }

  const players = await dbconn.executeMysqlQuery(
    'SELECT * FROM player WHERE LOWER(username) = LOWER(?)',
    [cleanedGamertag],
    connection
  );

  if (players && players.length > 0) {
    const playerId = players[0].id;
    if (playerCache) {
      playerCache.set(normalizedGamertag, playerId);
    }
    return { playerId, created: false };
  }

  try {
    const result = await dbconn.executeMysqlQuery(
      playerQueries.CREATE_PLAYER,
      [cleanedGamertag, null, createdBy],
      connection
    );
    const playerId = result.insertId;
    if (playerCache) {
      playerCache.set(normalizedGamertag, playerId);
    }
    return { playerId, created: true };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('Duplicate entry')) {
      const retryPlayers = await dbconn.executeMysqlQuery(
        'SELECT * FROM player WHERE LOWER(username) = LOWER(?)',
        [cleanedGamertag],
        connection
      );
      if (retryPlayers && retryPlayers.length > 0) {
        const playerId = retryPlayers[0].id;
        if (playerCache) {
          playerCache.set(normalizedGamertag, playerId);
        }
        return { playerId, created: false };
      }
    }
    throw error;
  }
};

/**
 * Fills `playerCache` with all existing players (normalized username → id).
 * @param {Map<string, number>} playerCache
 * @param {import('mysql').Connection} [connection]
 */
async function prePopulatePlayerCache(playerCache, connection) {
  try {
    const existingPlayers = await dbconn.executeMysqlQuery(
      'SELECT id, username FROM player',
      [],
      connection
    );
    existingPlayers.forEach((player) => {
      if (player.username) {
        const cleaned = cleanGamertag(player.username);
        const normalized = normalizeGamertag(cleaned);
        playerCache.set(normalized, player.id);
      }
    });
    console.log(`Pre-populated player cache with ${playerCache.size} existing players`);
  } catch (error) {
    console.error('Error pre-populating player cache:', error);
  }
}

module.exports = {
  cleanGamertag,
  normalizeGamertag,
  resolvePlayer,
  prePopulatePlayerCache,
};

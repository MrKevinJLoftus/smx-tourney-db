const dbconn = require('../database/connector');
const queries = require('../queries/player');
const ratingService = require('../services/ratingService');

async function fetchMatchIdsByPlayerId(playerId) {
  const rows = await dbconn.executeMysqlQuery(
    'SELECT DISTINCT match_id FROM match_x_player_x_song WHERE player_id = ?',
    [playerId]
  );
  return (rows || [])
    .map((r) => r.match_id)
    .filter((id) => id !== null && id !== undefined);
}

async function deleteMatchesByIds(matchIds) {
  if (!matchIds || matchIds.length === 0) return 0;
  const placeholders = matchIds.map(() => '?').join(',');
  const result = await dbconn.executeMysqlQuery(
    `DELETE FROM \`match\` WHERE id IN (${placeholders})`,
    matchIds
  );
  return result?.affectedRows || 0;
}

exports.getAllPlayers = async (req, res) => {
  console.log('Fetching all players');
  const players = await dbconn.executeMysqlQuery(queries.GET_ALL_PLAYERS, []);
  res.status(200).json(players);
};

exports.getPlayerById = async (req, res) => {
  const playerId = req.params.id;
  console.log(`Fetching player with id: ${playerId}`);
  const players = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_ID, [playerId]);
  if (!players || players.length < 1) {
    return res.status(404).json({ message: 'Player not found' });
  }
  const player = players[0];
  res.status(200).json({
    ...player,
    rating: player.glicko_rating == null
      ? null
      : {
          rating: Number(player.glicko_rating),
          deviation: Number(player.glicko_deviation),
          matchesCounted: Number(player.glicko_matches_counted || 0),
          provisional: ratingService.isProvisional({
            matchesCounted: player.glicko_matches_counted,
            deviation: player.glicko_deviation,
          }),
          rank: player.glicko_rank == null ? null : Number(player.glicko_rank),
        },
  });
};

exports.getPlayerByGamertag = async (req, res) => {
  const gamertag = req.params.gamertag;
  console.log(`Fetching player with gamertag: ${gamertag}`);
  const players = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_USERNAME, [gamertag]);
  if (!players || players.length < 1) {
    return res.status(404).json({ message: 'Player not found' });
  }
  res.status(200).json(players[0]);
};

exports.searchPlayers = async (req, res) => {
  const query = req.query.q || req.query.query || '';
  console.log(`Searching players with query: ${query}`);
  if (!query || query.trim().length === 0) {
    // If no query, return all players (limited)
    const players = await dbconn.executeMysqlQuery(queries.GET_ALL_PLAYERS, []);
    res.status(200).json(players.slice(0, 50)); // Limit to 50 for performance
    return;
  }
  const searchTerm = `%${query.trim()}%`;
  const players = await dbconn.executeMysqlQuery(queries.SEARCH_PLAYERS, [searchTerm]);
  res.status(200).json(players);
};

exports.createPlayer = async (req, res) => {
  const { gamertag, pronouns, user_id } = req.body;
  console.log(`Creating new player: ${gamertag}`);
  if (!gamertag) {
    return res.status(400).json({ message: 'Gamertag is required' });
  }
  // Check if player with this gamertag already exists
  const existing = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_USERNAME, [gamertag]);
  if (existing && existing.length > 0) {
    return res.status(409).json({ message: 'Player with this gamertag already exists', player: existing[0] });
  }
  const result = await dbconn.executeMysqlQuery(queries.CREATE_PLAYER, [gamertag, pronouns || null, user_id || null]);
  const newPlayer = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_ID, [result.insertId]);
  res.status(201).json(newPlayer[0]);
};

exports.getPlayersByEvent = async (req, res) => {
  const eventId = req.params.eventId;
  console.log(`Fetching players for event: ${eventId}`);
  const players = await dbconn.executeMysqlQuery(queries.GET_PLAYERS_BY_EVENT, [eventId]);
  res.status(200).json(players);
};

exports.getEventsByPlayer = async (req, res) => {
  const playerId = req.params.id;
  console.log(`Fetching events for player: ${playerId}`);
  const events = await dbconn.executeMysqlQuery(queries.GET_EVENTS_BY_PLAYER, [playerId]);
  res.status(200).json(events);
};

exports.getRivalsForPlayer = async (req, res) => {
  const playerId = req.params.id;
  console.log(`Fetching top rivals for player: ${playerId}`);
  const rows = await dbconn.executeMysqlQuery(queries.GET_TOP_10_RIVALS_FOR_PLAYER, [
    playerId,
    playerId
  ]);
  const rivals = (rows || []).map((r) => ({
    player1: { id: r.player1_id, username: r.player1_username },
    player2: { id: r.player2_id, username: r.player2_username },
    matchCount: Number(r.match_count || 0)
  }));
  res.status(200).json(rivals);
};

exports.getRatingsByIds = async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (ids.length === 0) {
    return res.status(200).json([]);
  }

  const rows = await dbconn.executeMysqlQuery(queries.GET_PLAYER_RATINGS_BY_IDS, [ids]);
  res.status(200).json((rows || []).map((row) => ({
    playerId: Number(row.player_id),
    username: row.username,
    rating: Number(row.rating),
    deviation: Number(row.deviation),
    matchesCounted: Number(row.matches_counted || 0),
    provisional: ratingService.isProvisional({
      matchesCounted: row.matches_counted,
      deviation: row.deviation,
    }),
    rank: row.glicko_rank == null ? null : Number(row.glicko_rank),
  })));
};

exports.updatePlayer = async (req, res) => {
  const playerId = req.params.id;
  const { gamertag, pronouns, user_id } = req.body;
  console.log(`Updating player with id: ${playerId}`);
  const player = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_ID, [playerId]);
  if (!player || player.length < 1) {
    return res.status(404).json({ message: 'Player not found' });
  }
  await dbconn.executeMysqlQuery(queries.UPDATE_PLAYER, [gamertag || player[0].username, pronouns !== undefined ? pronouns : player[0].pronouns, user_id !== undefined ? user_id : player[0].created_by, playerId]);
  const updatedPlayer = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_ID, [playerId]);
  res.status(200).json(updatedPlayer[0]);
};

/**
 * Admin: hide (or optionally delete) all matches involving a player.
 * Body: { hidden: boolean, delete?: boolean, deleteEventParticipation?: boolean }
 */
exports.setPlayerMatchDataHidden = async (req, res) => {
  const playerId = req.params.id;
  const hidden = !!req.body?.hidden;
  const shouldDelete = !!req.body?.delete;
  const shouldDeleteEventParticipation = !!req.body?.deleteEventParticipation;
  console.log(`Admin set player ${playerId} hidden_matches=${hidden} delete=${shouldDelete}`);

  const players = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_ID, [playerId]);
  if (!players || players.length < 1) {
    return res.status(404).json({ message: 'Player not found' });
  }

  let deletedMatches = 0;
  let deletedEventParticipations = 0;
  if (shouldDelete) {
    const matchIds = await fetchMatchIdsByPlayerId(playerId);
    deletedMatches = await deleteMatchesByIds(matchIds);
  }
  if (shouldDeleteEventParticipation) {
    const result = await dbconn.executeMysqlQuery(
      'DELETE FROM event_x_player WHERE player_id = ?',
      [playerId]
    );
    deletedEventParticipations = result?.affectedRows || 0;
  }

  await dbconn.executeMysqlQuery(queries.UPDATE_PLAYER_HIDDEN_MATCHES, [hidden ? 1 : 0, playerId]);
  const updated = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_ID, [playerId]);

  res.status(200).json({
    player: updated[0],
    deletedMatches,
    deletedEventParticipations
  });
};


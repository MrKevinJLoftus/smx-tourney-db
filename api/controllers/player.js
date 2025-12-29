const dbconn = require('../database/connector');
const queries = require('../queries/player');

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
  res.status(200).json(players[0]);
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

exports.updatePlayer = async (req, res) => {
  const playerId = req.params.id;
  const { gamertag, pronouns, user_id } = req.body;
  console.log(`Updating player with id: ${playerId}`);
  const player = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_ID, [playerId]);
  if (!player || player.length < 1) {
    return res.status(404).json({ message: 'Player not found' });
  }
  await dbconn.executeMysqlQuery(queries.UPDATE_PLAYER, [gamertag || player[0].username, pronouns !== undefined ? pronouns : player[0].pronouns, user_id || player[0].created_by, playerId]);
  const updatedPlayer = await dbconn.executeMysqlQuery(queries.GET_PLAYER_BY_ID, [playerId]);
  res.status(200).json(updatedPlayer[0]);
};


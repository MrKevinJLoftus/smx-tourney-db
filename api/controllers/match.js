const dbconn = require('../database/connector');
const queries = require('../queries/match');

const transformMatchResult = (match) => {
  if (!match) return null;
  return {
    match_id: match.match_id,
    event_id: match.event_id,
    player1_id: match.player1_id,
    player2_id: match.player2_id,
    song_id: match.song_id,
    winner_id: match.winner_id,
    score1: match.score1,
    score2: match.score2,
    round: match.round,
    created_at: match.created_at,
    updated_at: match.updated_at,
    player1: match.p1_id ? { player_id: match.p1_id, gamertag: match.p1_gamertag } : null,
    player2: match.p2_id ? { player_id: match.p2_id, gamertag: match.p2_gamertag } : null,
    winner: match.w_id ? { player_id: match.w_id, gamertag: match.w_gamertag } : null,
    song: match.song_id ? { song_id: match.song_id, title: match.song_title, artist: match.song_artist } : null
  };
};

exports.getMatchesByEvent = async (req, res) => {
  const eventId = req.params.eventId;
  console.log(`Fetching matches for event: ${eventId}`);
  const matches = await dbconn.executeMysqlQuery(queries.GET_MATCHES_BY_EVENT, [eventId]);
  const transformedMatches = matches.map(transformMatchResult);
  res.status(200).json(transformedMatches);
};

exports.getMatchById = async (req, res) => {
  const matchId = req.params.id;
  console.log(`Fetching match with id: ${matchId}`);
  const matches = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  if (!matches || matches.length < 1) {
    return res.status(404).json({ message: 'Match not found' });
  }
  res.status(200).json(transformMatchResult(matches[0]));
};

exports.createMatch = async (req, res) => {
  const { event_id, player1_id, player2_id, song_id, winner_id, score1, score2, round } = req.body;
  console.log(`Creating new match for event: ${event_id}`);
  if (!event_id || !player1_id || !player2_id) {
    return res.status(400).json({ message: 'Event ID, Player 1 ID, and Player 2 ID are required' });
  }
  const result = await dbconn.executeMysqlQuery(queries.CREATE_MATCH, [
    event_id, player1_id, player2_id, song_id || null, winner_id || null, score1 || null, score2 || null, round || null
  ]);
  const newMatch = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [result.insertId]);
  res.status(201).json(transformMatchResult(newMatch[0]));
};

exports.updateMatch = async (req, res) => {
  const matchId = req.params.id;
  const { event_id, player1_id, player2_id, song_id, winner_id, score1, score2, round } = req.body;
  console.log(`Updating match with id: ${matchId}`);
  if (!event_id || !player1_id || !player2_id) {
    return res.status(400).json({ message: 'Event ID, Player 1 ID, and Player 2 ID are required' });
  }
  await dbconn.executeMysqlQuery(queries.UPDATE_MATCH, [
    event_id, player1_id, player2_id, song_id || null, winner_id || null, score1 || null, score2 || null, round || null, matchId
  ]);
  const updatedMatch = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  if (!updatedMatch || updatedMatch.length < 1) {
    return res.status(404).json({ message: 'Match not found' });
  }
  res.status(200).json(transformMatchResult(updatedMatch[0]));
};

exports.deleteMatch = async (req, res) => {
  const matchId = req.params.id;
  console.log(`Deleting match with id: ${matchId}`);
  const match = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  if (!match || match.length < 1) {
    return res.status(404).json({ message: 'Match not found' });
  }
  await dbconn.executeMysqlQuery(queries.DELETE_MATCH, [matchId]);
  res.status(200).json({ message: 'Match deleted successfully' });
};


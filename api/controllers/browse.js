const dbconn = require('../database/connector');
const queries = require('../queries/browse');
const ratingService = require('../services/ratingService');

function mapTopPlayersRows(rows) {
  return (rows || []).map(r => ({
    id: r.player_id,
    username: r.username,
    rating: Number(r.rating),
    deviation: Number(r.deviation),
    matchesCounted: Number(r.matches_counted || 0),
    provisional: ratingService.isProvisional({
      matchesCounted: r.matches_counted,
      deviation: r.deviation,
    }),
  }));
}

function mapLeaderboardRows(rows) {
  return mapTopPlayersRows(rows).map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}

exports.getTop5Lists = async (req, res) => {
  const [recentEventsRows, topPlayersAllRows, topPlayersEstablishedRows, rivalriesRows] = await Promise.all([
    dbconn.executeMysqlQuery(queries.GET_RECENT_EVENTS_WITH_WINNER, []),
    dbconn.executeMysqlQuery(queries.GET_TOP_10_PLAYERS_BY_RATING, []),
    dbconn.executeMysqlQuery(queries.GET_TOP_10_PLAYERS_BY_RATING_EXCLUDING_PROVISIONAL, []),
    dbconn.executeMysqlQuery(queries.GET_TOP_10_RIVALRIES_BY_MATCH_COUNT, [])
  ]);

  const recentEvents = (recentEventsRows || []).map(r => ({
    id: r.event_id,
    name: r.name,
    date: r.date,
    winner: r.winner_id
      ? { id: r.winner_id, username: r.winner_username }
      : null
  }));

  const topPlayersByRating = mapTopPlayersRows(topPlayersAllRows);
  const topPlayersByRatingEstablished = mapTopPlayersRows(topPlayersEstablishedRows);

  const topRivalries = (rivalriesRows || []).map(r => ({
    player1: { id: r.player1_id, username: r.player1_username },
    player2: { id: r.player2_id, username: r.player2_username },
    matchCount: Number(r.match_count || 0)
  }));

  res.status(200).json({
    recentEvents,
    topPlayersByRating,
    topPlayersByRatingEstablished,
    topRivalries
  });
};

exports.getLeaderboard = async (req, res) => {
  const includeProvisional = String(req.query.includeProvisional || 'true').toLowerCase() !== 'false';
  const rawQuery = String(req.query.q || '').trim();
  const searchTerm = rawQuery ? `%${rawQuery}%` : '';

  const rows = await dbconn.executeMysqlQuery(queries.GET_LEADERBOARD_PLAYERS_BY_RATING, [
    includeProvisional ? 1 : 0,
    searchTerm,
    searchTerm,
  ]);

  res.status(200).json({
    players: mapLeaderboardRows(rows),
  });
};

const dbconn = require('../database/connector');
const queries = require('../queries/browse');

exports.getTop5Lists = async (req, res) => {
  const [recentEventsRows, topPlayersRows, rivalriesRows] = await Promise.all([
    dbconn.executeMysqlQuery(queries.GET_TOP_5_RECENT_EVENTS_WITH_WINNER, []),
    dbconn.executeMysqlQuery(queries.GET_TOP_10_PLAYERS_BY_WIN_LOSS_RATIO, []),
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

  const topPlayersByWinLossRatio = (topPlayersRows || []).map(r => ({
    id: r.player_id,
    username: r.username,
    wins: Number(r.wins_total || 0),
    losses: Number(r.losses_total || 0),
    ratio: r.win_loss_ratio === null || r.win_loss_ratio === undefined ? null : Number(r.win_loss_ratio)
  }));

  const topRivalries = (rivalriesRows || []).map(r => ({
    player1: { id: r.player1_id, username: r.player1_username },
    player2: { id: r.player2_id, username: r.player2_username },
    matchCount: Number(r.match_count || 0)
  }));

  res.status(200).json({
    recentEvents,
    topPlayersByWinLossRatio,
    topRivalries
  });
};


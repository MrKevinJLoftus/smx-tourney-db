module.exports = {
  // 5 most recent events, plus winner based on event_x_player placement=1 (numeric).
  // If placement isn't numeric/consistent, winner will be null.
  GET_TOP_5_RECENT_EVENTS_WITH_WINNER: `
    SELECT
      e.id AS event_id,
      e.name,
      e.date,
      w.id AS winner_id,
      w.username AS winner_username
    FROM event e
    LEFT JOIN (
      SELECT
        ep.event_id,
        ep.player_id
      FROM event_x_player ep
      WHERE ep.placement IS NOT NULL
        AND TRIM(ep.placement) <> ''
        AND CAST(ep.placement AS UNSIGNED) = 1
    ) ep1 ON ep1.event_id = e.id
    LEFT JOIN player w ON w.id = ep1.player_id
    ORDER BY (e.date IS NULL) ASC, e.date DESC, e.id DESC
    LIMIT 5
  `,

  // Top 10 players by win/loss ratio counting MATCHES won/lost (not songs).
  // Only includes strictly 1v1 matches (exactly 2 players) with a non-null winner_id.
  // losses_total=0 is treated as "infinite" and sorted first, then by wins.
  GET_TOP_10_PLAYERS_BY_WIN_LOSS_RATIO: `
    SELECT
      p.id AS player_id,
      p.username,
      COUNT(DISTINCT CASE WHEN s.player_id = m.winner_id THEN m.id END) AS wins_total,
      COUNT(DISTINCT CASE WHEN s.player_id <> m.winner_id THEN m.id END) AS losses_total,
      COUNT(DISTINCT m.id) AS matches_total,
      CASE
        WHEN COUNT(DISTINCT CASE WHEN s.player_id <> m.winner_id THEN m.id END) = 0 THEN NULL
        ELSE (
          COUNT(DISTINCT CASE WHEN s.player_id = m.winner_id THEN m.id END)
          / COUNT(DISTINCT CASE WHEN s.player_id <> m.winner_id THEN m.id END)
        )
      END AS win_loss_ratio
    FROM player p
    INNER JOIN match_x_player_stats s ON s.player_id = p.id
    INNER JOIN \`match\` m ON m.id = s.match_id
    INNER JOIN (
      SELECT
        s2.match_id
      FROM match_x_player_stats s2
      GROUP BY s2.match_id
      HAVING COUNT(DISTINCT s2.player_id) = 2
    ) only_1v1 ON only_1v1.match_id = s.match_id
    WHERE m.winner_id IS NOT NULL
    GROUP BY p.id, p.username
    HAVING matches_total >= 10
    ORDER BY
      (losses_total = 0) DESC,
      (wins_total / NULLIF(losses_total, 0)) DESC,
      wins_total DESC,
      p.username ASC
    LIMIT 10
  `,

  // Top 10 rivalries = pairs of players with the most matches against each other.
  // Only counts matches that have exactly 2 distinct players in match_x_player_stats.
  GET_TOP_10_RIVALRIES_BY_MATCH_COUNT: `
    SELECT
      pairs.player1_id,
      p1.username AS player1_username,
      pairs.player2_id,
      p2.username AS player2_username,
      pairs.match_count
    FROM (
      SELECT
        mp.player1_id,
        mp.player2_id,
        COUNT(*) AS match_count
      FROM (
        SELECT
          s.match_id,
          MIN(s.player_id) AS player1_id,
          MAX(s.player_id) AS player2_id,
          COUNT(DISTINCT s.player_id) AS player_count
        FROM match_x_player_stats s
        GROUP BY s.match_id
        HAVING player_count = 2
      ) mp
      GROUP BY mp.player1_id, mp.player2_id
      ORDER BY match_count DESC, mp.player1_id ASC, mp.player2_id ASC
      LIMIT 10
    ) pairs
    INNER JOIN player p1 ON p1.id = pairs.player1_id
    INNER JOIN player p2 ON p2.id = pairs.player2_id
    ORDER BY pairs.match_count DESC, p1.username ASC, p2.username ASC
  `
};


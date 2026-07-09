module.exports = {
  // 5 most recent events, plus winner based on event_x_player placement=1 (numeric).
  // If placement isn't numeric/consistent, winner will be null.
  GET_RECENT_EVENTS_WITH_WINNER: `
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
    WHERE e.hidden = 0
    ORDER BY (e.date IS NULL) ASC, e.date DESC, e.id DESC
    LIMIT 10
  `,

  // Top 10 players by Glicko-2 rating from precomputed player_rating rows.
  GET_TOP_10_PLAYERS_BY_RATING: `
    SELECT
      p.id AS player_id,
      p.username,
      pr.rating,
      pr.deviation,
      pr.matches_counted
    FROM player_rating pr
    INNER JOIN player p ON p.id = pr.player_id
    WHERE p.hidden_matches = 0
    ORDER BY pr.rating DESC, p.username ASC
    LIMIT 10
  `,

  // Same as above but excludes provisional players (thresholds match ratingService.isProvisional).
  GET_TOP_10_PLAYERS_BY_RATING_EXCLUDING_PROVISIONAL: `
    SELECT
      p.id AS player_id,
      p.username,
      pr.rating,
      pr.deviation,
      pr.matches_counted
    FROM player_rating pr
    INNER JOIN player p ON p.id = pr.player_id
    WHERE p.hidden_matches = 0
      AND pr.matches_counted >= 5
      AND pr.deviation <= 150
    ORDER BY pr.rating DESC, p.username ASC
    LIMIT 10
  `,

  GET_LEADERBOARD_PLAYERS_BY_RATING: `
    SELECT
      p.id AS player_id,
      p.username,
      pr.rating,
      pr.deviation,
      pr.matches_counted,
      (
        SELECT COUNT(*) + 1
        FROM player_rating pr2
        INNER JOIN player p2 ON p2.id = pr2.player_id
        WHERE p2.hidden_matches = 0
          AND (? = 1 OR (pr2.matches_counted >= 5 AND pr2.deviation <= 150))
          AND (
            pr2.rating > pr.rating OR
            (pr2.rating = pr.rating AND p2.username < p.username)
          )
      ) AS leaderboard_rank
    FROM player_rating pr
    INNER JOIN player p ON p.id = pr.player_id
    WHERE p.hidden_matches = 0
      AND (? = 1 OR (pr.matches_counted >= 5 AND pr.deviation <= 150))
      AND (? = '' OR p.username LIKE ?)
    ORDER BY pr.rating DESC, p.username ASC
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
        INNER JOIN \`match\` m ON m.id = s.match_id
        INNER JOIN event e ON e.id = m.event_id AND e.hidden = 0
        WHERE NOT EXISTS (
          SELECT 1
          FROM match_x_player_x_song mx
          INNER JOIN player hp ON hp.id = mx.player_id
          WHERE mx.match_id = m.id
            AND hp.hidden_matches = 1
        )
        GROUP BY s.match_id
        HAVING player_count = 2
      ) mp
      GROUP BY mp.player1_id, mp.player2_id
      ORDER BY match_count DESC, mp.player1_id ASC, mp.player2_id ASC
      LIMIT 10
    ) pairs
    INNER JOIN player p1 ON p1.id = pairs.player1_id
    INNER JOIN player p2 ON p2.id = pairs.player2_id
    WHERE p1.hidden_matches = 0
      AND p2.hidden_matches = 0
    ORDER BY pairs.match_count DESC, p1.username ASC, p2.username ASC
  `
};


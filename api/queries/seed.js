module.exports = {
  // Chronological 1v1 matches with a decisive winner, excluding hidden events/players.
  GET_CHRONOLOGICAL_1V1_MATCHES: `
    SELECT
      m.id AS match_id,
      m.event_id,
      e.date AS event_date,
      mp.player1_id,
      mp.player2_id,
      m.winner_id
    FROM (
      SELECT
        s.match_id,
        MIN(s.player_id) AS player1_id,
        MAX(s.player_id) AS player2_id
      FROM match_x_player_stats s
      INNER JOIN \`match\` m ON m.id = s.match_id
      INNER JOIN event e ON e.id = m.event_id AND e.hidden = 0
      WHERE NOT EXISTS (
        SELECT 1
        FROM match_x_player_x_song mx
        INNER JOIN player hp ON hp.id = mx.player_id
        WHERE mx.match_id = s.match_id
          AND hp.hidden_matches = 1
      )
      GROUP BY s.match_id
      HAVING COUNT(DISTINCT s.player_id) = 2
    ) mp
    INNER JOIN \`match\` m ON m.id = mp.match_id
    INNER JOIN event e ON e.id = m.event_id AND e.hidden = 0
    INNER JOIN player p1 ON p1.id = mp.player1_id AND p1.hidden_matches = 0
    INNER JOIN player p2 ON p2.id = mp.player2_id AND p2.hidden_matches = 0
    WHERE m.winner_id IS NOT NULL
      AND (m.winner_id = mp.player1_id OR m.winner_id = mp.player2_id)
    ORDER BY (e.date IS NULL) ASC, e.date ASC, m.event_id ASC, m.id ASC
  `,

  DELETE_ALL_PLAYER_RATINGS: `DELETE FROM player_rating`,
  DELETE_ALL_MATCH_PLAYER_RATINGS: `DELETE FROM match_player_rating`,

  GET_PLAYER_RATINGS_BY_IDS: `
    SELECT
      pr.player_id,
      pr.rating,
      pr.deviation,
      pr.volatility,
      pr.matches_counted,
      p.username
    FROM player_rating pr
    INNER JOIN player p ON p.id = pr.player_id
    WHERE pr.player_id IN (?)
  `,

  GET_PLAYERS_BY_IDS: `
    SELECT id AS player_id, username
    FROM player
    WHERE id IN (?)
  `,

  CREATE_MATCH_PLAYER_RATINGS_BATCH: (rowCount) => {
    if (rowCount < 1) return null;
    const rowPlaceholders = '(?, ?, ?, ?)';
    const values = Array(rowCount).fill(rowPlaceholders).join(', ');
    return `INSERT INTO match_player_rating (match_id, player_id, rating, deviation) VALUES ${values}`;
  },

  // Head-to-head wins between two players (1v1 matches only, same visibility rules).
  GET_HEAD_TO_HEAD_WINS: `
    SELECT
      m.winner_id,
      COUNT(*) AS win_count
    FROM (
      SELECT
        s.match_id,
        MIN(s.player_id) AS player1_id,
        MAX(s.player_id) AS player2_id
      FROM match_x_player_stats s
      INNER JOIN \`match\` m ON m.id = s.match_id
      INNER JOIN event e ON e.id = m.event_id AND e.hidden = 0
      WHERE NOT EXISTS (
        SELECT 1
        FROM match_x_player_x_song mx
        INNER JOIN player hp ON hp.id = mx.player_id
        WHERE mx.match_id = s.match_id
          AND hp.hidden_matches = 1
      )
      GROUP BY s.match_id
      HAVING COUNT(DISTINCT s.player_id) = 2
    ) mp
    INNER JOIN \`match\` m ON m.id = mp.match_id
    INNER JOIN event e ON e.id = m.event_id AND e.hidden = 0
  WHERE m.winner_id IS NOT NULL
    AND (
      (mp.player1_id = ? AND mp.player2_id = ?)
      OR (mp.player1_id = ? AND mp.player2_id = ?)
    )
    AND (m.winner_id = mp.player1_id OR m.winner_id = mp.player2_id)
    GROUP BY m.winner_id
  `
};

module.exports = {
  // Players with more event appearances first; ties broken alphabetically by gamertag.
  GET_ALL_PLAYERS: `
    SELECT
      p.*,
      COALESCE(epc.cnt, 0) AS event_count
    FROM player p
    LEFT JOIN (
      SELECT player_id, COUNT(DISTINCT event_id) AS cnt
      FROM event_x_player
      INNER JOIN event e ON e.id = event_x_player.event_id AND e.hidden = 0
      GROUP BY player_id
    ) epc ON epc.player_id = p.id
    ORDER BY COALESCE(epc.cnt, 0) DESC, p.username ASC
  `,
  GET_PLAYER_BY_ID: `SELECT * FROM player WHERE id = ?`,
  GET_PLAYER_BY_USERNAME: `SELECT * FROM player WHERE username = ?`,
  SEARCH_PLAYERS: `SELECT * FROM player WHERE username LIKE ? ORDER BY username ASC LIMIT 50`,
  CREATE_PLAYER: `INSERT INTO player (username, pronouns, created_by) VALUES (?, ?, ?)`,
  UPDATE_PLAYER: `UPDATE player SET username = ?, pronouns = ?, created_by = ? WHERE id = ?`,
  UPDATE_PLAYER_HIDDEN_MATCHES: `UPDATE player SET hidden_matches = ? WHERE id = ?`,
  DELETE_PLAYER: `DELETE FROM player WHERE id = ?`,
  // NOTE: Alias ids to avoid `id` collisions between `event_x_player` and `player`.
  // Frontend expects both the join-row id (event_player_id) and the player id (player_id).
  GET_PLAYERS_BY_EVENT: `
    SELECT
      ep.id AS event_player_id,
      ep.event_id,
      ep.player_id,
      ep.seed,
      ep.placement,
      ep.created_by,
      p.id AS player_id,
      p.username,
      p.pronouns
    FROM event_x_player ep
    INNER JOIN player p ON ep.player_id = p.id
    INNER JOIN event e ON e.id = ep.event_id AND e.hidden = 0
    WHERE ep.event_id = ?
    ORDER BY ep.seed ASC, CAST(ep.placement AS UNSIGNED) ASC
  `,
  GET_EVENTS_BY_PLAYER: `SELECT DISTINCT e.*, ep.placement, ep.seed
    FROM event_x_player ep 
    INNER JOIN event e ON ep.event_id = e.id 
    WHERE ep.player_id = ?
      AND e.hidden = 0
    ORDER BY e.date DESC`,

  // Same pairing rules as browse GET_TOP_10_RIVALRIES_BY_MATCH_COUNT (1v1 via match_x_player_stats only).
  GET_TOP_10_RIVALS_FOR_PLAYER: `
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
      WHERE mp.player1_id = ? OR mp.player2_id = ?
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


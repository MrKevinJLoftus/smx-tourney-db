module.exports = {
  // Public: excludes hidden events (via join).
  GET_MATCHES_BY_EVENT: `SELECT m.*
    FROM \`match\` m
    INNER JOIN event e ON e.id = m.event_id AND e.hidden = 0
    WHERE m.event_id = ?
      AND NOT EXISTS (
        SELECT 1
        FROM match_x_player_x_song mx
        INNER JOIN player hp ON hp.id = mx.player_id
        WHERE mx.match_id = m.id
          AND hp.hidden_matches = 1
      )
    ORDER BY m.round DESC, m.id DESC`,
  RECENT_MATCHES: `SELECT m.*
    FROM \`match\` m
    INNER JOIN event e ON m.event_id = e.id AND e.hidden = 0
    WHERE NOT EXISTS (
      SELECT 1
      FROM match_x_player_x_song mx
      INNER JOIN player hp ON hp.id = mx.player_id
      WHERE mx.match_id = m.id
        AND hp.hidden_matches = 1
    )
    ORDER BY
      (e.date IS NULL) ASC,
      e.date DESC,
      m.created_at DESC,
      m.id DESC
    LIMIT ? OFFSET ?`,
  SEARCH_MATCHES: `SELECT DISTINCT m.*
    FROM \`match\` m
    INNER JOIN event e ON m.event_id = e.id AND e.hidden = 0
    LEFT JOIN match_x_player_x_song mps ON m.id = mps.match_id
    LEFT JOIN player p ON mps.player_id = p.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM match_x_player_x_song mx
      INNER JOIN player hp ON hp.id = mx.player_id
      WHERE mx.match_id = m.id
        AND hp.hidden_matches = 1
    )
    AND (
      m.round LIKE ?
      OR e.name LIKE ?
      OR p.username LIKE ?
    )
    ORDER BY
      (e.date IS NULL) ASC,
      e.date DESC,
      m.created_at DESC,
      m.id DESC
    LIMIT ? OFFSET ?`,
  GET_PUBLIC_MATCH_BY_ID: `SELECT m.*
    FROM \`match\` m
    INNER JOIN event e ON e.id = m.event_id AND e.hidden = 0
    WHERE m.id = ?
      AND NOT EXISTS (
        SELECT 1
        FROM match_x_player_x_song mx
        INNER JOIN player hp ON hp.id = mx.player_id
        WHERE mx.match_id = m.id
          AND hp.hidden_matches = 1
      )`,

  // Admin/internal: includes hidden events.
  GET_MATCH_BY_ID: `SELECT m.*
    FROM \`match\` m
    WHERE m.id = ?`,
  GET_PLAYERS_BY_MATCH: `SELECT DISTINCT mps.player_id, p.username as gamertag
    FROM match_x_player_x_song mps
    LEFT JOIN player p ON mps.player_id = p.id
    WHERE mps.match_id = ?
    ORDER BY mps.player_id ASC`,
  GET_PLAYER_SONG_SCORES: `SELECT mps.player_id, mps.song_id, mps.song_order, mps.chart_id, mps.score, mps.win, p.username as player_gamertag, s.title as song_title, s.artist as song_artist, 
    sc.mode as chart_mode, sc.difficulty as chart_difficulty
    FROM match_x_player_x_song mps
    LEFT JOIN player p ON mps.player_id = p.id
    LEFT JOIN song s ON mps.song_id = s.id
    LEFT JOIN song_x_chart sc ON mps.chart_id = sc.id
    WHERE mps.match_id = ?
    ORDER BY COALESCE(mps.song_order, mps.song_id) ASC, mps.player_id ASC`,
  CREATE_MATCH: `INSERT INTO \`match\` (event_id, winner_id, round, created_by) 
    VALUES (?, ?, ?, ?)`,
  /** Build batch INSERT for match. Pass row count; params = flat array of (event_id, winner_id, round, created_by) per row. */
  CREATE_MATCH_BATCH: (rowCount) => {
    if (rowCount < 1) return null;
    const rowPlaceholders = '(?, ?, ?, ?)';
    const values = Array(rowCount).fill(rowPlaceholders).join(', ');
    return `INSERT INTO \`match\` (event_id, winner_id, round, created_by) VALUES ${values}`;
  },
  CREATE_MATCH_PLAYER_SONG: `INSERT INTO match_x_player_x_song (match_id, player_id, song_id, song_order, chart_id, score, win, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  DELETE_MATCH_PLAYER_SONGS: `DELETE FROM match_x_player_x_song WHERE match_id = ?`,
  GET_PLAYER_STATS_BY_MATCH: `SELECT mps.match_id, mps.player_id, mps.wins, mps.losses, mps.draws, p.username as gamertag
    FROM match_x_player_stats mps
    LEFT JOIN player p ON mps.player_id = p.id
    WHERE mps.match_id = ?
    ORDER BY mps.player_id ASC`,
  CREATE_MATCH_PLAYER_STATS: `INSERT INTO match_x_player_stats (match_id, player_id, wins, losses, draws, created_by) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE wins = VALUES(wins), losses = VALUES(losses), draws = VALUES(draws)`,
  /** Build batch INSERT for match_x_player_x_song. Pass row count; params = flat array of (match_id, player_id, song_id, song_order, chart_id, score, win, created_by) per row. */
  CREATE_MATCH_PLAYER_SONGS_BATCH: (rowCount) => {
    if (rowCount < 1) return null;
    const rowPlaceholders = '(?, ?, ?, ?, ?, ?, ?, ?)';
    const values = Array(rowCount).fill(rowPlaceholders).join(', ');
    return `INSERT INTO match_x_player_x_song (match_id, player_id, song_id, song_order, chart_id, score, win, created_by) VALUES ${values}`;
  },
  /** Build batch INSERT for match_x_player_stats. Pass row count; params = flat array of (match_id, player_id, wins, losses, draws, created_by) per row. */
  CREATE_MATCH_PLAYER_STATS_BATCH: (rowCount) => {
    if (rowCount < 1) return null;
    const rowPlaceholders = '(?, ?, ?, ?, ?, ?)';
    const values = Array(rowCount).fill(rowPlaceholders).join(', ');
    return `INSERT INTO match_x_player_stats (match_id, player_id, wins, losses, draws, created_by) VALUES ${values} ON DUPLICATE KEY UPDATE wins = VALUES(wins), losses = VALUES(losses), draws = VALUES(draws)`;
  },
  DELETE_MATCH_PLAYER_STATS: `DELETE FROM match_x_player_stats WHERE match_id = ?`,
  UPDATE_MATCH: `UPDATE \`match\` SET event_id = ?, winner_id = ?, round = ? 
    WHERE id = ?`,
  DELETE_MATCH: `DELETE FROM \`match\` WHERE id = ?`,
  GET_MATCHES_BY_PLAYER: `SELECT DISTINCT m.*
    FROM \`match\` m
    INNER JOIN match_x_player_x_song mps ON m.id = mps.match_id
    WHERE mps.player_id = ?
    ORDER BY m.created_at DESC`,
  GET_PUBLIC_MATCHES_BY_PLAYER: `SELECT DISTINCT m.*
    FROM \`match\` m
    INNER JOIN match_x_player_x_song mps ON m.id = mps.match_id
    INNER JOIN event e ON e.id = m.event_id AND e.hidden = 0
    WHERE mps.player_id = ?
      AND NOT EXISTS (
        SELECT 1
        FROM match_x_player_x_song mx
        INNER JOIN player hp ON hp.id = mx.player_id
        WHERE mx.match_id = m.id
          AND hp.hidden_matches = 1
      )
    ORDER BY m.created_at DESC`,
  CHECK_DUPLICATE_MATCH: `SELECT m.id
    FROM \`match\` m
    INNER JOIN match_x_player_x_song mps1 ON m.id = mps1.match_id
    INNER JOIN match_x_player_x_song mps2 ON m.id = mps2.match_id
    WHERE m.event_id = ?
      AND m.round = ?
      AND mps1.player_id = ?
      AND mps2.player_id = ?
      AND mps1.player_id != mps2.player_id
    GROUP BY m.id
    HAVING COUNT(DISTINCT mps1.player_id) = 2
    LIMIT 1`,
  // Batch queries for multiple matches
  GET_PLAYERS_BY_MATCHES: (matchIds) => {
    if (!matchIds || matchIds.length === 0) return null;
    const placeholders = matchIds.map(() => '?').join(',');
    return `SELECT DISTINCT mps.match_id, mps.player_id, p.username as gamertag
      FROM match_x_player_x_song mps
      LEFT JOIN player p ON mps.player_id = p.id
      WHERE mps.match_id IN (${placeholders})
      ORDER BY mps.match_id ASC, mps.player_id ASC`;
  },
  GET_PLAYER_SONG_SCORES_BY_MATCHES: (matchIds) => {
    if (!matchIds || matchIds.length === 0) return null;
    const placeholders = matchIds.map(() => '?').join(',');
    return `SELECT mps.match_id, mps.player_id, mps.song_id, mps.song_order, mps.chart_id, mps.score, mps.win, 
      p.username as player_gamertag, s.title as song_title, s.artist as song_artist, 
      sc.mode as chart_mode, sc.difficulty as chart_difficulty
      FROM match_x_player_x_song mps
      LEFT JOIN player p ON mps.player_id = p.id
      LEFT JOIN song s ON mps.song_id = s.id
      LEFT JOIN song_x_chart sc ON mps.chart_id = sc.id
      WHERE mps.match_id IN (${placeholders})
      ORDER BY mps.match_id ASC, COALESCE(mps.song_order, mps.song_id) ASC, mps.player_id ASC`;
  },
  GET_PLAYER_STATS_BY_MATCHES: (matchIds) => {
    if (!matchIds || matchIds.length === 0) return null;
    const placeholders = matchIds.map(() => '?').join(',');
    return `SELECT mps.match_id, mps.player_id, mps.wins, mps.losses, mps.draws, p.username as gamertag
      FROM match_x_player_stats mps
      LEFT JOIN player p ON mps.player_id = p.id
      WHERE mps.match_id IN (${placeholders})
      ORDER BY mps.match_id ASC, mps.player_id ASC`;
  },
  GET_WINNERS_BY_IDS: (winnerIds) => {
    if (!winnerIds || winnerIds.length === 0) return null;
    const placeholders = winnerIds.map(() => '?').join(',');
    return `SELECT id as player_id, username as gamertag FROM player WHERE id IN (${placeholders})`;
  },
  GET_EVENTS_BY_IDS: (eventIds) => {
    if (!eventIds || eventIds.length === 0) return null;
    const placeholders = eventIds.map(() => '?').join(',');
    return `SELECT id as event_id, name, date FROM event WHERE hidden = 0 AND id IN (${placeholders})`;
  }
};


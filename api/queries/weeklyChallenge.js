module.exports = {
  GET_FINALIZED_WEEK_KEYS: `SELECT DATE_FORMAT(week_key, '%Y-%m-%d') AS week_key
    FROM weekly_challenge_week
    WHERE week_key >= ?
    ORDER BY week_key ASC`,
  CREATE_WEEK: `INSERT INTO weekly_challenge_week (week_key, chart_ids) VALUES (?, ?)`,
  DELETE_WEEK: `DELETE FROM weekly_challenge_week WHERE week_key = ?`,
  /** Pass row count; params = flat array of (week_key, difficulty, gamer_id, username, final_rank, total) per row. */
  CREATE_RESULTS_BATCH: (rowCount) => {
    if (rowCount < 1) return null;
    const values = Array(rowCount).fill('(?, ?, ?, ?, ?, ?)').join(', ');
    return `INSERT INTO weekly_challenge_result
      (week_key, difficulty, gamer_id, username, final_rank, total) VALUES ${values}`;
  },
  GET_BUCKET_CONFIGS: `SELECT id, DATE_FORMAT(effective_week, '%Y-%m-%d') AS effective_week, difficulty, buckets, created_at
    FROM weekly_challenge_bucket_config
    ORDER BY effective_week ASC, id ASC`,
  CREATE_BUCKET_CONFIG: `INSERT INTO weekly_challenge_bucket_config (effective_week, difficulty, buckets, created_by)
    VALUES (?, ?, ?, ?)`,
  GET_ALL_RESULTS: `SELECT DATE_FORMAT(week_key, '%Y-%m-%d') AS week_key, difficulty, gamer_id, username, final_rank
    FROM weekly_challenge_result
    WHERE week_key >= ?
    ORDER BY week_key ASC`,
};

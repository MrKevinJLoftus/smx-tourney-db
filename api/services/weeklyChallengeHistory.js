/**
 * All-time weekly challenge history: once a week has ended (plus a grace period for late
 * uploads), its drawn charts and every player who finished 10th or better are saved.
 * Only weeks from WEEKLY_CHALLENGE_LAUNCH_WEEK onward are ever saved.
 */

const dbconn = require('../database/connector');
const queries = require('../queries/weeklyChallenge');
const weeklyChallenge = require('./weeklyChallenge');

const { WeeklyChallengeError, DIFFICULTIES, launchWeek } = weeklyChallenge;

const TOP_RANK = 10;
const BACKGROUND_CHECK_INTERVAL_MS = 10 * 60 * 1000;

let lastBackgroundCheckAt = 0;
let backgroundRun = null;

function finalizeDelayMs() {
  const hours = Number(process.env.WEEKLY_CHALLENGE_FINALIZE_DELAY_HOURS);
  return (Number.isFinite(hours) && hours >= 0 ? hours : 6) * 60 * 60 * 1000;
}

function isDue(weekKey, nowMs) {
  const { endsAtMs } = weeklyChallenge.windowForWeekKey(weekKey, weeklyChallenge.timeZone());
  return nowMs >= endsAtMs + finalizeDelayMs();
}

/** Every week from launch whose end plus the grace period has passed, oldest first. */
function dueWeekKeys(nowMs) {
  const launch = launchWeek();
  if (!launch) return [];
  const keys = [];
  for (let key = launch; isDue(key, nowMs); key = weeklyChallenge.addDays(key, 7)) {
    keys.push(key);
  }
  return keys;
}

function wrapTableError(err) {
  if (err && err.code === 'ER_NO_SUCH_TABLE') {
    return new WeeklyChallengeError(
      'Weekly challenge history tables are missing. Apply migration_add_weekly_challenge_history.sql.',
      503
    );
  }
  return err;
}

async function finalizedWeekKeys(launch) {
  try {
    const rows = await dbconn.executeMysqlQuery(queries.GET_FINALIZED_WEEK_KEYS, [launch]);
    return new Set((rows || []).map((r) => r.week_key));
  } catch (err) {
    throw wrapTableError(err);
  }
}

/**
 * Saves one ended week. With `replace`, an already-saved week is deleted and saved again.
 * @param {string} weekKey
 * @param {{ replace?: boolean }} [opts]
 * @returns {Promise<{ weekKey: string, status: 'saved'|'replaced'|'already-saved', rows: number }>}
 */
async function finalizeWeek(weekKey, { replace = false } = {}) {
  const launch = launchWeek();
  if (!launch) throw new WeeklyChallengeError('WEEKLY_CHALLENGE_LAUNCH_WEEK is not set.');
  if (!weeklyChallenge.isWeekKey(weekKey)) {
    throw new WeeklyChallengeError(`"${weekKey}" is not a Monday in YYYY-MM-DD form.`);
  }
  if (weekKey < launch) {
    throw new WeeklyChallengeError(`${weekKey} is before the launch week (${launch}).`);
  }
  if (!isDue(weekKey, Date.now())) {
    throw new WeeklyChallengeError(`${weekKey} has not ended plus the grace period yet.`);
  }

  const snapshot = await weeklyChallenge.buildSnapshotForWeek(weekKey);

  const chartIds = {};
  const rows = [];
  for (const difficulty of snapshot.difficulties) {
    chartIds[difficulty.key] = difficulty.charts.map((c) => c.chartId);
    for (const entry of difficulty.overall) {
      if (entry.rank > TOP_RANK) break;
      rows.push([weekKey, difficulty.key, entry.gamerId, entry.username, entry.rank, entry.total]);
    }
  }

  try {
    await dbconn.withTransaction(async (connection) => {
      if (replace) await dbconn.executeMysqlQuery(queries.DELETE_WEEK, [weekKey], connection);
      await dbconn.executeMysqlQuery(
        queries.CREATE_WEEK,
        [weekKey, JSON.stringify(chartIds)],
        connection
      );
      if (rows.length) {
        await dbconn.executeMysqlQuery(
          queries.CREATE_RESULTS_BATCH(rows.length),
          rows.flat(),
          connection
        );
      }
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return { weekKey, status: 'already-saved', rows: 0 };
    throw wrapTableError(err);
  }

  return { weekKey, status: replace ? 'replaced' : 'saved', rows: rows.length };
}

/** Saves every due week that isn't saved yet, oldest first. */
async function finalizeDueWeeks() {
  const launch = launchWeek();
  if (!launch) return [];
  const due = dueWeekKeys(Date.now());
  if (!due.length) return [];

  const saved = await finalizedWeekKeys(launch);
  const results = [];
  for (const weekKey of due) {
    if (saved.has(weekKey)) continue;
    results.push(await finalizeWeek(weekKey));
  }
  return results;
}

/** Fire-and-forget check, at most once every few minutes per process. */
function finalizeDueWeeksInBackground() {
  if (!launchWeek() || backgroundRun) return;
  if (Date.now() - lastBackgroundCheckAt < BACKGROUND_CHECK_INTERVAL_MS) return;
  lastBackgroundCheckAt = Date.now();

  backgroundRun = finalizeDueWeeks()
    .then((results) => {
      for (const r of results) {
        console.log(`weeklyChallenge: ${r.status} week ${r.weekKey} (${r.rows} top-${TOP_RANK} rows)`);
      }
    })
    .catch((err) => console.error('weeklyChallenge: finalizing weeks failed:', err.message || err))
    .finally(() => {
      backgroundRun = null;
    });
}

/** Per-difficulty all-time counts of 1st place and top 10 finishes. */
async function getAllTime() {
  const launch = launchWeek();
  const empty = DIFFICULTIES.map((d) => ({ key: d.key, label: d.label, players: [] }));
  if (!launch) {
    return { launchWeek: null, weeksCounted: 0, lastFinalizedWeek: null, topRank: TOP_RANK, difficulties: empty };
  }

  let weeks;
  let rows;
  try {
    [weeks, rows] = await Promise.all([
      finalizedWeekKeys(launch),
      dbconn.executeMysqlQuery(queries.GET_ALL_RESULTS, [launch]),
    ]);
  } catch (err) {
    throw wrapTableError(err);
  }

  const latestUsername = new Map();
  const counts = new Map(DIFFICULTIES.map((d) => [d.key, new Map()]));
  for (const row of rows || []) {
    latestUsername.set(row.gamer_id, row.username);
    const byGamer = counts.get(row.difficulty);
    if (!byGamer) continue;
    const entry = byGamer.get(row.gamer_id) || { gamerId: row.gamer_id, wins: 0, top10s: 0 };
    entry.top10s += 1;
    if (row.final_rank === 1) entry.wins += 1;
    byGamer.set(row.gamer_id, entry);
  }

  const sortedWeeks = [...weeks].sort();
  return {
    launchWeek: launch,
    weeksCounted: sortedWeeks.length,
    lastFinalizedWeek: sortedWeeks.length ? sortedWeeks[sortedWeeks.length - 1] : null,
    topRank: TOP_RANK,
    difficulties: DIFFICULTIES.map((d) => ({
      key: d.key,
      label: d.label,
      players: weeklyChallenge.rankBy(
        [...counts.get(d.key).values()].map((e) => ({
          ...e,
          username: latestUsername.get(e.gamerId) || '',
        })),
        (e) => e.wins,
        (e) => e.top10s
      ),
    })),
  };
}

module.exports = {
  TOP_RANK,
  launchWeek,
  dueWeekKeys,
  finalizeWeek,
  finalizeDueWeeks,
  finalizeDueWeeksInBackground,
  getAllTime,
};

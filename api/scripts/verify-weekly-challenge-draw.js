/**
 * Redraws finalized weekly challenge weeks from the current smx.573.no data and compares the
 * charts with the ones saved in weekly_challenge_week. Read-only: it never writes to the database.
 *
 * Needs the same WEEKLY_CHALLENGE_SALT and CLEARDB_* database settings as production, from
 * the environment or api/.env.
 *
 *   node scripts/verify-weekly-challenge-draw.js
 *       Checks every finalized week, then prints the current week's draw.
 *   node scripts/verify-weekly-challenge-draw.js --week 2026-11-02 [--week ...]
 *       Checks only the given finalized weeks.
 *
 * Exits with 1 if any saved chart differs from the redraw.
 */

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const dbconn = require('../database/connector');
const queries = require('../queries/weeklyChallenge');
const weeklyChallenge = require('../services/weeklyChallenge');
const smx573 = require('../services/smx573Client');

function parseArgs(argv) {
  const args = { weeks: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--week') {
      const week = argv[++i];
      if (!weeklyChallenge.isWeekKey(week)) throw new Error(`--week needs a Monday as YYYY-MM-DD (got "${week}").`);
      args.weeks.push(week);
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function parseChartIds(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

function describeChart(chartId, chartsById, songs) {
  const chart = chartsById.get(chartId);
  if (!chart) return `#${chartId} (not in the current chart list)`;
  const song = songs.get(chart.songId);
  return `#${chartId} ${song ? song.title : `song ${chart.songId}`} ${chart.difficultyDisplay}${chart.level}`;
}

async function redraw(weekKey) {
  const window = weeklyChallenge.windowForWeekKey(weekKey, weeklyChallenge.timeZone());
  const draw = await weeklyChallenge.drawWeek(weekKey, window.startsAtMs);
  return new Map(draw.difficulties.map((d) => [d.difficulty.key, d.picks.map((p) => p.chart.id)]));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.WEEKLY_CHALLENGE_SALT) {
    throw new Error('WEEKLY_CHALLENGE_SALT is not set; without it every redraw differs from production.');
  }
  if (!process.env.CLEARDB_HOST) throw new Error('CLEARDB_HOST and the other CLEARDB_* settings are not set.');
  const salt = process.env.WEEKLY_CHALLENGE_SALT;
  const fingerprint = crypto.createHash('sha256').update(salt).digest('hex').slice(0, 12);
  console.log(`Salt: ${salt.length} characters, sha256 starts ${fingerprint}`);

  const rows = await dbconn.executeMysqlQuery(queries.GET_FINALIZED_WEEKS, []);
  const saved = new Map((rows || []).map((r) => [r.week_key, parseChartIds(r.chart_ids)]));
  const weekKeys = args.weeks.length ? args.weeks : [...saved.keys()];
  if (!weekKeys.length) console.log('No finalized weeks are saved, so there is nothing to compare against.');

  const [charts, songs] = await Promise.all([smx573.getCharts(), smx573.getSongs()]);
  const chartsById = new Map(charts.map((c) => [c.id, c]));

  let mismatches = 0;
  for (const weekKey of weekKeys) {
    const savedIds = saved.get(weekKey);
    if (!savedIds) {
      console.log(`\n${weekKey}: not finalized, skipped.`);
      continue;
    }
    const redrawn = await redraw(weekKey);
    console.log(`\n${weekKey}:`);
    for (const { key, label } of weeklyChallenge.DIFFICULTIES) {
      const expected = savedIds[key];
      const actual = redrawn.get(key) || [];
      if (!expected) {
        console.log(`  ${label}: not saved for this week, skipped.`);
        continue;
      }
      if (expected.length === actual.length && expected.every((id, i) => id === actual[i])) {
        console.log(`  ${label}: match`);
        continue;
      }
      mismatches++;
      console.log(`  ${label}: MISMATCH`);
      console.log(`    saved:   ${expected.map((id) => describeChart(id, chartsById, songs)).join(' | ')}`);
      console.log(`    redrawn: ${actual.map((id) => describeChart(id, chartsById, songs)).join(' | ')}`);
    }
  }

  const currentKey = weeklyChallenge.weekWindow(Date.now(), 0, weeklyChallenge.timeZone()).weekKey;
  const current = await redraw(currentKey);
  console.log(`\nCurrent week ${currentKey} as it would be drawn now (compare with what players saw):`);
  for (const { key, label } of weeklyChallenge.DIFFICULTIES) {
    const ids = current.get(key) || [];
    console.log(`  ${label}: ${ids.map((id) => describeChart(id, chartsById, songs)).join(' | ')}`);
  }

  console.log(
    mismatches
      ? `\n${mismatches} difficulty draw(s) differ from what was saved.`
      : '\nEvery saved draw matches the redraw.'
  );
  if (mismatches) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

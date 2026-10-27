/**
 * Saves weekly challenge results for the all-time leaderboard.
 *
 *   node -r dotenv/config scripts/finalize-weekly-challenge.js
 *       Saves every ended week since WEEKLY_CHALLENGE_LAUNCH_WEEK that isn't saved yet.
 *   node -r dotenv/config scripts/finalize-weekly-challenge.js --week 2026-11-02 [--replace]
 *       Saves one week; --replace deletes and re-saves it if it was saved already.
 */

const history = require('../services/weeklyChallengeHistory');

function parseArgs(argv) {
  const args = { week: null, replace: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--week') args.week = argv[++i] || null;
    else if (argv[i] === '--replace') args.replace = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (args.replace && !args.week) throw new Error('--replace needs --week.');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!history.launchWeek()) {
    throw new Error('Set WEEKLY_CHALLENGE_LAUNCH_WEEK (a Monday, YYYY-MM-DD) first.');
  }

  const results = args.week
    ? [await history.finalizeWeek(args.week, { replace: args.replace })]
    : await history.finalizeDueWeeks();

  if (!results.length) console.log('Nothing to save: every ended week is already saved.');
  for (const r of results) console.log(`${r.weekKey}: ${r.status} (${r.rows} rows)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

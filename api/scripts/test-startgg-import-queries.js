/**
 * Smoke test for start.gg import queries using DEFAULT_TEST_EVENT_SLUG_PATH.
 * Run from api/: node -r dotenv/config scripts/test-startgg-import-queries.js
 */
require('dotenv').config();
const {
  DEFAULT_TEST_EVENT_SLUG_PATH,
  fetchEventForImport,
  fetchStandingsPage,
  fetchSetsPage,
  startAtToSqlDate,
} = require('../services/startGgImportQueries');

async function main() {
  const path = `/${DEFAULT_TEST_EVENT_SLUG_PATH}`;
  const meta = await fetchEventForImport(path);
  const ev = meta.event;
  if (!ev) {
    throw new Error('Event not found for default test slug');
  }
  console.log('Event:', ev.name, 'id=', ev.id);
  console.log('Local date suggestion:', startAtToSqlDate(ev.startAt));

  const s1 = await fetchStandingsPage(ev.id, 1, 10);
  console.log(
    'Standings page 1:',
    s1.event.standings.nodes.length,
    'of',
    s1.event.standings.pageInfo.total
  );

  const m1 = await fetchSetsPage(ev.id, 1, 5);
  console.log(
    'Sets page 1:',
    m1.event.sets.nodes.length,
    'of',
    m1.event.sets.pageInfo.total,
    'pages',
    m1.event.sets.pageInfo.totalPages
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

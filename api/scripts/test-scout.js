/**
 * Quick smoke test for scout services. Run: node api/scripts/test-scout.js
 */
const statmaniaxClient = require('../services/statmaniaxClient');
const pocketVetoService = require('../services/pocketVetoService');

async function main() {
  const resolved = await statmaniaxClient.resolveUser('watersalads');
  console.log('resolve watersalads:', resolved);

  const search = await statmaniaxClient.searchUsers('salad', { limit: 5 });
  console.log('search salad:', search);

  const compare = await pocketVetoService.comparePlayers({
    youId: 3451,
    opponentIds: [3451 === 3451 ? 10287 : 10287],
    mode: 'wild',
    levelMin: 19,
    levelMax: 22,
  });
  console.log('compare chartCount:', compare.chartCount);
  console.log(
    'protects:',
    compare.pocketPicks.length,
    'closest:',
    compare.closestMatchups.length,
    'mode:',
    compare.pocketPickMode,
    'vetos:',
    compare.vetos.length
  );
  if (compare.pocketPicks[0]) {
    console.log('top protect:', compare.pocketPicks[0].title, compare.pocketPicks[0].delta);
  } else if (compare.closestMatchups[0]) {
    console.log('top closest:', compare.closestMatchups[0].title, compare.closestMatchups[0].delta);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

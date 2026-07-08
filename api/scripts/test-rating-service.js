const {
  computeRatingsFromMatches,
} = require('../services/ratingService');
const glicko2 = require('../services/glicko2');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  // Player 1 beats player 2 repeatedly; player 1 should rate higher.
  const matches = [
    { match_id: 101, event_id: 1, player1_id: 1, player2_id: 2, winner_id: 1 },
    { match_id: 102, event_id: 1, player1_id: 1, player2_id: 2, winner_id: 1 },
    { match_id: 201, event_id: 2, player1_id: 1, player2_id: 2, winner_id: 1 },
    { match_id: 202, event_id: 2, player1_id: 1, player2_id: 3, winner_id: 1 },
    { match_id: 301, event_id: 3, player1_id: 2, player2_id: 3, winner_id: 2 },
  ];

  const { ratings, matchSnapshots } = computeRatingsFromMatches(matches);
  const p1 = ratings.get(1);
  const p2 = ratings.get(2);
  const p3 = ratings.get(3);

  assert(p1 && p2 && p3, 'All players should receive ratings');
  assert(p1.rating > p2.rating, 'Winner should have higher rating than loser');
  assert(p2.rating > p3.rating, 'Stronger player should rate above weaker player');
  assert(p1.matchesCounted === 4, 'Player 1 should have 4 counted matches');
  assert(glicko2.DEFAULT_RATING === 1500, 'Default rating constant');

  const match101P1 = matchSnapshots.find((row) => row.matchId === 101 && row.playerId === 1);
  const match102P1 = matchSnapshots.find((row) => row.matchId === 102 && row.playerId === 1);
  const match201P1 = matchSnapshots.find((row) => row.matchId === 201 && row.playerId === 1);
  assert(!!match101P1 && !!match102P1 && !!match201P1, 'Snapshots should exist for all test matches');
  assert(match101P1.rating === match102P1.rating, 'Same-event matches should share the same pre-event rating');
  assert(match101P1.deviation === match102P1.deviation, 'Same-event matches should share the same pre-event RD');
  assert(match201P1.rating !== match101P1.rating, 'Next-event snapshot should reflect prior event results');

  console.log('ratingService self-test passed');
  console.log({
    player1: { rating: p1.rating.toFixed(2), rd: p1.rd.toFixed(2), matches: p1.matchesCounted },
    player2: { rating: p2.rating.toFixed(2), rd: p2.rd.toFixed(2), matches: p2.matchesCounted },
    player3: { rating: p3.rating.toFixed(2), rd: p3.rd.toFixed(2), matches: p3.matchesCounted },
    snapshotSample: matchSnapshots.slice(0, 4),
  });
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});

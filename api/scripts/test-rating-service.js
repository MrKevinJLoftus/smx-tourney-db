const {
  computeRatingsFromMatches,
  sortRosterForSeeding,
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
    { event_id: 1, player1_id: 1, player2_id: 2, winner_id: 1 },
    { event_id: 1, player1_id: 1, player2_id: 2, winner_id: 1 },
    { event_id: 2, player1_id: 1, player2_id: 2, winner_id: 1 },
    { event_id: 2, player1_id: 1, player2_id: 3, winner_id: 1 },
    { event_id: 3, player1_id: 2, player2_id: 3, winner_id: 2 },
  ];

  const ratings = computeRatingsFromMatches(matches);
  const p1 = ratings.get(1);
  const p2 = ratings.get(2);
  const p3 = ratings.get(3);

  assert(p1 && p2 && p3, 'All players should receive ratings');
  assert(p1.rating > p2.rating, 'Winner should have higher rating than loser');
  assert(p2.rating > p3.rating, 'Stronger player should rate above weaker player');
  assert(p1.matchesCounted === 4, 'Player 1 should have 4 counted matches');
  assert(glicko2.DEFAULT_RATING === 1500, 'Default rating constant');

  const roster = [
    { playerId: 1, username: 'Alice', rating: 1200, deviation: 100, matchesCounted: 20, provisional: false },
    { playerId: 2, username: 'Bob', rating: 1800, deviation: 100, matchesCounted: 20, provisional: false },
    { playerId: 3, username: 'Carol', rating: 1500, deviation: 100, matchesCounted: 20, provisional: false },
  ];
  const sorted = await sortRosterForSeeding(roster);
  assert(sorted[0].playerId === 2, 'Highest rating should be seed 1');
  assert(sorted[1].playerId === 3, 'Middle rating should be seed 2');
  assert(sorted[2].playerId === 1, 'Lowest rating should be seed 3');

  console.log('ratingService self-test passed');
  console.log({
    player1: { rating: p1.rating.toFixed(2), rd: p1.rd.toFixed(2), matches: p1.matchesCounted },
    player2: { rating: p2.rating.toFixed(2), rd: p2.rd.toFixed(2), matches: p2.matchesCounted },
    player3: { rating: p3.rating.toFixed(2), rd: p3.rd.toFixed(2), matches: p3.matchesCounted },
    seedOrder: sorted.map((entry, index) => `${index + 1}. ${entry.username} (${entry.rating})`),
  });
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});

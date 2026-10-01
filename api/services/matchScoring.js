/**
 * Determines the winner(s) of a song based on scores.
 * Returns a Set of player_ids who won (empty Set if tie/no winner).
 * @param {Array} playerScores - Array of {player_id, score} objects
 * @returns {Set} Set of winning player_ids (empty if tie)
 */
const determineSongWinner = (playerScores) => {
  if (!playerScores || playerScores.length === 0) {
    return new Set();
  }

  // Filter out players with null/undefined scores
  const validScores = playerScores.filter(ps => 
    ps && ps.player_id && ps.score !== null && ps.score !== undefined
  );

  if (validScores.length === 0) {
    return new Set();
  }

  // Find the maximum score (convert to numbers for comparison)
  const maxScore = Math.max(...validScores.map(ps => Number(ps.score)));

  // Find all players with the maximum score (compare as numbers)
  const winners = validScores.filter(ps => Number(ps.score) === maxScore);

  // If only one player has the max score, they win; otherwise it's a tie
  return winners.length === 1 ? new Set([winners[0].player_id]) : new Set();
};

/**
 * Calculates W-L-D stats from songs for all players.
 * @param {Array} songs - Array of song objects with player_scores
 * @param {Set} playerIds - Set of all player IDs in the match
 * @returns {Map} Map of player_id -> {wins, losses, draws}
 */
const calculateWLDFromSongs = (songs, playerIds) => {
  const stats = new Map();
  
  // Initialize stats for all players
  playerIds.forEach(playerId => {
    stats.set(playerId, { wins: 0, losses: 0, draws: 0 });
  });

  if (!songs || songs.length === 0) {
    return stats;
  }

  // Process each song
  songs.forEach(song => {
    if (!song || !song.player_scores || !Array.isArray(song.player_scores)) {
      return;
    }

    // Filter valid scores
    const validScores = song.player_scores.filter(ps => 
      ps && ps.player_id && ps.score !== null && ps.score !== undefined
    );

    if (validScores.length === 0) {
      return;
    }

    // Find max and min scores
    const scores = validScores.map(ps => Number(ps.score));
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    // Find players with max score (winners or draws)
    const maxScorePlayers = validScores.filter(ps => Number(ps.score) === maxScore).map(ps => ps.player_id);
    
    // If all players have the same score, it's a draw for all
    if (maxScore === minScore) {
      maxScorePlayers.forEach(playerId => {
        const playerStats = stats.get(playerId);
        if (playerStats) {
          playerStats.draws++;
        }
      });
    } else {
      // If only one winner, they win; others lose (or draw if tied for second)
      if (maxScorePlayers.length === 1) {
        const winnerId = maxScorePlayers[0];
        const winnerStats = stats.get(winnerId);
        if (winnerStats) {
          winnerStats.wins++;
        }

        // All other players lose (unless they tied for second place)
        validScores.forEach(ps => {
          if (ps.player_id !== winnerId) {
            const playerStats = stats.get(ps.player_id);
            if (playerStats) {
              playerStats.losses++;
            }
          }
        });
      } else {
        // Multiple players tied for highest score - all get a draw
        maxScorePlayers.forEach(playerId => {
          const playerStats = stats.get(playerId);
          if (playerStats) {
            playerStats.draws++;
          }
        });

        // Players with lower scores lose
        validScores.forEach(ps => {
          if (!maxScorePlayers.includes(ps.player_id)) {
            const playerStats = stats.get(ps.player_id);
            if (playerStats) {
              playerStats.losses++;
            }
          }
        });
      }
    }
  });

  return stats;
};

module.exports = {
  determineSongWinner,
  calculateWLDFromSongs,
};

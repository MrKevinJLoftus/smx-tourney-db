const dbconn = require('../database/connector');
const queries = require('../queries/match');

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

const transformMatchResult = async (match) => {
  if (!match) return null;
  
  // Fetch players for this match
  const players = await dbconn.executeMysqlQuery(queries.GET_PLAYERS_BY_MATCH, [match.id]);
  const playersArray = players.map(player => ({
    player_id: player.player_id,
    gamertag: player.gamertag
  }));

  // Fetch all player-song-score combinations
  const playerSongScores = await dbconn.executeMysqlQuery(queries.GET_PLAYER_SONG_SCORES, [match.id]);
  
  // Group by song_id to create songs array
  const songsMap = new Map();
  playerSongScores.forEach(entry => {
    if (!entry.song_id) return; // Skip entries without songs
    
    if (!songsMap.has(entry.song_id)) {
      songsMap.set(entry.song_id, {
        song_id: entry.song_id,
        chart_id: entry.chart_id,
        chart_mode: entry.chart_mode,
        chart_difficulty: entry.chart_difficulty,
        chart_display: entry.chart_mode && entry.chart_difficulty ? `${entry.chart_mode} ${entry.chart_difficulty}` : null,
        title: entry.song_title,
        artist: entry.song_artist,
        player_scores: []
      });
    }
    
    const song = songsMap.get(entry.song_id);
    song.player_scores.push({
      player_id: entry.player_id,
      score: entry.score,
      win: entry.win,
      player_gamertag: entry.player_gamertag
    });
  });
  
  const songsArray = Array.from(songsMap.values());

  // Determine winner from match.winner_id (not from song win flags)
  let winner = null;
  if (match.winner_id) {
    // Find the winner player from the players array
    const winnerPlayer = playersArray.find(p => p.player_id === match.winner_id);
    if (winnerPlayer) {
      winner = {
        player_id: winnerPlayer.player_id,
        gamertag: winnerPlayer.gamertag
      };
    } else {
      // If winner not in players array, fetch it directly
      const winnerData = await dbconn.executeMysqlQuery(
        'SELECT id as player_id, username as gamertag FROM player WHERE id = ?',
        [match.winner_id]
      );
      if (winnerData && winnerData.length > 0) {
        winner = {
          player_id: winnerData[0].player_id,
          gamertag: winnerData[0].gamertag
        };
      }
    }
  }

  return {
    match_id: match.id,
    event_id: match.event_id,
    created_at: match.created_at,
    players: playersArray,
    winner: winner,
    songs: songsArray
  };
};

exports.getMatchesByEvent = async (req, res) => {
  const eventId = req.params.eventId;
  console.log(`Fetching matches for event: ${eventId}`);
  const matches = await dbconn.executeMysqlQuery(queries.GET_MATCHES_BY_EVENT, [eventId]);
  const transformedMatches = await Promise.all(matches.map(match => transformMatchResult(match)));
  res.status(200).json(transformedMatches);
};

exports.getMatchById = async (req, res) => {
  const matchId = req.params.id;
  console.log(`Fetching match with id: ${matchId}`);
  const matches = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  if (!matches || matches.length < 1) {
    return res.status(404).json({ message: 'Match not found' });
  }
  const transformedMatch = await transformMatchResult(matches[0]);
  res.status(200).json(transformedMatch);
};

exports.createMatch = async (req, res) => {
  const { event_id, player_ids, songs, winner_id } = req.body;
  console.log(`Creating new match for event: ${event_id}`);
  
  if (!event_id) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  
  // Validate players based on whether songs are provided
  let uniquePlayerIds = new Set();
  if (songs && Array.isArray(songs) && songs.length > 0) {
    // Extract unique player IDs from song player_scores (only from songs with song_id, matching insertion logic)
    for (const songData of songs) {
      if (songData && songData.song_id && songData.player_scores && Array.isArray(songData.player_scores)) {
        for (const playerScore of songData.player_scores) {
          if (playerScore && playerScore.player_id) {
            uniquePlayerIds.add(Number(playerScore.player_id));
          }
        }
      }
    }
    
    if (uniquePlayerIds.size < 2) {
      return res.status(400).json({ message: 'At least 2 unique players are required in song player_scores' });
    }
  } else {
    // When no songs, validate player_ids
    if (!player_ids || !Array.isArray(player_ids) || player_ids.length < 2) {
      return res.status(400).json({ message: 'At least 2 player IDs are required when no songs are provided' });
    }
    // Store player_ids for later use
    player_ids.forEach(id => uniquePlayerIds.add(Number(id)));
  }
  
  const createdBy = req.userData?.userId || null;
  
  // Create the match
  const result = await dbconn.executeMysqlQuery(queries.CREATE_MATCH, [
    event_id,
    winner_id || null,
    createdBy
  ]);
  console.log(JSON.stringify(result));
  const matchId = result.insertId;
  
  // Insert player-song-score combinations into match_x_player_x_song table
  let validSongsInserted = false;
  if (songs && Array.isArray(songs) && songs.length > 0) {
    for (const songData of songs) {
      if (songData && songData.song_id && songData.player_scores && Array.isArray(songData.player_scores)) {
        // Determine song winner based on highest score
        const songWinners = determineSongWinner(songData.player_scores);
        
        for (const playerScore of songData.player_scores) {
          if (playerScore && playerScore.player_id) {
            // Check if this player won the song (not the match)
            const isSongWin = songWinners.has(playerScore.player_id);
            await dbconn.executeMysqlQuery(queries.CREATE_MATCH_PLAYER_SONG, [
              matchId,
              playerScore.player_id,
              songData.song_id ? Number(songData.song_id) : null,
              songData.chart_id ? Number(songData.chart_id) : null,
              playerScore.score !== undefined && playerScore.score !== null ? playerScore.score : null,
              isSongWin ? 1 : 0,
              createdBy
            ]);
            validSongsInserted = true;
          }
        }
      }
    }
  }
  
  // If no valid songs were inserted (songs array was empty, missing, or all entries invalid),
  // create entries for each player using player_ids (without song_id)
  if (!validSongsInserted) {
    // Use match winner_id for win flag when there are no songs
    // Use the validated player_ids array from uniquePlayerIds (which contains validated IDs from either songs or player_ids)
    const playerIdsArray = Array.from(uniquePlayerIds);
    for (const playerId of playerIdsArray) {
      await dbconn.executeMysqlQuery(queries.CREATE_MATCH_PLAYER_SONG, [
        matchId,
        playerId,
        null, // no song
        null, // no chart
        null, // no score
        winner_id && Number(winner_id) === Number(playerId) ? 1 : 0,
        createdBy
      ]);
    }
  }
  
  const newMatch = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  console.log(JSON.stringify(newMatch));
  const transformedMatch = await transformMatchResult(newMatch[0]);
  res.status(201).json(transformedMatch);
};

exports.updateMatch = async (req, res) => {
  const matchId = req.params.id;
  const { event_id, player_ids, songs, winner_id } = req.body;
  console.log(`Updating match with id: ${matchId}`);
  
  if (!event_id) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  
  // Verify the match exists before attempting any modifications
  const existingMatch = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  if (!existingMatch || existingMatch.length < 1) {
    return res.status(404).json({ message: 'Match not found' });
  }
  
  // Validate players based on whether songs are provided
  let uniquePlayerIds = new Set();
  if (songs && Array.isArray(songs) && songs.length > 0) {
    // Extract unique player IDs from song player_scores (only from songs with song_id, matching insertion logic)
    for (const songData of songs) {
      if (songData && songData.song_id && songData.player_scores && Array.isArray(songData.player_scores)) {
        for (const playerScore of songData.player_scores) {
          if (playerScore && playerScore.player_id) {
            uniquePlayerIds.add(Number(playerScore.player_id));
          }
        }
      }
    }
    
    if (uniquePlayerIds.size < 2) {
      return res.status(400).json({ message: 'At least 2 unique players are required in song player_scores' });
    }
  } else {
    // When no songs, validate player_ids
    if (!player_ids || !Array.isArray(player_ids) || player_ids.length < 2) {
      return res.status(400).json({ message: 'At least 2 player IDs are required when no songs are provided' });
    }
    // Store player_ids for later use
    player_ids.forEach(id => uniquePlayerIds.add(Number(id)));
  }
  
  // Update the match
  await dbconn.executeMysqlQuery(queries.UPDATE_MATCH, [
    event_id,
    winner_id || null,
    matchId
  ]);
  
  // Delete existing player-song combinations and insert new ones
  await dbconn.executeMysqlQuery(queries.DELETE_MATCH_PLAYER_SONGS, [matchId]);
  const createdBy = req.userData?.userId || null;
  
  // Insert player-song-score combinations into match_x_player_x_song table
  let validSongsInserted = false;
  if (songs && Array.isArray(songs) && songs.length > 0) {
    for (const songData of songs) {
      if (songData && songData.song_id && songData.player_scores && Array.isArray(songData.player_scores)) {
        // Determine song winner based on highest score
        const songWinners = determineSongWinner(songData.player_scores);
        
        for (const playerScore of songData.player_scores) {
          if (playerScore && playerScore.player_id) {
            // Check if this player won the song (not the match)
            const isSongWin = songWinners.has(playerScore.player_id);
            await dbconn.executeMysqlQuery(queries.CREATE_MATCH_PLAYER_SONG, [
              matchId,
              playerScore.player_id,
              songData.song_id ? Number(songData.song_id) : null,
              songData.chart_id ? Number(songData.chart_id) : null,
              playerScore.score !== undefined && playerScore.score !== null ? playerScore.score : null,
              isSongWin ? 1 : 0,
              createdBy
            ]);
            validSongsInserted = true;
          }
        }
      }
    }
  }
  
  // If no valid songs were inserted (songs array was empty, missing, or all entries invalid),
  // create entries for each player using player_ids (without song_id)
  if (!validSongsInserted) {
    // Use match winner_id for win flag when there are no songs
    // Use the validated player_ids array from uniquePlayerIds (which contains validated IDs from either songs or player_ids)
    const playerIdsArray = Array.from(uniquePlayerIds);
    for (const playerId of playerIdsArray) {
      await dbconn.executeMysqlQuery(queries.CREATE_MATCH_PLAYER_SONG, [
        matchId,
        playerId,
        null, // no song
        null, // no chart
        null, // no score
        winner_id && Number(winner_id) === Number(playerId) ? 1 : 0,
        createdBy
      ]);
    }
  }
  
  const updatedMatch = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  const transformedMatch = await transformMatchResult(updatedMatch[0]);
  res.status(200).json(transformedMatch);
};

exports.deleteMatch = async (req, res) => {
  const matchId = req.params.id;
  console.log(`Deleting match with id: ${matchId}`);
  const match = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  if (!match || match.length < 1) {
    return res.status(404).json({ message: 'Match not found' });
  }
  await dbconn.executeMysqlQuery(queries.DELETE_MATCH, [matchId]);
  res.status(200).json({ message: 'Match deleted successfully' });
};


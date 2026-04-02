const dbconn = require('../database/connector');
const queries = require('../queries/match');
const eventQueries = require('../queries/event');
const {
  cleanGamertag,
  normalizeGamertag,
  resolvePlayer,
  prePopulatePlayerCache,
} = require('../services/playerResolver');
const { augmentStartGgSetForMatchImport } = require('../services/startGgRoundLabel');

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

/**
 * Transforms multiple matches in batch, minimizing database queries
 * @param {Array} matches - Array of match objects from database
 * @returns {Promise<Array>} Array of transformed match objects
 */
const transformMatchesBatch = async (matches) => {
  if (!matches || matches.length === 0) {
    return [];
  }

  const matchIds = matches.map(m => m.id);
  const winnerIds = matches
    .map(m => m.winner_id)
    .filter(id => id !== null && id !== undefined);
  const eventIds = [...new Set(matches.map(m => m.event_id).filter(id => id !== null && id !== undefined))];

  // Fetch all related data in parallel using batch queries
  const [
    allPlayers,
    allPlayerSongScores,
    allPlayerStats,
    allWinners,
    allEvents
  ] = await Promise.all([
    // Get all players for all matches
    matchIds.length > 0 ? dbconn.executeMysqlQuery(
      queries.GET_PLAYERS_BY_MATCHES(matchIds),
      matchIds
    ) : Promise.resolve([]),
    // Get all player-song-scores for all matches
    matchIds.length > 0 ? dbconn.executeMysqlQuery(
      queries.GET_PLAYER_SONG_SCORES_BY_MATCHES(matchIds),
      matchIds
    ) : Promise.resolve([]),
    // Get all player stats for all matches
    matchIds.length > 0 ? dbconn.executeMysqlQuery(
      queries.GET_PLAYER_STATS_BY_MATCHES(matchIds),
      matchIds
    ) : Promise.resolve([]),
    // Get all winners (only if not already in players list)
    winnerIds.length > 0 ? dbconn.executeMysqlQuery(
      queries.GET_WINNERS_BY_IDS(winnerIds),
      winnerIds
    ) : Promise.resolve([]),
    // Get all events
    eventIds.length > 0 ? dbconn.executeMysqlQuery(
      queries.GET_EVENTS_BY_IDS(eventIds),
      eventIds
    ) : Promise.resolve([])
  ]);

  // Build indexes/maps for efficient lookup
  const playersByMatchId = new Map();
  allPlayers.forEach(player => {
    if (!playersByMatchId.has(player.match_id)) {
      playersByMatchId.set(player.match_id, []);
    }
    playersByMatchId.get(player.match_id).push({
      player_id: player.player_id,
      gamertag: player.gamertag
    });
  });

  const playerSongScoresByMatchId = new Map();
  allPlayerSongScores.forEach(entry => {
    if (!playerSongScoresByMatchId.has(entry.match_id)) {
      playerSongScoresByMatchId.set(entry.match_id, []);
    }
    playerSongScoresByMatchId.get(entry.match_id).push(entry);
  });

  const playerStatsByMatchId = new Map();
  allPlayerStats.forEach(stat => {
    if (!playerStatsByMatchId.has(stat.match_id)) {
      playerStatsByMatchId.set(stat.match_id, []);
    }
    playerStatsByMatchId.get(stat.match_id).push({
      player_id: stat.player_id,
      wins: stat.wins || 0,
      losses: stat.losses || 0,
      draws: stat.draws || 0,
      gamertag: stat.gamertag
    });
  });

  const winnersById = new Map();
  allWinners.forEach(winner => {
    winnersById.set(winner.player_id, {
      player_id: winner.player_id,
      gamertag: winner.gamertag
    });
  });

  const eventsById = new Map();
  allEvents.forEach(event => {
    eventsById.set(event.event_id, {
      event_id: event.event_id,
      name: event.name,
      date: event.date
    });
  });

  // Transform each match using pre-fetched data
  return matches.map(match => {
    const playersArray = playersByMatchId.get(match.id) || [];
    
    // Process songs from player-song-scores
    const playerSongScores = playerSongScoresByMatchId.get(match.id) || [];
    const songsMap = new Map();
    const songOrderMap = new Map();
    
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
        if (entry.song_order !== null && entry.song_order !== undefined) {
          songOrderMap.set(entry.song_id, entry.song_order);
        }
      }
      
      const song = songsMap.get(entry.song_id);
      song.player_scores.push({
        player_id: entry.player_id,
        score: entry.score,
        win: entry.win,
        player_gamertag: entry.player_gamertag
      });
    });
    
    // Convert songs map to sorted array
    const songsArray = Array.from(songsMap.entries())
      .map(([songId, song]) => ({ ...song, _order: songOrderMap.get(songId) ?? songId }))
      .sort((a, b) => {
        const orderA = a._order ?? a.song_id;
        const orderB = b._order ?? b.song_id;
        return orderA - orderB;
      })
      .map(({ _order, ...song }) => song);

    // Determine winner
    let winner = null;
    if (match.winner_id) {
      const winnerPlayer = playersArray.find(p => p.player_id === match.winner_id);
      if (winnerPlayer) {
        winner = {
          player_id: winnerPlayer.player_id,
          gamertag: winnerPlayer.gamertag
        };
      } else if (winnersById.has(match.winner_id)) {
        winner = winnersById.get(match.winner_id);
      }
    }

    // Get player stats
    const playerStatsArray = playerStatsByMatchId.get(match.id) || [];

    // Get event
    const event = match.event_id ? (eventsById.get(match.event_id) || null) : null;

    return {
      match_id: match.id,
      event_id: match.event_id,
      round: match.round || null,
      created_at: match.created_at,
      players: playersArray,
      winner: winner,
      songs: songsArray,
      player_stats: playerStatsArray,
      event: event
    };
  });
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
  
  // Group by song_id to create songs array, preserving order
  const songsMap = new Map();
  const songOrderMap = new Map(); // Track order for each song_id
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
      // Store the order for this song (use first occurrence's order)
      if (entry.song_order !== null && entry.song_order !== undefined) {
        songOrderMap.set(entry.song_id, entry.song_order);
      }
    }
    
    const song = songsMap.get(entry.song_id);
    song.player_scores.push({
      player_id: entry.player_id,
      score: entry.score,
      win: entry.win,
      player_gamertag: entry.player_gamertag
    });
  });
  
  // Convert map to array and sort by song_order (or song_id as fallback)
  const songsArray = Array.from(songsMap.entries())
    .map(([songId, song]) => ({ ...song, _order: songOrderMap.get(songId) ?? songId }))
    .sort((a, b) => {
      // Sort by song_order if available, otherwise by song_id
      const orderA = a._order ?? a.song_id;
      const orderB = b._order ?? b.song_id;
      return orderA - orderB;
    })
    .map(({ _order, ...song }) => song); // Remove temporary _order property

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

  // Fetch W-L-D stats for this match
  const playerStats = await dbconn.executeMysqlQuery(queries.GET_PLAYER_STATS_BY_MATCH, [match.id]);
  const playerStatsArray = playerStats.map(stat => ({
    player_id: stat.player_id,
    wins: stat.wins || 0,
    losses: stat.losses || 0,
    draws: stat.draws || 0,
    gamertag: stat.gamertag
  }));

  // Fetch event information
  let event = null;
  if (match.event_id) {
    const eventData = await dbconn.executeMysqlQuery(
      'SELECT id as event_id, name, date FROM event WHERE id = ?',
      [match.event_id]
    );
    if (eventData && eventData.length > 0) {
      event = {
        event_id: eventData[0].event_id,
        name: eventData[0].name,
        date: eventData[0].date
      };
    }
  }

  return {
    match_id: match.id,
    event_id: match.event_id,
    round: match.round || null,
    created_at: match.created_at,
    players: playersArray,
    winner: winner,
    songs: songsArray,
    player_stats: playerStatsArray,
    event: event
  };
};

exports.getMatchesByEvent = async (req, res) => {
  const eventId = req.params.eventId;
  console.log(`Fetching matches for event: ${eventId}`);
  const matches = await dbconn.executeMysqlQuery(queries.GET_MATCHES_BY_EVENT, [eventId]);
  // Use batch transform to minimize database queries
  const transformedMatches = await transformMatchesBatch(matches);
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

const MATCH_SEARCH_DEFAULT_RECENT_LIMIT = 30;
const MATCH_SEARCH_DEFAULT_QUERY_LIMIT = 50;
const MATCH_SEARCH_MAX_LIMIT = 100;

exports.searchMatches = async (req, res) => {
  const query = (req.query.q || req.query.query || '').trim();
  console.log(`Searching matches with query: ${query || '(recent)'}`);

  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) {
    limit = query ? MATCH_SEARCH_DEFAULT_QUERY_LIMIT : MATCH_SEARCH_DEFAULT_RECENT_LIMIT;
  }
  if (limit > MATCH_SEARCH_MAX_LIMIT) {
    limit = MATCH_SEARCH_MAX_LIMIT;
  }

  let offset = parseInt(req.query.offset, 10);
  if (!Number.isFinite(offset) || offset < 0) {
    offset = 0;
  }

  const fetchLimit = limit + 1;
  let rows;
  if (!query) {
    rows = await dbconn.executeMysqlQuery(queries.RECENT_MATCHES, [fetchLimit, offset]);
  } else {
    const searchTerm = `%${query}%`;
    rows = await dbconn.executeMysqlQuery(queries.SEARCH_MATCHES, [
      searchTerm,
      searchTerm,
      searchTerm,
      fetchLimit,
      offset
    ]);
  }

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const transformedMatches = await transformMatchesBatch(pageRows);
  res.status(200).json({ matches: transformedMatches, hasMore });
};

exports.createMatch = async (req, res) => {
  const { event_id, player_ids, songs, winner_id, player_stats, round } = req.body;
  console.log(`Creating new match for event: ${event_id}`);
  
  if (!event_id) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  
  // Validate players based on whether songs are provided
  let uniquePlayerIds = new Set();
  let validSongsCount = 0;
  if (songs && Array.isArray(songs) && songs.length > 0) {
    // Extract unique player IDs from song player_scores (only from songs with song_id, matching insertion logic)
    for (const songData of songs) {
      if (songData && songData.song_id && songData.player_scores && Array.isArray(songData.player_scores)) {
        validSongsCount++;
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
    if (!player_ids || !Array.isArray(player_ids)) {
      return res.status(400).json({ message: 'At least 2 player IDs are required when no songs are provided' });
    }
    // Store player_ids for later use (deduplicate via Set)
    player_ids.forEach(id => uniquePlayerIds.add(Number(id)));
    // Validate after deduplication to ensure at least 2 unique players
    if (uniquePlayerIds.size < 2) {
      return res.status(400).json({ message: 'At least 2 unique player IDs are required when no songs are provided' });
    }
  }
  
  const createdBy = req.userData?.userId || null;
  
  // Create the match
  const result = await dbconn.executeMysqlQuery(queries.CREATE_MATCH, [
    event_id,
    winner_id || null,
    round || null,
    createdBy
  ]);
  console.log(JSON.stringify(result));
  const matchId = result.insertId;
  
  // Insert player-song-score combinations into match_x_player_x_song table
  let validSongsInserted = false;
  if (songs && Array.isArray(songs) && songs.length > 0) {
    for (let songIndex = 0; songIndex < songs.length; songIndex++) {
      const songData = songs[songIndex];
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
              songIndex + 1, // song_order is 1-indexed
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
        null, // no song_order
        null, // no chart
        null, // no score
        winner_id && Number(winner_id) === Number(playerId) ? 1 : 0,
        createdBy
      ]);
    }
  }
  
  // Handle W-L-D stats
  let wldStats = new Map();
  const playerIdsArray = Array.from(uniquePlayerIds);
  
  if (validSongsCount > 0) {
    // If songs exist, calculate W-L-D from songs (mandatory)
    wldStats = calculateWLDFromSongs(songs, uniquePlayerIds);
    
    // Validate that W-L-D sums match number of songs
    for (const playerId of playerIdsArray) {
      const stats = wldStats.get(playerId);
      if (stats) {
        const total = stats.wins + stats.losses + stats.draws;
        if (total !== validSongsCount) {
          return res.status(400).json({ 
            message: `W-L-D totals for player ${playerId} (${total}) do not match number of songs (${validSongsCount})` 
          });
        }
      }
    }
  } else if (player_stats && Array.isArray(player_stats) && player_stats.length > 0) {
    // If no songs, use provided player_stats
    for (const stat of player_stats) {
      if (stat && stat.player_id) {
        const playerId = Number(stat.player_id);
        if (uniquePlayerIds.has(playerId)) {
          wldStats.set(playerId, {
            wins: stat.wins || 0,
            losses: stat.losses || 0,
            draws: stat.draws || 0
          });
        }
      }
    }
  } else {
    // No songs and no player_stats - initialize with zeros
    playerIdsArray.forEach(playerId => {
      wldStats.set(playerId, { wins: 0, losses: 0, draws: 0 });
    });
  }
  
  // Insert W-L-D stats into database
  for (const playerId of playerIdsArray) {
    const stats = wldStats.get(playerId) || { wins: 0, losses: 0, draws: 0 };
    await dbconn.executeMysqlQuery(queries.CREATE_MATCH_PLAYER_STATS, [
      matchId,
      playerId,
      stats.wins,
      stats.losses,
      stats.draws,
      createdBy
    ]);
  }
  
  const newMatch = await dbconn.executeMysqlQuery(queries.GET_MATCH_BY_ID, [matchId]);
  console.log(JSON.stringify(newMatch));
  const transformedMatch = await transformMatchResult(newMatch[0]);
  res.status(201).json(transformedMatch);
};

exports.updateMatch = async (req, res) => {
  const matchId = req.params.id;
  const { event_id, player_ids, songs, winner_id, player_stats, round } = req.body;
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
  let validSongsCount = 0;
  if (songs && Array.isArray(songs) && songs.length > 0) {
    // Extract unique player IDs from song player_scores (only from songs with song_id, matching insertion logic)
    for (const songData of songs) {
      if (songData && songData.song_id && songData.player_scores && Array.isArray(songData.player_scores)) {
        validSongsCount++;
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
    if (!player_ids || !Array.isArray(player_ids)) {
      return res.status(400).json({ message: 'At least 2 player IDs are required when no songs are provided' });
    }
    // Store player_ids for later use (deduplicate via Set)
    player_ids.forEach(id => uniquePlayerIds.add(Number(id)));
    // Validate after deduplication to ensure at least 2 unique players
    if (uniquePlayerIds.size < 2) {
      return res.status(400).json({ message: 'At least 2 unique player IDs are required when no songs are provided' });
    }
  }
  
  // Update the match
  await dbconn.executeMysqlQuery(queries.UPDATE_MATCH, [
    event_id,
    winner_id || null,
    round || null,
    matchId
  ]);
  
  // Delete existing player-song combinations and insert new ones
  await dbconn.executeMysqlQuery(queries.DELETE_MATCH_PLAYER_SONGS, [matchId]);
  const createdBy = req.userData?.userId || null;
  
  // Insert player-song-score combinations into match_x_player_x_song table
  let validSongsInserted = false;
  if (songs && Array.isArray(songs) && songs.length > 0) {
    for (let songIndex = 0; songIndex < songs.length; songIndex++) {
      const songData = songs[songIndex];
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
              songIndex + 1, // song_order is 1-indexed
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
        null, // no song_order
        null, // no chart
        null, // no score
        winner_id && Number(winner_id) === Number(playerId) ? 1 : 0,
        createdBy
      ]);
    }
  }
  
  // Handle W-L-D stats
  let wldStats = new Map();
  const playerIdsArray = Array.from(uniquePlayerIds);
  
  if (validSongsCount > 0) {
    // If songs exist, calculate W-L-D from songs (mandatory)
    wldStats = calculateWLDFromSongs(songs, uniquePlayerIds);
    
    // Validate that W-L-D sums match number of songs
    for (const playerId of playerIdsArray) {
      const stats = wldStats.get(playerId);
      if (stats) {
        const total = stats.wins + stats.losses + stats.draws;
        if (total !== validSongsCount) {
          return res.status(400).json({ 
            message: `W-L-D totals for player ${playerId} (${total}) do not match number of songs (${validSongsCount})` 
          });
        }
      }
    }
  } else if (player_stats && Array.isArray(player_stats) && player_stats.length > 0) {
    // If no songs, use provided player_stats
    for (const stat of player_stats) {
      if (stat && stat.player_id) {
        const playerId = Number(stat.player_id);
        if (uniquePlayerIds.has(playerId)) {
          wldStats.set(playerId, {
            wins: stat.wins || 0,
            losses: stat.losses || 0,
            draws: stat.draws || 0
          });
        }
      }
    }
  } else {
    // No songs and no player_stats - initialize with zeros
    playerIdsArray.forEach(playerId => {
      wldStats.set(playerId, { wins: 0, losses: 0, draws: 0 });
    });
  }
  
  // Delete existing W-L-D stats and insert new ones
  await dbconn.executeMysqlQuery(queries.DELETE_MATCH_PLAYER_STATS, [matchId]);
  
  // Insert W-L-D stats into database
  for (const playerId of playerIdsArray) {
    const stats = wldStats.get(playerId) || { wins: 0, losses: 0, draws: 0 };
    await dbconn.executeMysqlQuery(queries.CREATE_MATCH_PLAYER_STATS, [
      matchId,
      playerId,
      stats.wins,
      stats.losses,
      stats.draws,
      createdBy
    ]);
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

exports.getMatchesByPlayer = async (req, res) => {
  const playerId = req.params.playerId;
  console.log(`Fetching matches for player: ${playerId}`);
  const matches = await dbconn.executeMysqlQuery(queries.GET_MATCHES_BY_PLAYER, [playerId]);
  // Transform matches in batch (5 queries total instead of ~5 per match)
  const transformedMatches = await transformMatchesBatch(matches);
  res.status(200).json(transformedMatches);
};

/**
 * Checks if a match already exists with the same round and players
 * @param {number} eventId - The event ID
 * @param {string} round - The round name
 * @param {Array<number>} playerIds - Array of player IDs (must be exactly 2)
 * @returns {Promise<boolean>} True if duplicate exists
 */
const checkDuplicateMatch = async (eventId, round, playerIds, connection) => {
  if (!playerIds || playerIds.length !== 2) {
    return false;
  }

  const existing = await dbconn.executeMysqlQuery(
    queries.CHECK_DUPLICATE_MATCH,
    [eventId, round, playerIds[0], playerIds[1]],
    connection
  );

  return existing && existing.length > 0;
};

/**
 * Calculates W-L-D stats from match scores
 * @param {Array<Object>} playerScores - Array of {playerId, score} objects
 * @param {number} winnerId - The winner's player ID
 * @returns {Map} Map of player_id -> {wins, losses, draws}
 */
const calculateStatsFromMatchScores = (playerScores, winnerId) => {
  const stats = new Map();

  // Find winner and loser scores
  const winnerScore = playerScores.find(ps => ps.playerId === winnerId)?.score || 0;
  const loserScore = playerScores.find(ps => ps.playerId !== winnerId)?.score || 0;

  // Set stats for each player
  playerScores.forEach(ps => {
    if (ps.playerId === winnerId) {
      stats.set(ps.playerId, {
        wins: winnerScore,
        losses: loserScore,
        draws: 0
      });
    } else {
      stats.set(ps.playerId, {
        wins: loserScore,
        losses: winnerScore,
        draws: 0
      });
    }
  });

  return stats;
};

/**
 * Builds payload for one match (validation, resolve players, duplicate check, no DB inserts).
 * Resolves players by gamertag and creates new player records when they don't exist.
 * @returns {Promise<Object>} { ok: true, matchRow, playerSongRows, statsRows, playersCreated } or { ok: false, skipped, duplicate?, error, playersCreated? }
 */
const buildMatchPayload = async (setData, eventId, createdBy, playerCache, connection) => {
  let playersCreated = 0;
  try {
    if (!setData.id) {
      return { ok: false, skipped: true, error: { matchId: setData.id || 'unknown', message: 'Match ID is required', data: setData } };
    }
    if (setData.state !== 3) {
      return { ok: false, skipped: true, error: { matchId: setData.id, message: `Match not completed (state: ${setData.state})`, data: setData } };
    }

    const rawSlots = setData.paginatedSlots?.nodes || setData.slots || [];
    const slots = [...rawSlots].sort(
      (a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0)
    );
    if (slots.length < 2) {
      return { ok: false, skipped: true, error: { matchId: setData.id, message: 'Match must have at least 2 players', data: setData } };
    }

    const playerIds = [];
    const playerScores = [];
    for (const slot of slots) {
      if (!slot.entrant || !slot.entrant.name) {
        return { ok: false, skipped: true, error: { matchId: setData.id, message: 'Player entrant name is required', data: setData } };
      }
      const rawGamertag = slot.entrant.name.trim();
      const cleanedGamertag = cleanGamertag(rawGamertag);
      const score = slot.standing?.stats?.score?.value ?? 0;
      const { playerId, created } = await resolvePlayer(cleanedGamertag, createdBy, playerCache, connection);
      if (created) playersCreated++;
      playerIds.push(playerId);
      playerScores.push({ playerId, score });
    }

    if (playerIds.length !== 2) {
      return { ok: false, skipped: true, error: { matchId: setData.id, message: `Expected exactly 2 players, found ${playerIds.length}`, data: setData } };
    }

    const round = setData.fullRoundText || setData.identifier || null;
    const isDuplicate = await checkDuplicateMatch(eventId, round, playerIds, connection);
    if (isDuplicate) {
      return { ok: false, skipped: true, duplicate: true, playersCreated, error: { matchId: setData.id, message: `Duplicate match found (round: ${round}, players: ${playerIds.join(', ')})`, data: setData } };
    }

    let winnerId = null;
    if (setData.winnerId) {
      const winnerSlot = slots.find(slot => slot.entrant?.id === setData.winnerId);
      if (winnerSlot?.entrant?.name) {
        const cleanedWinnerGamertag = cleanGamertag(winnerSlot.entrant.name.trim());
        const resolved = await resolvePlayer(cleanedWinnerGamertag, createdBy, playerCache, connection);
        winnerId = resolved.playerId;
        if (resolved.created) playersCreated++;
      }
    }
    if (!winnerId && playerScores.length === 2) {
      const score1 = playerScores[0].score;
      const score2 = playerScores[1].score;
      if (score1 > score2) winnerId = playerScores[0].playerId;
      else if (score2 > score1) winnerId = playerScores[1].playerId;
    }

    const stats = calculateStatsFromMatchScores(playerScores, winnerId);
    const matchRow = [eventId, winnerId, round, createdBy];
    const playerSongRows = playerIds.map(playerId => [
      playerId,
      null, null, null, null,
      winnerId && Number(winnerId) === Number(playerId) ? 1 : 0,
      createdBy
    ]);
    const statsRows = [];
    for (const [playerId, playerStats] of stats.entries()) {
      statsRows.push([playerId, playerStats.wins, playerStats.losses, playerStats.draws, createdBy]);
    }
    return { ok: true, matchRow, playerSongRows, statsRows, playersCreated };
  } catch (error) {
    console.error(`Error building payload for match ${setData.id}:`, error);
    return { ok: false, skipped: true, playersCreated, error: { matchId: setData.id, message: error.message, data: setData } };
  }
};

async function executeMatchPayloadBatchInsert(matchRows, payloads, connection) {
  if (matchRows.length === 0) {
    return;
  }
  const matchResult = await dbconn.executeMysqlQuery(
    queries.CREATE_MATCH_BATCH(matchRows.length),
    matchRows.flat(),
    connection
  );
  const firstInsertId = matchResult.insertId;

  const allPlayerSongRows = [];
  const allStatsRows = [];
  for (let i = 0; i < payloads.length; i++) {
    const matchId = firstInsertId + i;
    const { playerSongRows, statsRows } = payloads[i];
    for (const row of playerSongRows) {
      allPlayerSongRows.push([matchId, ...row]);
    }
    for (const row of statsRows) {
      allStatsRows.push([matchId, ...row]);
    }
  }

  if (allPlayerSongRows.length > 0) {
    await dbconn.executeMysqlQuery(
      queries.CREATE_MATCH_PLAYER_SONGS_BATCH(allPlayerSongRows.length),
      allPlayerSongRows.flat(),
      connection
    );
  }
  if (allStatsRows.length > 0) {
    await dbconn.executeMysqlQuery(
      queries.CREATE_MATCH_PLAYER_STATS_BATCH(allStatsRows.length),
      allStatsRows.flat(),
      connection
    );
  }
}

/**
 * Import completed sets from start.gg (bracket-aware round labels). Used by start.gg full import.
 * @param {Array<object>} sets
 * @param {number} eventId
 * @param {number|null} createdBy
 */
/**
 * @param {import('mysql').Connection} [connection] when provided, all DB work uses this transaction
 */
exports.importMatchesFromStartGgSets = async (sets, eventId, createdBy, connection) => {
  const playerCache = new Map();
  await prePopulatePlayerCache(playerCache, connection);

  const matchRows = [];
  const payloads = [];
  const summary = {
    totalMatches: sets.length,
    matchesCreated: 0,
    matchesSkipped: 0,
    duplicatesSkipped: 0,
    playersCreated: 0,
    errors: [],
  };

  for (const set of sets) {
    const augmented = augmentStartGgSetForMatchImport(set);
    const payload = await buildMatchPayload(augmented, eventId, createdBy, playerCache, connection);
    summary.playersCreated += payload.playersCreated || 0;
    if (payload.ok) {
      matchRows.push(payload.matchRow);
      payloads.push({ playerSongRows: payload.playerSongRows, statsRows: payload.statsRows });
    } else {
      summary.matchesSkipped++;
      if (payload.duplicate) summary.duplicatesSkipped++;
      if (payload.error) summary.errors.push(payload.error);
    }
  }

  if (matchRows.length > 0) {
    await executeMatchPayloadBatchInsert(matchRows, payloads, connection);
    summary.matchesCreated = matchRows.length;
  }

  return summary;
};

/**
 * Bulk import matches from Start.gg JSON response
 */
exports.bulkImportMatches = async (req, res) => {
  const eventId = req.params.eventId;
  console.log(`Bulk importing matches for event ${eventId}`);

  // Validate event exists
  const event = await dbconn.executeMysqlQuery(eventQueries.GET_EVENT_BY_ID, [eventId]);
  if (!event || event.length < 1) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ message: 'JSON file is required' });
  }

  let jsonData;
  try {
    // Parse JSON file
    const fileContent = req.file.buffer.toString('utf8');
    jsonData = JSON.parse(fileContent);
  } catch (error) {
    console.error('JSON parsing error:', error);
    return res.status(400).json({ message: 'Invalid JSON file format', error: error.message });
  }

  // Extract sets from Start.gg response structure
  // The structure is: [{data: {event: {sets: {nodes: [...]}}}}]
  let sets = [];
  if (Array.isArray(jsonData) && jsonData.length > 0) {
    const firstItem = jsonData[0];
    if (firstItem?.data?.event?.sets?.nodes) {
      sets = firstItem.data.event.sets.nodes;
    } else if (firstItem?.data?.event?.sets && Array.isArray(firstItem.data.event.sets)) {
      sets = firstItem.data.event.sets;
    }
  } else if (jsonData?.data?.event?.sets?.nodes) {
    sets = jsonData.data.event.sets.nodes;
  } else if (jsonData?.data?.event?.sets && Array.isArray(jsonData.data.event.sets)) {
    sets = jsonData.data.event.sets;
  } else if (Array.isArray(jsonData)) {
    // Assume it's a direct array of sets
    sets = jsonData;
  }

  if (!sets || sets.length === 0) {
    return res.status(400).json({ 
      message: 'No match data found in JSON file. Expected structure: [{data: {event: {sets: {nodes: [...]}}}}]' 
    });
  }

  const createdBy = req.userData?.userId || null;
  const playerCache = new Map(); // Cache normalized gamertag -> playerId mappings
  await prePopulatePlayerCache(playerCache);

  // Pass 1: build payloads for each set (resolve players—creating new players as needed—check duplicates); collect rows for batch insert
  const matchRows = [];
  const payloads = [];
  const summary = {
    totalMatches: sets.length,
    matchesCreated: 0,
    matchesSkipped: 0,
    duplicatesSkipped: 0,
    playersCreated: 0,
    errors: []
  };

  for (const set of sets) {
    const payload = await buildMatchPayload(set, eventId, createdBy, playerCache, undefined);
    summary.playersCreated += payload.playersCreated || 0;
    if (payload.ok) {
      matchRows.push(payload.matchRow);
      payloads.push({ playerSongRows: payload.playerSongRows, statsRows: payload.statsRows });
    } else {
      summary.matchesSkipped++;
      if (payload.duplicate) summary.duplicatesSkipped++;
      if (payload.error) summary.errors.push(payload.error);
    }
  }

  // Pass 2: one batch insert per table (only if we have matches to insert)
  if (matchRows.length > 0) {
    await executeMatchPayloadBatchInsert(matchRows, payloads, undefined);
    summary.matchesCreated = matchRows.length;
  }

  res.status(200).json({
    message: 'Bulk import completed',
    summary: {
      totalMatches: summary.totalMatches,
      matchesCreated: summary.matchesCreated,
      matchesSkipped: summary.matchesSkipped,
      duplicatesSkipped: summary.duplicatesSkipped,
      playersCreated: summary.playersCreated,
      errors: summary.errors.length
    },
    errors: summary.errors.length > 0 ? summary.errors : undefined
  });
};


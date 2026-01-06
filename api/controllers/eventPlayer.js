const dbconn = require('../database/connector');
const queries = require('../queries/eventPlayer');
const playerQueries = require('../queries/player');
const eventQueries = require('../queries/event');
const { parse } = require('csv-parse/sync');

exports.addPlayerToEvent = async (req, res) => {
  const { event_id, player_id, seed, place } = req.body;
  console.log(`Adding player ${player_id} to event ${event_id}`);
  if (!event_id || !player_id) {
    return res.status(400).json({ message: 'Event ID and Player ID are required' });
  }
  // Check if player is already in event
  const existing = await dbconn.executeMysqlQuery(queries.GET_EVENT_PLAYER_BY_EVENT_AND_PLAYER, [event_id, player_id]);
  if (existing && existing.length > 0) {
    return res.status(409).json({ message: 'Player is already in this event', eventPlayer: existing[0] });
  }
  const createdBy = req.userData?.userId || null;
  const result = await dbconn.executeMysqlQuery(queries.ADD_PLAYER_TO_EVENT, [event_id, player_id, seed || null, place || null, createdBy]);
  const newEventPlayer = await dbconn.executeMysqlQuery(queries.GET_EVENT_PLAYER_BY_ID, [result.insertId]);
  res.status(201).json(newEventPlayer[0]);
};

exports.updateEventPlayer = async (req, res) => {
  const eventPlayerId = req.params.id;
  const { seed, place } = req.body;
  console.log(`Updating event player with id: ${eventPlayerId}`);
  const eventPlayer = await dbconn.executeMysqlQuery(queries.GET_EVENT_PLAYER_BY_ID, [eventPlayerId]);
  if (!eventPlayer || eventPlayer.length < 1) {
    return res.status(404).json({ message: 'Event player not found' });
  }
  await dbconn.executeMysqlQuery(queries.UPDATE_EVENT_PLAYER, [
    seed !== undefined ? seed : eventPlayer[0].seed,
    place !== undefined ? place : eventPlayer[0].placement,
    eventPlayerId
  ]);
  const updatedEventPlayer = await dbconn.executeMysqlQuery(queries.GET_EVENT_PLAYER_BY_ID, [eventPlayerId]);
  res.status(200).json(updatedEventPlayer[0]);
};

exports.removePlayerFromEvent = async (req, res) => {
  const eventPlayerId = req.params.id;
  console.log(`Removing event player with id: ${eventPlayerId}`);
  const eventPlayer = await dbconn.executeMysqlQuery(queries.GET_EVENT_PLAYER_BY_ID, [eventPlayerId]);
  if (!eventPlayer || eventPlayer.length < 1) {
    return res.status(404).json({ message: 'Event player not found' });
  }
  
  // Store player_id before deletion to check for orphaned player
  const playerId = eventPlayer[0].player_id;
  
  // Remove player from event
  await dbconn.executeMysqlQuery(queries.REMOVE_PLAYER_FROM_EVENT, [eventPlayerId]);
  
  // Check if player is orphaned (not in any other events)
  const remainingEventPlayers = await dbconn.executeMysqlQuery(queries.COUNT_EVENT_PLAYERS_BY_PLAYER_ID, [playerId]);
  const eventPlayerCount = remainingEventPlayers[0]?.count || 0;
  
  // If player is not in any events, delete the player record
  if (eventPlayerCount === 0) {
    console.log(`Player ${playerId} is orphaned (not in any events), deleting player record`);
    await dbconn.executeMysqlQuery(playerQueries.DELETE_PLAYER, [playerId]);
    res.status(200).json({ 
      message: 'Player removed from event successfully and player record deleted (no longer in any events)',
      playerDeleted: true
    });
  } else {
    res.status(200).json({ 
      message: 'Player removed from event successfully',
      playerDeleted: false
    });
  }
};

/**
 * Process a single row from the CSV import
 * @param {Object} row - The CSV row data
 * @param {number} rowNumber - The row number (for error reporting)
 * @param {number} eventId - The event ID to add players to
 * @param {number|null} createdBy - The user ID creating the records
 * @returns {Promise<Object>} Result object with status and details
 */
const processImportRow = async (row, rowNumber, eventId, createdBy) => {
  const gamertag = row['Player Short GamerTag'];
  const placement = row['Event Placement'];

  // Validate required fields
  if (!gamertag || gamertag === '') {
    return {
      success: false,
      skipped: true,
      error: {
        row: rowNumber,
        message: 'Player Short GamerTag is required',
        data: row
      }
    };
  }

  try {
    // Check if player exists
    let players = await dbconn.executeMysqlQuery(playerQueries.GET_PLAYER_BY_USERNAME, [gamertag]);
    let playerId;
    let playerCreated = false;

    if (!players || players.length === 0) {
      // Create new player
      const result = await dbconn.executeMysqlQuery(playerQueries.CREATE_PLAYER, [gamertag, null, createdBy]);
      playerId = result.insertId;
      playerCreated = true;
      console.log(`Created new player: ${gamertag} (ID: ${playerId})`);
    } else {
      playerId = players[0].id;
      console.log(`Found existing player: ${gamertag} (ID: ${playerId})`);
    }

    // Check if player is already in this event
    const existingEventPlayer = await dbconn.executeMysqlQuery(
      queries.GET_EVENT_PLAYER_BY_EVENT_AND_PLAYER, 
      [eventId, playerId]
    );

    if (existingEventPlayer && existingEventPlayer.length > 0) {
      // Player already in event, skip
      console.log(`Player ${gamertag} already in event, skipping`);
      return {
        success: false,
        skipped: true,
        error: {
          row: rowNumber,
          message: 'Player already in event',
          data: row
        }
      };
    }

    // Add player to event with seed=-1 and placement from CSV
    const placementValue = placement && placement.trim() !== '' ? placement.trim() : null;
    await dbconn.executeMysqlQuery(
      queries.ADD_PLAYER_TO_EVENT, 
      [eventId, playerId, -1, placementValue, createdBy]
    );
    console.log(`Added player ${gamertag} to event ${eventId} with placement ${placementValue}`);

    return {
      success: true,
      skipped: false,
      playerCreated: playerCreated,
      playerAdded: true
    };

  } catch (error) {
    console.error(`Error processing row ${rowNumber}:`, error);
    return {
      success: false,
      skipped: true,
      error: {
        row: rowNumber,
        message: error.message,
        data: row
      }
    };
  }
};

exports.bulkImportPlayers = async (req, res) => {
  const eventId = req.params.eventId;
  console.log(`Bulk importing players for event ${eventId}`);
  
  // Validate event exists
  const event = await dbconn.executeMysqlQuery(eventQueries.GET_EVENT_BY_ID, [eventId]);
  if (!event || event.length < 1) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ message: 'CSV file is required' });
  }

  let records;
  try {
    // Parse CSV file
    records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (error) {
    console.error('CSV parsing error:', error);
    return res.status(400).json({ message: 'Invalid CSV file format', error: error.message });
  }

  if (!records || records.length === 0) {
    return res.status(400).json({ message: 'CSV file is empty or contains no data' });
  }

  // Validate required columns exist
  const requiredColumns = ['Player Short GamerTag', 'Event Placement'];
  const firstRecord = records[0];
  const missingColumns = requiredColumns.filter(col => !(col in firstRecord));
  if (missingColumns.length > 0) {
    return res.status(400).json({ 
      message: 'CSV file is missing required columns', 
      missingColumns 
    });
  }

  const createdBy = req.userData?.userId || null;
  
  // Process all rows in parallel using Promise.allSettled to handle all results
  const rowPromises = records.map((row, index) => {
    const rowNumber = index + 2; // +2 because row 1 is header, and arrays are 0-indexed
    return processImportRow(row, rowNumber, eventId, createdBy);
  });

  // Wait for all rows to be processed
  const results = await Promise.allSettled(rowPromises);
  
  // Aggregate results
  const summary = {
    created: 0,
    added: 0,
    skipped: 0,
    errors: []
  };

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const rowResult = result.value;
      if (rowResult.success) {
        if (rowResult.playerCreated) {
          summary.created++;
        }
        if (rowResult.playerAdded) {
          summary.added++;
        }
      } else {
        summary.skipped++;
        if (rowResult.error) {
          summary.errors.push(rowResult.error);
        }
      }
    } else {
      // Handle promise rejection (shouldn't happen with our error handling, but just in case)
      summary.skipped++;
      summary.errors.push({
        row: index + 2,
        message: result.reason?.message || 'Unknown error processing row',
        data: records[index]
      });
    }
  });

  res.status(200).json({
    message: 'Bulk import completed',
    summary: {
      totalRows: records.length,
      playersCreated: summary.created,
      playersAddedToEvent: summary.added,
      rowsSkipped: summary.skipped,
      errors: summary.errors.length
    },
    errors: summary.errors.length > 0 ? summary.errors : undefined
  });
};


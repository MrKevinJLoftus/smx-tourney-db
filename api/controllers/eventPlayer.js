const dbconn = require('../database/connector');
const queries = require('../queries/eventPlayer');
const playerQueries = require('../queries/player');

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


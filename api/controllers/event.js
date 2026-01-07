const dbconn = require('../database/connector');
const queries = require('../queries/event');

exports.getAllEvents = async (req, res) => {
  console.log('Fetching all events');
  const events = await dbconn.executeMysqlQuery(queries.GET_ALL_EVENTS, []);
  res.status(200).json(events);
};

exports.getEventById = async (req, res) => {
  const eventId = req.params.id;
  console.log(`Fetching event with id: ${eventId}`);
  const events = await dbconn.executeMysqlQuery(queries.GET_EVENT_BY_ID, [eventId]);
  if (!events || events.length < 1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  res.status(200).json(events[0]);
};

exports.searchEvents = async (req, res) => {
  const query = req.query.q || req.query.query || '';
  console.log(`Searching events with query: ${query}`);
  if (!query || query.trim().length === 0) {
    // If no query, return recent events (limited)
    const events = await dbconn.executeMysqlQuery(queries.GET_ALL_EVENTS, []);
    res.status(200).json(events.slice(0, 50)); // Limit to 50 for performance
    return;
  }
  const searchTerm = `%${query.trim()}%`;
  const events = await dbconn.executeMysqlQuery(queries.SEARCH_EVENTS, [
    searchTerm,
    searchTerm,
    searchTerm,
    searchTerm
  ]);
  res.status(200).json(events);
};

exports.createEvent = async (req, res) => {
  const { name, date, description, location, organizers } = req.body;
  console.log(`Creating new event: ${name}`);
  if (!name || !date) {
    return res.status(400).json({ message: 'Event name and date are required' });
  }
  const createdBy = req.userData?.userId || null;
  const result = await dbconn.executeMysqlQuery(queries.CREATE_EVENT, [
    name, 
    date, 
    description || null, 
    location || null, 
    organizers || null,
    createdBy
  ]);
  const newEvent = await dbconn.executeMysqlQuery(queries.GET_EVENT_BY_ID, [result.insertId]);
  res.status(201).json(newEvent[0]);
};

exports.updateEvent = async (req, res) => {
  const eventId = req.params.id;
  const { name, date, description, location, organizers } = req.body;
  console.log(`Updating event with id: ${eventId}`);
  if (!name || !date) {
    return res.status(400).json({ message: 'Event name and date are required' });
  }
  await dbconn.executeMysqlQuery(queries.UPDATE_EVENT, [
    name, 
    date, 
    description || null, 
    location || null, 
    organizers || null, 
    eventId
  ]);
  const updatedEvent = await dbconn.executeMysqlQuery(queries.GET_EVENT_BY_ID, [eventId]);
  if (!updatedEvent || updatedEvent.length < 1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  res.status(200).json(updatedEvent[0]);
};

exports.deleteEvent = async (req, res) => {
  const eventId = req.params.id;
  console.log(`Deleting event with id: ${eventId}`);
  const event = await dbconn.executeMysqlQuery(queries.GET_EVENT_BY_ID, [eventId]);
  if (!event || event.length < 1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  await dbconn.executeMysqlQuery(queries.DELETE_EVENT, [eventId]);
  res.status(200).json({ message: 'Event deleted successfully' });
};


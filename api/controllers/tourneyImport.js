const dbconn = require('../database/connector');
const matchQueries = require('../queries/match');
const eventPlayerQueries = require('../queries/eventPlayer');
const queries = require('../queries/tourneyImport');
const blamethepads = require('../services/blamethepadsClient');
const ddrTools = require('../services/ddrToolsClient');
const {
  normalizeBlamethepadsTourney,
  normalizeDdrToolsRoom,
  linkedTourneyIds,
} = require('../services/tourneyImportNormalizer');
const { createChartResolver, modeFor } = require('../services/chartResolver');
const {
  cleanGamertag,
  normalizeGamertag,
  resolvePlayer,
  prePopulatePlayerCache,
} = require('../services/playerResolver');
const { determineSongWinner, calculateWLDFromSongs } = require('../services/matchScoring');
const { rebuildRatingsAfterMatchImport } = require('../services/ratingService');

const SOURCES = ['blamethepads', 'ddrtools'];

function playerKey(name) {
  return normalizeGamertag(cleanGamertag(name));
}

/**
 * Fetches the source and normalizes it into an ImportPlan (see tourneyImportNormalizer).
 * @returns {Promise<{ events: Array<object>, warnings: string[] }>}
 */
async function loadPlan(source, ref) {
  const warnings = [];

  if (source === 'blamethepads') {
    const tourneyId = blamethepads.parseTourneyId(ref);
    const data = await blamethepads.fetchTourneyForImport(tourneyId);
    return { ...normalizeBlamethepadsTourney(data), warnings };
  }

  const room = ddrTools.parseRoomCode(ref);
  const state = await ddrTools.fetchRoomState(room);
  const linkedIds = linkedTourneyIds(state);
  const linkedTourneys = new Map();
  if (linkedIds.length) {
    if (blamethepads.isConfigured()) {
      try {
        const rows = await blamethepads.fetchTourneysByIds(linkedIds);
        for (const row of rows || []) linkedTourneys.set(String(row.id), row);
      } catch (e) {
        warnings.push(`Could not load blamethepads tourney names (${e.message}); using placeholder event names.`);
      }
    } else {
      warnings.push('blamethepads is not configured, so linked draws use placeholder event names and no event date.');
    }
  }
  return { ...normalizeDdrToolsRoom(state, room, linkedTourneys), warnings };
}

/**
 * Marks what already exists locally and resolves charts, without writing anything.
 * Annotates events and matches in place.
 * @param {{ events: Array<object> }} plan
 * @param {import('mysql').Connection} [connection]
 */
async function annotatePlan(plan, connection) {
  const resolver = await createChartResolver(connection);
  const playerCache = new Map();
  await prePopulatePlayerCache(playerCache, connection);

  const allMatches = plan.events.flatMap((e) => e.matches);
  const existingByKey = new Map();
  if (allMatches.length) {
    const sql = queries.GET_MATCH_EXTERNAL_SOURCES_BY_KEYS(allMatches.length);
    const params = allMatches.flatMap((m) => [m.source, m.sourceKey]);
    const rows = await dbconn.executeMysqlQuery(sql, params, connection);
    for (const row of rows || []) {
      existingByKey.set(`${row.source}|${row.source_key}`, row.match_id);
    }
  }

  for (const event of plan.events) {
    const existing = await dbconn.executeMysqlQuery(
      queries.GET_EVENT_BY_EXTERNAL_SOURCE_ID,
      [event.externalSource, event.externalId],
      connection
    );
    event.localEventId = existing && existing[0] ? existing[0].id : null;

    for (const player of event.players) {
      player.exists = playerCache.has(playerKey(player.name));
    }

    const unresolved = new Map();
    const counts = { toImport: 0, alreadyImported: 0, skipped: 0 };
    for (const match of event.matches) {
      const localMatchId = existingByKey.get(`${match.source}|${match.sourceKey}`) || null;
      match.alreadyImported = !!localMatchId;
      match.localMatchId = localMatchId;

      for (const chart of match.charts) {
        const res = resolver.resolve(chart);
        chart.songId = res.songId;
        chart.chartId = res.chartId;
        chart.resolved = res.resolved;
        chart.unresolvedReason = res.reason || null;
        chart.label = [modeFor(chart.diffClass, chart.plus), chart.level].filter(Boolean).join(' ');
        if (!res.resolved) {
          const key = `${chart.title}|${chart.artist}|${chart.label}`;
          if (!unresolved.has(key)) {
            unresolved.set(key, { title: chart.title, artist: chart.artist, label: chart.label, reason: res.reason });
          }
        }
      }

      if (match.alreadyImported) counts.alreadyImported++;
      else if (match.skipReason || event.blocker) counts.skipped++;
      else counts.toImport++;
    }
    event.counts = counts;
    event.unresolvedCharts = [...unresolved.values()];
  }
  return plan;
}

function parseBody(req) {
  const source = req.body?.source;
  const ref = req.body?.ref;
  if (!SOURCES.includes(source)) {
    return { error: `source must be one of: ${SOURCES.join(', ')}` };
  }
  if (ref == null || !String(ref).trim()) {
    return { error: 'ref is required (tourney URL/id or ddr.tools URL/room code)' };
  }
  return { source, ref: String(ref).trim() };
}

function handleError(res, e, logLabel) {
  if (e instanceof blamethepads.BlamethepadsError || e instanceof ddrTools.DdrToolsError) {
    return res.status(e.status || 502).json({ message: e.message });
  }
  if (e.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      message: 'Some of these results were imported concurrently (duplicate key). Preview again and retry.',
    });
  }
  console.error(`${logLabel}:`, e);
  return res.status(500).json({ message: e.message || 'Import failed' });
}

/**
 * Writes one event's importable matches. Creates the local event on first import, reuses it after.
 * @returns {Promise<object>} per-event summary
 */
async function importEvent(event, createdBy, playerCache, connection) {
  const summary = {
    externalSource: event.externalSource,
    externalId: event.externalId,
    name: event.name,
    localEventId: event.localEventId,
    eventCreated: false,
    matchesImported: 0,
    matchesAlreadyImported: event.counts.alreadyImported,
    matchesSkipped: event.counts.skipped,
    eventPlayersAdded: 0,
    playersCreated: 0,
    unresolvedCharts: event.unresolvedCharts.length,
  };

  const importable = event.blocker
    ? []
    : event.matches.filter((m) => !m.alreadyImported && !m.skipReason);
  if (!importable.length) {
    return summary;
  }

  if (!event.localEventId) {
    const insert = await dbconn.executeMysqlQuery(
      queries.CREATE_EVENT_WITH_EXTERNAL_SOURCE,
      [event.name, event.date, event.description, event.location, null, createdBy, event.externalSource, event.externalId],
      connection
    );
    summary.localEventId = insert.insertId;
    summary.eventCreated = true;
  }
  const localEventId = summary.localEventId;

  const playerIdByName = new Map();
  const seedByName = new Map(event.players.map((p) => [p.name, p.seed]));
  const names = [...new Set([...event.players.map((p) => p.name), ...importable.flatMap((m) => m.players)])];
  for (const name of names) {
    const { playerId, created } = await resolvePlayer(name, createdBy, playerCache, connection);
    if (created) summary.playersCreated++;
    playerIdByName.set(name, playerId);
  }

  const addedToEvent = new Set();
  for (const name of names) {
    const playerId = playerIdByName.get(name);
    if (addedToEvent.has(playerId)) continue;
    addedToEvent.add(playerId);
    const existing = await dbconn.executeMysqlQuery(
      eventPlayerQueries.GET_EVENT_PLAYER_BY_EVENT_AND_PLAYER,
      [localEventId, playerId],
      connection
    );
    if (existing && existing.length) continue;
    await dbconn.executeMysqlQuery(
      eventPlayerQueries.ADD_PLAYER_TO_EVENT,
      [localEventId, playerId, seedByName.get(name) ?? -1, null, createdBy],
      connection
    );
    summary.eventPlayersAdded++;
  }

  for (const match of importable) {
    const matchPlayerIds = [...new Set(match.players.map((n) => playerIdByName.get(n)))];
    const winnerId = match.winnerName ? playerIdByName.get(match.winnerName) : null;

    const insert = await dbconn.executeMysqlQuery(
      matchQueries.CREATE_MATCH,
      [localEventId, winnerId || null, match.round, createdBy],
      connection
    );
    const matchId = insert.insertId;

    const songs = match.charts.map((chart) => ({
      player_scores: match.players.map((name) => ({
        player_id: playerIdByName.get(name),
        score: chart.scores[name],
      })),
    }));

    const songParams = [];
    let songRows = 0;
    match.charts.forEach((chart, index) => {
      const songWinners = determineSongWinner(songs[index].player_scores);
      for (const ps of songs[index].player_scores) {
        songParams.push(
          matchId,
          ps.player_id,
          chart.songId,
          index + 1,
          chart.chartId,
          ps.score ?? null,
          songWinners.has(ps.player_id) ? 1 : 0,
          createdBy
        );
        songRows++;
      }
    });
    if (songRows) {
      await dbconn.executeMysqlQuery(
        matchQueries.CREATE_MATCH_PLAYER_SONGS_BATCH(songRows),
        songParams,
        connection
      );
    }

    const wld = calculateWLDFromSongs(songs, new Set(matchPlayerIds));
    const statParams = matchPlayerIds.flatMap((playerId) => {
      const s = wld.get(playerId) || { wins: 0, losses: 0, draws: 0 };
      return [matchId, playerId, s.wins, s.losses, s.draws, createdBy];
    });
    await dbconn.executeMysqlQuery(
      matchQueries.CREATE_MATCH_PLAYER_STATS_BATCH(matchPlayerIds.length),
      statParams,
      connection
    );

    await dbconn.executeMysqlQuery(
      queries.CREATE_MATCH_EXTERNAL_SOURCE,
      [matchId, match.source, match.sourceKey],
      connection
    );
    summary.matchesImported++;
  }

  return summary;
}

/**
 * GET: StepManiaX tourneys on blamethepads, with local import status.
 */
exports.listBlamethepadsTourneys = async (req, res) => {
  try {
    const [tourneys, importedRows] = await Promise.all([
      blamethepads.fetchSmxTourneys(),
      dbconn.executeMysqlQuery(queries.GET_EVENTS_BY_EXTERNAL_SOURCE, ['blamethepads']),
    ]);
    const localByTourney = new Map((importedRows || []).map((r) => [String(r.external_id), r.id]));
    res.status(200).json({
      tourneys: (tourneys || []).map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status || null,
        type: t.type || null,
        startDate: t.start_date || null,
        endDate: t.end_date || null,
        eventId: t.event_id,
        eventName: t.events?.name || null,
        location: t.events?.location || null,
        ddrtoolsRoom: t.ddrtools_room || null,
        localEventId: localByTourney.get(String(t.id)) || null,
      })),
    });
  } catch (e) {
    return handleError(res, e, 'listBlamethepadsTourneys');
  }
};

/**
 * POST body: { source: 'blamethepads' | 'ddrtools', ref: string }
 * Returns the normalized plan annotated with local import status and chart resolution. Writes nothing.
 */
exports.previewTourneyImport = async (req, res) => {
  const body = parseBody(req);
  if (body.error) {
    return res.status(400).json({ message: body.error });
  }
  try {
    const plan = await loadPlan(body.source, body.ref);
    await annotatePlan(plan);
    res.status(200).json({ source: body.source, ref: body.ref, ...plan });
  } catch (e) {
    return handleError(res, e, 'previewTourneyImport');
  }
};

/**
 * POST body: { source: 'blamethepads' | 'ddrtools', ref: string }
 * Imports every match not imported before. External fetches run before the transaction; all DB writes run in one.
 */
exports.importTourney = async (req, res) => {
  const body = parseBody(req);
  if (body.error) {
    return res.status(400).json({ message: body.error });
  }
  const createdBy = req.userData?.userId || null;

  try {
    const plan = await loadPlan(body.source, body.ref);

    const events = await dbconn.withTransaction(async (connection) => {
      await annotatePlan(plan, connection);
      const playerCache = new Map();
      await prePopulatePlayerCache(playerCache, connection);
      const summaries = [];
      for (const event of plan.events) {
        summaries.push(await importEvent(event, createdBy, playerCache, connection));
      }
      return summaries;
    });

    const matchesImported = events.reduce((n, e) => n + e.matchesImported, 0);
    const ratingsRebuild = matchesImported > 0
      ? await rebuildRatingsAfterMatchImport('tourneyImport')
      : null;

    res.status(201).json({
      message: matchesImported > 0 ? 'Import completed' : 'Nothing new to import',
      source: body.source,
      ref: body.ref,
      warnings: plan.warnings,
      events,
      ratingsRebuild: matchesImported > 0
        ? ratingsRebuild || { warning: 'Player ratings rebuild failed; use Admin Panel to refresh.' }
        : null,
    });
  } catch (e) {
    return handleError(res, e, 'importTourney');
  }
};

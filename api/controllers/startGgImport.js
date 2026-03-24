const dbconn = require('../database/connector');
const eventQueries = require('../queries/event');
const eventPlayerQueries = require('../queries/eventPlayer');
const startGgDiscoveryQueries = require('../queries/startGgDiscovery');
const { parseEventSlugFromUrl } = require('../services/startGgEvent');
const { isConfigured, StartGgGraphqlError } = require('../services/startGgClient');
const { discoverNotImportedPastEvents } = require('../services/startGgDiscovery');
const {
  fetchEventForImport,
  fetchEventForImportById,
  fetchStandingsPage,
  fetchSetsPage,
  fetchAllStandings,
  fetchAllSets,
  startAtToSqlDate,
} = require('../services/startGgImportQueries');
const { resolvePlayer, prePopulatePlayerCache } = require('../services/playerResolver');
const { importMatchesFromStartGgSets } = require('./match');

const STANDINGS_PREVIEW_PER_PAGE = 25;
const SETS_PREVIEW_PER_PAGE = 10;

function stepmaniaxVideogameId() {
  return process.env.START_GG_STEPMANIAX_VIDEOGAME_ID || '33834';
}

/**
 * Shared DB + start.gg sets import after `ev` is loaded.
 * @returns {Promise<
 *   | { kind: 'ok'; startGgEventIdNum: number; slug: string; summary: object }
 *   | { kind: 'err'; status: number; body: object }
 * >}
 */
async function runFullImportFromStartGgEvent(ev, slug, createdBy) {
  const startGgEventIdNum = Number(ev.id);
  if (!Number.isFinite(startGgEventIdNum)) {
    return { kind: 'err', status: 400, body: { message: 'Invalid start.gg event id.' } };
  }

  const existing = await dbconn.executeMysqlQuery(
    eventQueries.GET_EVENT_BY_START_GG_EVENT_ID,
    [startGgEventIdNum]
  );
  if (existing && existing.length > 0) {
    return {
      kind: 'err',
      status: 409,
      body: {
        message:
          'This start.gg event has already been imported. Delete the local event first or use a different tournament.',
        startGgEventId: startGgEventIdNum,
        localEventId: existing[0].id,
      },
    };
  }

  const sqlDate = startAtToSqlDate(ev.startAt ?? ev.tournament?.startAt);
  if (!sqlDate) {
    return {
      kind: 'err',
      status: 400,
      body: {
        message:
          'Cannot import: this start.gg event has no start date. Add a date on start.gg or import manually.',
      },
    };
  }

  const tournamentName = ev.tournament?.name || '';
  const description = tournamentName
    ? `Imported from start.gg — ${tournamentName}`
    : 'Imported from start.gg';

  const standingsNodes = await fetchAllStandings(ev.id);
  const allSets = await fetchAllSets(ev.id);

  const summary = await dbconn.withTransaction(async (connection) => {
    const insertResult = await dbconn.executeMysqlQuery(
      eventQueries.CREATE_EVENT_WITH_START_GG,
      [
        ev.name,
        sqlDate,
        description,
        ev.tournament?.city || null,
        null,
        createdBy,
        startGgEventIdNum,
      ],
      connection
    );
    const localEventId = insertResult.insertId;

    const playerCache = new Map();
    await prePopulatePlayerCache(playerCache, connection);

    let playersCreatedFromStandings = 0;
    let eventPlayersAdded = 0;
    let eventPlayersSkipped = 0;

    for (const row of standingsNodes) {
      const name = row.entrant?.name;
      if (!name || !String(name).trim()) {
        continue;
      }
      const placement = row.placement != null ? String(row.placement) : null;

      const { playerId, created } = await resolvePlayer(
        name.trim(),
        createdBy,
        playerCache,
        connection
      );
      if (created) {
        playersCreatedFromStandings++;
      }

      const epExisting = await dbconn.executeMysqlQuery(
        eventPlayerQueries.GET_EVENT_PLAYER_BY_EVENT_AND_PLAYER,
        [localEventId, playerId],
        connection
      );
      if (epExisting && epExisting.length > 0) {
        eventPlayersSkipped++;
        continue;
      }

      await dbconn.executeMysqlQuery(
        eventPlayerQueries.ADD_PLAYER_TO_EVENT,
        [localEventId, playerId, -1, placement, createdBy],
        connection
      );
      eventPlayersAdded++;
    }

    const matchSummary = await importMatchesFromStartGgSets(
      allSets,
      localEventId,
      createdBy,
      connection
    );

    return {
      localEventId,
      standingsRows: standingsNodes.length,
      eventPlayersAdded,
      eventPlayersSkipped,
      playersCreatedFromStandings,
      setsFetched: allSets.length,
      matches: matchSummary,
    };
  });

  return {
    kind: 'ok',
    startGgEventIdNum,
    slug,
    summary,
  };
}

function sendImportSuccess(res, slug, startGgEventIdNum, summary) {
  res.status(201).json({
    message: 'Import completed',
    slug,
    startGgEventId: startGgEventIdNum,
    localEventId: summary.localEventId,
    summary: {
      standingsRows: summary.standingsRows,
      eventPlayersAdded: summary.eventPlayersAdded,
      eventPlayersSkipped: summary.eventPlayersSkipped,
      playersCreatedFromStandings: summary.playersCreatedFromStandings,
      setsFetched: summary.setsFetched,
      matches: summary.matches,
    },
  });
}

function handleImportException(res, e, logLabel) {
  if (e instanceof StartGgGraphqlError) {
    return res.status(502).json({
      message: e.message || 'start.gg API error',
    });
  }
  if (e.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      message: 'This start.gg event has already been imported (duplicate key).',
    });
  }
  console.error(`${logLabel}:`, e);
  return res.status(500).json({
    message: e.message || 'Import failed',
  });
}

/**
 * POST body: { url: string }
 * Fetches start.gg event metadata plus first pages of standings and sets (for admin preview / upcoming full import).
 */
exports.previewStartGgEvent = async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ message: 'url is required' });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      message:
        'start.gg API is not configured (set START_GG_API_KEY on the server).',
    });
  }

  let slug;
  try {
    slug = parseEventSlugFromUrl(url.trim());
  } catch (e) {
    return res.status(400).json({
      message: e.message || 'Could not parse start.gg tournament/event from the URL.',
    });
  }

  try {
    const data = await fetchEventForImport(url.trim());
    if (!data || !data.event) {
      return res.status(404).json({
        message: 'No event found on start.gg for this URL.',
      });
    }

    const ev = data.event;
    const [standingsData, setsData] = await Promise.all([
      fetchStandingsPage(ev.id, 1, STANDINGS_PREVIEW_PER_PAGE),
      fetchSetsPage(ev.id, 1, SETS_PREVIEW_PER_PAGE),
    ]);

    const standings = standingsData.event?.standings;
    const sets = setsData.event?.sets;

    const suggestedLocalDate = startAtToSqlDate(ev.startAt ?? ev.tournament?.startAt);

    res.status(200).json({
      slug,
      startGgEventId: ev.id,
      summary: {
        eventName: ev.name,
        tournamentName: ev.tournament?.name ?? null,
        city: ev.tournament?.city ?? null,
        suggestedLocalDate,
        numEntrants: ev.numEntrants ?? null,
        standingsTotal: standings?.pageInfo?.total ?? null,
        setsTotal: sets?.pageInfo?.total ?? null,
      },
      standingsPreview: standings
        ? { pageInfo: standings.pageInfo, nodes: standings.nodes }
        : null,
      setsPreview: sets ? { pageInfo: sets.pageInfo, nodes: sets.nodes } : null,
    });
  } catch (e) {
    if (e instanceof StartGgGraphqlError) {
      return res.status(502).json({
        message: e.message || 'start.gg API error',
      });
    }
    console.error('previewStartGgEvent:', e);
    return res.status(500).json({
      message: e.message || 'Failed to load data from start.gg',
    });
  }
};

/**
 * POST body: { url: string }
 * Creates a local event, imports standings as event players, imports all sets as matches.
 * All DB writes run in a single transaction; external start.gg API calls run before the transaction.
 */
exports.importFullStartGgEvent = async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ message: 'url is required' });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      message:
        'start.gg API is not configured (set START_GG_API_KEY on the server).',
    });
  }

  let slug;
  try {
    slug = parseEventSlugFromUrl(url.trim());
  } catch (e) {
    return res.status(400).json({
      message: e.message || 'Could not parse start.gg tournament/event from the URL.',
    });
  }

  const createdBy = req.userData?.userId || null;

  try {
    const data = await fetchEventForImport(url.trim());
    if (!data || !data.event) {
      return res.status(404).json({
        message: 'No event found on start.gg for this URL.',
      });
    }

    const result = await runFullImportFromStartGgEvent(data.event, slug, createdBy);
    if (result.kind === 'err') {
      return res.status(result.status).json(result.body);
    }
    sendImportSuccess(res, result.slug, result.startGgEventIdNum, result.summary);
  } catch (e) {
    return handleImportException(res, e, 'importFullStartGgEvent');
  }
};

/**
 * POST body: { startGgEventId: number | string }
 * Same full import as URL flow; resolves slug from the event record on start.gg.
 */
exports.importStartGgEventById = async (req, res) => {
  const raw = req.body?.startGgEventId;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    return res
      .status(400)
      .json({ message: 'startGgEventId is required (positive number).' });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      message:
        'start.gg API is not configured (set START_GG_API_KEY on the server).',
    });
  }

  const createdBy = req.userData?.userId || null;

  try {
    const data = await fetchEventForImportById(num);
    if (!data?.event) {
      return res.status(404).json({
        message: 'No event found on start.gg for this id.',
      });
    }

    const ev = data.event;
    let slug;
    try {
      slug = parseEventSlugFromUrl(ev.slug || '');
    } catch (e) {
      return res.status(400).json({
        message:
          e.message ||
          'Could not parse event slug from start.gg (expected tournament/.../event/...).',
      });
    }

    const result = await runFullImportFromStartGgEvent(ev, slug, createdBy);
    if (result.kind === 'err') {
      return res.status(result.status).json(result.body);
    }
    sendImportSuccess(
      res,
      result.slug,
      result.startGgEventIdNum,
      result.summary
    );
  } catch (e) {
    return handleImportException(res, e, 'importStartGgEventById');
  }
};

/**
 * POST body: { resetWatermark?: boolean } — if true, ignore stored watermark for this run only (full window up to page cap).
 * Lists past StepManiaX events on start.gg not yet imported locally; updates discovery watermark on success.
 */
exports.refreshStepmaniaDiscovery = async (req, res) => {
  const resetWatermark = req.body?.resetWatermark === true;
  const videogameId = stepmaniaxVideogameId();

  if (!isConfigured()) {
    return res.status(503).json({
      message:
        'start.gg API is not configured (set START_GG_API_KEY on the server).',
    });
  }

  try {
    const importedRows = await dbconn.executeMysqlQuery(
      startGgDiscoveryQueries.GET_ALL_IMPORTED_START_GG_IDS
    );
    const imported = new Set(
      (importedRows || [])
        .map((r) => Number(r.start_gg_event_id))
        .filter((n) => Number.isFinite(n))
    );

    const stateRows = await dbconn.executeMysqlQuery(
      startGgDiscoveryQueries.GET_STATE
    );
    const row = stateRows && stateRows[0];
    const lastWatermark =
      row?.last_max_event_start_at != null
        ? Number(row.last_max_event_start_at)
        : null;

    const disc = await discoverNotImportedPastEvents({
      videogameId,
      importedStartGgIds: imported,
      lastWatermark: Number.isFinite(lastWatermark) ? lastWatermark : null,
      resetWatermark,
    });

    if (disc.newWatermark != null && Number.isFinite(disc.newWatermark)) {
      await dbconn.executeMysqlQuery(startGgDiscoveryQueries.UPDATE_STATE, [
        disc.newWatermark,
      ]);
    }

    res.status(200).json({
      candidates: disc.candidates.map((c) => ({
        startGgEventId: c.startGgEventId,
        eventName: c.eventName,
        eventSlug: c.eventSlug,
        eventStartAt: c.eventStartAt,
        numEntrants: c.numEntrants,
        tournamentId: c.tournamentId,
        tournamentName: c.tournamentName,
      })),
      meta: {
        videogameId: String(videogameId),
        previousWatermark: disc.previousWatermark,
        newWatermark: disc.newWatermark,
        pagesFetched: disc.pagesFetched,
        tournamentsTotalPages: disc.tournamentsTotalPages,
        eventsSeen: disc.eventsSeen,
        candidateCount: disc.candidates.length,
        resetWatermark,
      },
    });
  } catch (e) {
    if (e instanceof StartGgGraphqlError) {
      return res.status(502).json({
        message: e.message || 'start.gg API error',
      });
    }
    console.error('refreshStepmaniaDiscovery:', e);
    return res.status(500).json({
      message: e.message || 'Discovery failed',
    });
  }
};

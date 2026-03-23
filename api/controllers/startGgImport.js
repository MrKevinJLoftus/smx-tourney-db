const dbconn = require('../database/connector');
const eventQueries = require('../queries/event');
const eventPlayerQueries = require('../queries/eventPlayer');
const { parseEventSlugFromUrl } = require('../services/startGgEvent');
const { isConfigured, StartGgGraphqlError } = require('../services/startGgClient');
const {
  fetchEventForImport,
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

    const ev = data.event;
    const startGgEventIdNum = Number(ev.id);
    if (!Number.isFinite(startGgEventIdNum)) {
      return res.status(400).json({ message: 'Invalid start.gg event id.' });
    }

    const existing = await dbconn.executeMysqlQuery(
      eventQueries.GET_EVENT_BY_START_GG_EVENT_ID,
      [startGgEventIdNum]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({
        message:
          'This start.gg event has already been imported. Delete the local event first or use a different tournament.',
        startGgEventId: startGgEventIdNum,
        localEventId: existing[0].id,
      });
    }

    const sqlDate = startAtToSqlDate(ev.startAt ?? ev.tournament?.startAt);
    if (!sqlDate) {
      return res.status(400).json({
        message:
          'Cannot import: this start.gg event has no start date. Add a date on start.gg or import manually.',
      });
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
  } catch (e) {
    if (e instanceof StartGgGraphqlError) {
      return res.status(502).json({
        message: e.message || 'start.gg API error',
      });
    }
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message:
          'This start.gg event has already been imported (duplicate key).',
      });
    }
    console.error('importFullStartGgEvent:', e);
    return res.status(500).json({
      message: e.message || 'Import failed',
    });
  }
};

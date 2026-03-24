/**
 * Discover past (completed) start.gg tournaments that include a videogame (e.g. StepManiaX).
 * @see https://developer.start.gg/docs/examples/queries/tournaments-by-videogame
 */

const { executeGraphQL } = require('./startGgClient');

const PAST_VIDEOGAME_TOURNAMENTS_PAGE = `
  query PastVideogameTournaments($page: Int!, $perPage: Int!, $videogameIds: [ID]!) {
    tournaments(query: {
      page: $page
      perPage: $perPage
      sortBy: "startAt desc"
      filter: {
        past: true
        videogameIds: $videogameIds
      }
    }) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        id
        name
        slug
        startAt
        state
        events(filter: { videogameId: $videogameIds }) {
          id
          name
          slug
          startAt
          numEntrants
        }
      }
    }
  }
`;

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_PER_PAGE = 25;

async function fetchPastVideogameTournamentPage(page, perPage, videogameId) {
  const videogameIds = [String(videogameId)];
  return executeGraphQL({
    query: PAST_VIDEOGAME_TOURNAMENTS_PAGE,
    variables: { page, perPage, videogameIds },
    operationName: 'PastVideogameTournaments',
  });
}

/**
 * Walk start.gg past tournaments for a game and return StepManiaX events not yet imported,
 * incremental vs. last stored max `event.startAt` unless `resetWatermark`.
 *
 * @param {object} opts
 * @param {string|number} opts.videogameId
 * @param {Set<number>} opts.importedStartGgIds
 * @param {number|null|undefined} opts.lastWatermark Unix seconds; events with startAt <= this are excluded unless reset
 * @param {boolean} [opts.resetWatermark]
 * @param {number} [opts.maxPages]
 * @param {number} [opts.perPage]
 */
async function discoverNotImportedPastEvents({
  videogameId,
  importedStartGgIds,
  lastWatermark,
  resetWatermark = false,
  maxPages = DEFAULT_MAX_PAGES,
  perPage = DEFAULT_PER_PAGE,
}) {
  const imported =
    importedStartGgIds instanceof Set
      ? importedStartGgIds
      : new Set(importedStartGgIds);
  const effectiveWatermark = resetWatermark ? null : lastWatermark;

  const flatEvents = [];
  let pagesFetched = 0;
  let reportedTotalPages = 1;

  for (
    let page = 1;
    page <= Math.min(maxPages, reportedTotalPages);
    page++
  ) {
    const data = await fetchPastVideogameTournamentPage(page, perPage, videogameId);
    const conn = data.tournaments;
    if (!conn?.nodes?.length) {
      break;
    }
    reportedTotalPages = Number(conn.pageInfo?.totalPages) || page;
    pagesFetched += 1;

    for (const t of conn.nodes) {
      for (const ev of t.events || []) {
        flatEvents.push({
          startGgEventId: Number(ev.id),
          eventName: ev.name,
          /** Full path `tournament/.../event/...`; usable with `fetchEventForImport`. */
          eventSlug: ev.slug,
          eventStartAt:
            ev.startAt != null ? Number(ev.startAt) : null,
          numEntrants:
            ev.numEntrants != null ? Number(ev.numEntrants) : null,
          tournamentId: Number(t.id),
          tournamentName: t.name,
          tournamentSlug: t.slug,
          tournamentStartAt:
            t.startAt != null ? Number(t.startAt) : null,
          tournamentState: t.state != null ? Number(t.state) : null,
        });
      }
    }
  }

  let batchMax = null;
  for (const e of flatEvents) {
    if (e.eventStartAt != null && Number.isFinite(e.eventStartAt)) {
      if (batchMax === null || e.eventStartAt > batchMax) {
        batchMax = e.eventStartAt;
      }
    }
  }

  const candidates = flatEvents.filter((e) => {
    if (!Number.isFinite(e.startGgEventId)) {
      return false;
    }
    if (imported.has(e.startGgEventId)) {
      return false;
    }
    if (
      effectiveWatermark != null &&
      Number.isFinite(Number(effectiveWatermark))
    ) {
      if (
        e.eventStartAt == null ||
        e.eventStartAt <= Number(effectiveWatermark)
      ) {
        return false;
      }
    }
    return true;
  });

  candidates.sort((a, b) => Number(b.eventStartAt) - Number(a.eventStartAt));

  return {
    candidates,
    pagesFetched,
    tournamentsTotalPages: reportedTotalPages,
    previousWatermark: effectiveWatermark,
    newWatermark: batchMax,
    eventsSeen: flatEvents.length,
  };
}

module.exports = {
  discoverNotImportedPastEvents,
  fetchPastVideogameTournamentPage,
  DEFAULT_MAX_PAGES,
  DEFAULT_PER_PAGE,
};

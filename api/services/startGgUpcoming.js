/**
 * Public-facing start.gg queries (no DB writes).
 *
 * Used for showing upcoming / in-progress StepManiaX events on the home page.
 */

const { executeGraphQL } = require('./startGgClient');

function stepmaniaxVideogameIds() {
  const rawList = process.env.START_GG_STEPMANIAX_VIDEOGAME_IDS;
  if (rawList && String(rawList).trim()) {
    const ids = String(rawList)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) {
      return ids;
    }
  }

  const single = process.env.START_GG_STEPMANIAX_VIDEOGAME_ID;
  if (single && String(single).trim()) {
    return [String(single).trim()];
  }

  // Defaults match the import/discovery controller.
  return ['33834', '55766'];
}

const UPCOMING_TOURNAMENTS_BY_VIDEOGAME_QUERY = `
  query UpcomingTournamentsByVideogame($page: Int!, $perPage: Int!, $videogameIds: [ID]!, $afterDate: Timestamp!) {
    tournaments(query: {
      page: $page
      perPage: $perPage
      sortBy: "startAt asc"
      filter: {
        afterDate: $afterDate
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
        city
        addrState
        countryCode
        events(filter: { videogameId: $videogameIds }) {
          id
          name
          slug
          startAt
        }
      }
    }
  }
`;

function formatTournamentLocation(t) {
  const city = t?.city ? String(t.city).trim() : '';
  const state = t?.addrState ? String(t.addrState).trim() : '';
  const country = t?.countryCode ? String(t.countryCode).trim() : '';

  if (city && state) return `${city}, ${state}`;
  if (city && country) return `${city}, ${country}`;
  return city || state || country || null;
}

/**
 * Fetch upcoming (and recently-started) StepManiaX events.
 *
 * We intentionally use `afterDate` rather than `upcoming: true` so that events that
 * started very recently (i.e. currently in progress) remain visible for a short window.
 *
 * @param {object} opts
 * @param {number} [opts.daysBack] Number of days to subtract from "now" for the cutoff.
 * @param {number} [opts.limit] Max events to return (after flattening).
 * @param {number} [opts.perPage] start.gg tournaments page size.
 */
async function fetchUpcomingStepmaniaxEvents({
  daysBack = 2,
  limit = 15,
  perPage = 25,
} = {}) {
  const videogameIds = stepmaniaxVideogameIds();
  const cutoffMs = Date.now() - Math.max(0, Number(daysBack) || 0) * 24 * 60 * 60 * 1000;
  const afterDate = Math.floor(cutoffMs / 1000);

  const flat = [];
  let reportedTotalPages = 1;

  for (let page = 1; page <= Math.min(10, reportedTotalPages); page++) {
    const data = await executeGraphQL({
      query: UPCOMING_TOURNAMENTS_BY_VIDEOGAME_QUERY,
      variables: {
        page,
        perPage,
        videogameIds: videogameIds.map((v) => String(v)),
        afterDate,
      },
      operationName: 'UpcomingTournamentsByVideogame',
    });

    const conn = data?.tournaments;
    if (!conn?.nodes?.length) {
      break;
    }
    reportedTotalPages = Number(conn.pageInfo?.totalPages) || page;

    for (const t of conn.nodes) {
      for (const ev of t.events || []) {
        const startAt = ev.startAt != null ? Number(ev.startAt) : null;
        if (startAt == null || !Number.isFinite(startAt) || startAt < afterDate) {
          continue;
        }
        flat.push({
          tournamentName: t.name || null,
          tournamentSlug: t.slug || null,
          tournamentLocation: formatTournamentLocation(t),
          eventName: ev.name || null,
          eventSlug: ev.slug || null,
          startAt,
          startGgEventId: Number(ev.id),
        });
      }
    }

    if (flat.length >= limit) {
      break;
    }
  }

  flat.sort((a, b) => Number(a.startAt) - Number(b.startAt));
  return {
    events: flat.slice(0, limit).map((e) => ({
      tournamentName: e.tournamentName,
      eventName: e.eventName,
      location: e.tournamentLocation,
      startAt: e.startAt,
      url: e.eventSlug ? `https://start.gg/${String(e.eventSlug).replace(/^\/+/, '')}` : null,
    })),
    meta: {
      daysBack: Math.max(0, Number(daysBack) || 0),
      afterDate,
      videogameIds: videogameIds.map((v) => String(v)),
    },
  };
}

module.exports = {
  fetchUpcomingStepmaniaxEvents,
};


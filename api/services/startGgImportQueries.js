/**
 * GraphQL operations for importing a start.gg event into SMX Tourney DB.
 *
 * Flow:
 * 1. Resolve `eventId` from the URL slug (see startGgEvent.js).
 * 2. Query event + tournament metadata → local `event` row (name, date, location, description).
 * 3. Paginate standings → local `player` + `event_player` (placement / seed).
 * 4. Paginate sets → local `match` rows; `buildMatchPayload` uses scores + winner for W-L-D stats.
 *
 * @see https://developer.start.gg/docs/examples/queries/get-event
 * @see https://developer.start.gg/docs/examples/queries/event-standings
 * @see https://developer.start.gg/docs/examples/queries/sets-in-event
 */

const { executeGraphQL } = require('./startGgClient');
const { parseEventSlugFromUrl } = require('./startGgEvent');

/**
 * Canonical slug for manual / automated tests (path segment after the host).
 * Format: `tournament/{tournamentSlug}/event/{eventSlug}`
 */
const DEFAULT_TEST_EVENT_SLUG_PATH =
  'tournament/love-arcade-michigan-stepmaniax-tournament/event/stepmaniax';

/**
 * Event + parent tournament fields used to create a row in our `event` table.
 * `startAt` values are Unix timestamps (seconds).
 */
const GET_EVENT_FOR_IMPORT_QUERY = `
  query GetEventForImport($slug: String!) {
    event(slug: $slug) {
      id
      name
      startAt
      numEntrants
      tournament {
        id
        name
        city
        startAt
      }
    }
  }
`;

/**
 * Final placements for entrants (paginate until `pageInfo.totalPages`).
 * Use `entrant.name` as the player tag; `placement` for `event_player.placement`.
 *
 * @see https://developer.start.gg/docs/examples/queries/event-standings
 */
const GET_EVENT_STANDINGS_PAGE_QUERY = `
  query GetEventStandingsPage($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      standings(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          placement
          entrant {
            id
            name
          }
        }
      }
    }
  }
`;

/**
 * Completed bracket sets with scores. Paginate with `sets.page` / `pageInfo.totalPages`.
 * `slots` matches the Set schema; `buildMatchPayload` accepts `slots` or `paginatedSlots.nodes`.
 *
 * Bracket context (for duplicate `fullRoundText` across sides): `phaseGroup.phase.name`,
 * `phaseGroup.displayIdentifier`, `phaseGroup.bracketType`, and `round` (negative round
 * indicates losers-bracket sets per start.gg Set docs).
 *
 * @see https://developer.start.gg/docs/examples/queries/sets-in-event
 * @see https://developer.start.gg/reference/set.doc.html
 */
const GET_EVENT_SETS_PAGE_QUERY = `
  query GetEventSetsPage($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      sets(page: $page, perPage: $perPage, sortType: STANDARD) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          state
          fullRoundText
          identifier
          round
          winnerId
          phaseGroup {
            id
            displayIdentifier
            bracketType
            phase {
              id
              name
              bracketType
              phaseOrder
            }
          }
          slots {
            slotIndex
            entrant {
              id
              name
            }
            standing {
              stats {
                score {
                  value
                  label
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Optional: entrants list if you need everyone registered (e.g. missing from standings).
 * @see https://developer.start.gg/docs/examples/queries/event-entrants
 */
const GET_EVENT_ENTRANTS_PAGE_QUERY = `
  query GetEventEntrantsPage($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      entrants(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          participants {
            id
            gamerTag
          }
        }
      }
    }
  }
`;

/**
 * @param {string} slugOrUrl
 * @returns {Promise<{ event: {
 *   id: number|string,
 *   name: string,
 *   startAt: number|null,
 *   numEntrants: number|null,
 *   tournament: { id: number|string, name: string, city: string|null, startAt: number|null }|null
 * } | null }>}
 */
async function fetchEventForImport(slugOrUrl) {
  const slug = parseEventSlugFromUrl(slugOrUrl);
  return executeGraphQL({
    query: GET_EVENT_FOR_IMPORT_QUERY,
    variables: { slug },
    operationName: 'GetEventForImport',
  });
}

/**
 * @param {string|number} eventId
 * @param {number} page
 * @param {number} perPage
 */
async function fetchStandingsPage(eventId, page, perPage) {
  return executeGraphQL({
    query: GET_EVENT_STANDINGS_PAGE_QUERY,
    variables: { eventId, page, perPage },
    operationName: 'GetEventStandingsPage',
  });
}

/**
 * @param {string|number} eventId
 * @param {number} page
 * @param {number} perPage
 */
async function fetchSetsPage(eventId, page, perPage) {
  return executeGraphQL({
    query: GET_EVENT_SETS_PAGE_QUERY,
    variables: { eventId, page, perPage },
    operationName: 'GetEventSetsPage',
  });
}

/**
 * @param {string|number} eventId
 * @param {number} page
 * @param {number} perPage
 */
async function fetchEntrantsPage(eventId, page, perPage) {
  return executeGraphQL({
    query: GET_EVENT_ENTRANTS_PAGE_QUERY,
    variables: { eventId, page, perPage },
    operationName: 'GetEventEntrantsPage',
  });
}

/**
 * Map start.gg `startAt` (Unix seconds) to `YYYY-MM-DD` for MySQL `event.date`.
 * @param {number|null|undefined} startAtSeconds
 * @returns {string|null}
 */
function startAtToSqlDate(startAtSeconds) {
  if (startAtSeconds == null || !Number.isFinite(Number(startAtSeconds))) {
    return null;
  }
  const d = new Date(Number(startAtSeconds) * 1000);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

const STANDINGS_PAGE_SIZE = 50;
const SETS_PAGE_SIZE = 50;

/**
 * All standing rows for an event (every page).
 * @param {string|number} eventId
 * @returns {Promise<Array<{ placement: number, entrant: { id: unknown, name: string } }>>}
 */
async function fetchAllStandings(eventId) {
  const first = await fetchStandingsPage(eventId, 1, STANDINGS_PAGE_SIZE);
  const standings = first.event?.standings;
  if (!standings) {
    return [];
  }
  const totalPages = Math.max(1, Number(standings.pageInfo?.totalPages) || 1);
  const nodes = [...(standings.nodes || [])];
  for (let page = 2; page <= totalPages; page++) {
    const data = await fetchStandingsPage(eventId, page, STANDINGS_PAGE_SIZE);
    const next = data.event?.standings?.nodes || [];
    nodes.push(...next);
  }
  return nodes;
}

/**
 * All sets for an event (every page).
 * @param {string|number} eventId
 * @returns {Promise<Array<object>>}
 */
async function fetchAllSets(eventId) {
  const first = await fetchSetsPage(eventId, 1, SETS_PAGE_SIZE);
  const setsConn = first.event?.sets;
  if (!setsConn) {
    return [];
  }
  const totalPages = Math.max(1, Number(setsConn.pageInfo?.totalPages) || 1);
  const nodes = [...(setsConn.nodes || [])];
  for (let page = 2; page <= totalPages; page++) {
    const data = await fetchSetsPage(eventId, page, SETS_PAGE_SIZE);
    const next = data.event?.sets?.nodes || [];
    nodes.push(...next);
  }
  return nodes;
}

module.exports = {
  DEFAULT_TEST_EVENT_SLUG_PATH,
  STANDINGS_PAGE_SIZE,
  SETS_PAGE_SIZE,
  GET_EVENT_FOR_IMPORT_QUERY,
  GET_EVENT_STANDINGS_PAGE_QUERY,
  GET_EVENT_SETS_PAGE_QUERY,
  GET_EVENT_ENTRANTS_PAGE_QUERY,
  fetchEventForImport,
  fetchStandingsPage,
  fetchSetsPage,
  fetchEntrantsPage,
  fetchAllStandings,
  fetchAllSets,
  startAtToSqlDate,
};

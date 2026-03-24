/**
 * start.gg Event helpers: resolve event id from tournament + event slug path.
 * @see https://developer.start.gg/docs/examples/queries/get-event
 */

const { executeGraphQL } = require('./startGgClient');

/**
 * GraphQL: resolve an event by the slug path shown in start.gg URLs.
 * Slug format: `tournament/{tournamentSlug}/event/{eventSlug}`
 */
const GET_EVENT_BY_SLUG_QUERY = `
  query getEventBySlug($slug: String) {
    event(slug: $slug) {
      id
      name
    }
  }
`;

/**
 * Extracts and normalizes the event slug path from a full URL or path string.
 * Accepts e.g. `https://www.start.gg/tournament/foo/event/bar`, `/tournament/foo/event/bar`,
 * or `tournament/foo/event/bar`.
 *
 * @param {string} input
 * @returns {string} Normalized slug, e.g. `tournament/foo/event/bar`
 * @throws {Error} If the pattern `tournament/.../event/...` is not found
 */
function parseEventSlugFromUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('A URL or slug path is required');
  }
  const trimmed = input.trim();
  const match = trimmed.match(/tournament\/([^/]+)\/event\/([^/?#]+)/i);
  if (!match) {
    throw new Error(
      'Could not parse tournament/event slug. Expected a path like tournament/{name}/event/{name}.'
    );
  }
  return `tournament/${match[1]}/event/${match[2]}`;
}

/**
 * Fetches start.gg event id (and name) using the slug path from the event page URL.
 *
 * @param {string} slugOrUrl - Full URL, path, or `tournament/.../event/...` slug
 * @returns {Promise<{ id: number|string, name: string } | null>} `null` if no event exists for that slug
 */
async function getEventBySlug(slugOrUrl) {
  const slug = parseEventSlugFromUrl(slugOrUrl);
  /** @type {{ event?: { id: number|string, name: string } | null }} */
  const data = await executeGraphQL({
    query: GET_EVENT_BY_SLUG_QUERY,
    variables: { slug },
    operationName: 'getEventBySlug',
  });
  if (!data || !data.event) {
    return null;
  }
  return {
    id: data.event.id,
    name: data.event.name,
  };
}

/**
 * @param {string} slugOrUrl
 * @returns {Promise<number|string | null>}
 */
async function getEventIdBySlug(slugOrUrl) {
  const ev = await getEventBySlug(slugOrUrl);
  return ev ? ev.id : null;
}

module.exports = {
  GET_EVENT_BY_SLUG_QUERY,
  parseEventSlugFromUrl,
  getEventBySlug,
  getEventIdBySlug,
};

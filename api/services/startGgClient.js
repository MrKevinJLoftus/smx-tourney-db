/**
 * Thin client for the start.gg GraphQL API.
 * @see https://developer.start.gg/docs/sending-requests/
 *
 * Set START_GG_API_KEY in the environment (Bearer token from start.gg developer settings).
 */

const START_GG_GQL_ENDPOINT = 'https://api.start.gg/gql/alpha';

function readApiKey() {
  const key = process.env.START_GG_API_KEY;
  return key && String(key).trim() ? String(key).trim() : null;
}

/**
 * @returns {boolean} Whether a non-empty START_GG_API_KEY is present.
 */
function isConfigured() {
  return readApiKey() !== null;
}

class StartGgGraphqlError extends Error {
  /**
   * @param {string} message
   * @param {{ errors?: Array<{ message?: string }>, status?: number }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'StartGgGraphqlError';
    this.errors = details.errors;
    this.status = details.status;
  }
}

/**
 * Executes a GraphQL operation against api.start.gg.
 *
 * @param {Object} options
 * @param {string} options.query - GraphQL query or mutation string
 * @param {Record<string, unknown>} [options.variables]
 * @param {string} [options.operationName]
 * @returns {Promise<unknown>} The `data` field from the JSON response
 * @throws {Error} When START_GG_API_KEY is missing
 * @throws {StartGgGraphqlError} On HTTP failure or GraphQL `errors` in the body
 */
async function executeGraphQL({ query, variables, operationName }) {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error(
      'START_GG_API_KEY is not set. Add it to the environment to use the start.gg API.'
    );
  }

  const body = { query };
  if (variables !== undefined) {
    body.variables = variables;
  }
  if (operationName) {
    body.operationName = operationName;
  }

  const res = await fetch(START_GG_GQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new StartGgGraphqlError(`Invalid JSON from start.gg (HTTP ${res.status})`, {
      status: res.status,
    });
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      `start.gg request failed with HTTP ${res.status}`;
    throw new StartGgGraphqlError(String(msg), { status: res.status });
  }

  if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
    const msg = json.errors
      .map((e) => (e && e.message) || String(e))
      .join('; ');
    throw new StartGgGraphqlError(msg || 'GraphQL error', {
      errors: json.errors,
      status: res.status,
    });
  }

  return json.data;
}

module.exports = {
  START_GG_GQL_ENDPOINT,
  StartGgGraphqlError,
  executeGraphQL,
  isConfigured,
};

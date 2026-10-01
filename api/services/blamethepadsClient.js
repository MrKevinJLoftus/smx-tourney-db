/**
 * Read-only client for blamethepads (formerly piu-tourney-maker), backed by Supabase.
 * Uses the public PostgREST endpoint with the site's anon key; rows are public-read by default.
 * Schema reference: https://github.com/AlanCooper509/piu-tourney-maker (src/types).
 */

const DEFAULT_SMX_GAME_ID = 3;

class BlamethepadsError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function config() {
  const url = (process.env.BLAMETHEPADS_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.BLAMETHEPADS_SUPABASE_ANON_KEY || '').trim();
  return { url, anonKey };
}

function isConfigured() {
  const { url, anonKey } = config();
  return !!url && !!anonKey;
}

/**
 * GET a PostgREST table with query params.
 * @param {string} table
 * @param {Record<string, string>} params
 * @returns {Promise<Array<object>>}
 */
async function restGet(table, params) {
  const { url, anonKey } = config();
  if (!url || !anonKey) {
    throw new BlamethepadsError(
      'blamethepads is not configured (set BLAMETHEPADS_SUPABASE_URL and BLAMETHEPADS_SUPABASE_ANON_KEY on the server).',
      503
    );
  }
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.message ? `: ${body.message}` : '';
    } catch (e) {
      detail = '';
    }
    throw new BlamethepadsError(`blamethepads returned ${res.status} for ${table}${detail}`);
  }
  return res.json();
}

/**
 * Accepts a blamethepads tourney URL (/tourney/<id> or /event/<eid>/tourney/<id>) or a bare tourney id.
 * @param {string|number} raw
 * @returns {number}
 */
function parseTourneyId(raw) {
  const trimmed = raw != null ? String(raw).trim() : '';
  if (!trimmed) {
    throw new BlamethepadsError('A blamethepads tourney URL or id is required.', 400);
  }
  const fromUrl = trimmed.match(/\/tourney\/(\d+)/);
  const idText = fromUrl ? fromUrl[1] : trimmed;
  const id = Number(idText);
  if (!/^\d+$/.test(idText) || !Number.isSafeInteger(id) || id <= 0) {
    throw new BlamethepadsError(`Could not read a blamethepads tourney id from "${trimmed}".`, 400);
  }
  return id;
}

/**
 * Resolves the StepManiaX game id by name, falling back to the id the upstream app hardcodes.
 * @returns {Promise<number>}
 */
async function fetchSmxGameId() {
  const games = await restGet('games', { select: 'id,name' });
  const smx = (games || []).find((g) => /stepmania\s*x|\bsmx\b/i.test(g.name || ''));
  return smx ? Number(smx.id) : DEFAULT_SMX_GAME_ID;
}

/**
 * All StepManiaX tourneys with their parent event, newest first.
 * @returns {Promise<Array<object>>}
 */
async function fetchSmxTourneys() {
  const gameId = await fetchSmxGameId();
  return restGet('tourneys', {
    select: 'id,name,status,type,start_date,end_date,event_id,game_id,ddrtools_room,events(id,name,location,start_date,end_date)',
    game_id: `eq.${gameId}`,
    order: 'start_date.desc',
  });
}

/**
 * Tourney rows (with parent event) for the given ids; used to name events pulled from ddr.tools.
 * @param {number[]} tourneyIds
 * @returns {Promise<Array<object>>}
 */
async function fetchTourneysByIds(tourneyIds) {
  if (!tourneyIds.length) return [];
  return restGet('tourneys', {
    select: 'id,name,start_date,event_id,game_id,events(id,name,location,start_date)',
    id: `in.(${tourneyIds.join(',')})`,
  });
}

/**
 * One tourney with everything needed to import results.
 * @param {number} tourneyId
 * @returns {Promise<{ tourney: object, smxGameId: number, players: Array<object>, rounds: Array<object> }>}
 */
async function fetchTourneyForImport(tourneyId) {
  const [tourneys, smxGameId] = await Promise.all([
    restGet('tourneys', {
      select: '*,events(*)',
      id: `eq.${tourneyId}`,
    }),
    fetchSmxGameId(),
  ]);
  const tourney = tourneys && tourneys[0];
  if (!tourney) {
    throw new BlamethepadsError(`No blamethepads tourney found with id ${tourneyId}.`, 404);
  }

  const [players, rounds] = await Promise.all([
    restGet('player_tourneys', {
      select: 'id,player_name,seed',
      tourney_id: `eq.${tourneyId}`,
      order: 'id.asc',
    }),
    restGet('rounds', {
      select: '*,player_rounds(id,player_tourney_id,sort_order,player_tourneys(id,player_name,seed)),stages(*,charts(*),scores(id,player_round_id,score))',
      tourney_id: `eq.${tourneyId}`,
      order: 'id.asc',
    }),
  ]);

  return {
    tourney,
    smxGameId,
    players: players || [],
    rounds: rounds || [],
  };
}

module.exports = {
  BlamethepadsError,
  isConfigured,
  parseTourneyId,
  fetchSmxTourneys,
  fetchTourneysByIds,
  fetchTourneyForImport,
};

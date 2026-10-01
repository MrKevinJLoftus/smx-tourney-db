/**
 * Read-only client for ddr.tools event rooms.
 * Room state is a public JSON GET on the PartyKit host; no credentials needed beyond the room code.
 */

const DEFAULT_PARTY_HOST = 'ddr-card-draw-party.noahm.partykit.dev';

class DdrToolsError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function partyHost() {
  const raw = process.env.DDRTOOLS_PARTY_HOST;
  return raw && String(raw).trim() ? String(raw).trim() : DEFAULT_PARTY_HOST;
}

/**
 * Accepts a ddr.tools event URL (e.g. https://next.ddr.tools/e/<CODE>/...), a PartyKit room URL, or a bare room code.
 * @param {string} raw
 * @returns {string}
 */
function parseRoomCode(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    throw new DdrToolsError('A ddr.tools event URL or room code is required.', 400);
  }
  const fromEventUrl = trimmed.match(/\/e\/([^/?#\s]+)/);
  const fromPartyUrl = trimmed.match(/\/parties\/main\/([^/?#\s]+)/);
  const room = fromEventUrl ? fromEventUrl[1] : fromPartyUrl ? fromPartyUrl[1] : trimmed;
  if (!/^[\w.~-]+$/.test(room)) {
    throw new DdrToolsError(`Could not read a ddr.tools room code from "${trimmed}".`, 400);
  }
  return room;
}

function roomUrl(room) {
  const host = partyHost();
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/parties/main/${encodeURIComponent(room)}`;
}

/**
 * @param {string} room
 * @returns {Promise<{ drawings: { ids: string[], entities: Record<string, object> }, config: object, event: object }>}
 */
async function fetchRoomState(room) {
  const res = await fetch(roomUrl(room));
  if (!res.ok) {
    throw new DdrToolsError(`ddr.tools returned ${res.status} for room "${room}".`);
  }
  const state = await res.json();
  if (!state?.drawings?.entities) {
    throw new DdrToolsError(`"${room}" doesn't look like a ddr.tools event room.`);
  }
  return state;
}

/**
 * Charts a drawing actually played, in play order.
 * Banned charts are dropped; a pocket pick replaces the chart it was picked over but keeps
 * the original chart id, because that's the key scores are recorded under.
 * @param {object} drawing
 * @returns {Array<object>}
 */
function drawnCharts(drawing) {
  return Object.values(drawing.subDrawings || {})
    .flatMap((sub) => sub.charts || [])
    .filter(
      (c) =>
        drawing.pocketPicks?.[c.id]?.pick ||
        (c.type === 'DRAWN' && !drawing.bans?.[c.id])
    )
    .map((c) => {
      const pick = drawing.pocketPicks?.[c.id]?.pick;
      return pick ? { ...pick, id: c.id, type: c.type } : c;
    });
}

/**
 * @param {object} drawing
 * @returns {number}
 */
function bannedChartCount(drawing) {
  return Object.values(drawing.subDrawings || {})
    .flatMap((sub) => sub.charts || [])
    .filter((c) => c.type === 'DRAWN' && !!drawing.bans?.[c.id]).length;
}

/**
 * @param {object} state
 * @param {object} drawing
 * @returns {string|null}
 */
function gameKeyForDrawing(state, drawing) {
  const configIds = [
    ...Object.values(drawing.subDrawings || {}).map((s) => s.configId),
    drawing.configId,
  ];
  for (const cid of configIds) {
    const key = state.config?.entities?.[cid]?.gameKey;
    if (key) return key;
  }
  return null;
}

module.exports = {
  DdrToolsError,
  parseRoomCode,
  fetchRoomState,
  drawnCharts,
  bannedChartCount,
  gameKeyForDrawing,
};

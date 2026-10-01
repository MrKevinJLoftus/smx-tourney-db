/**
 * Normalizes blamethepads tourneys and ddr.tools rooms into one ImportPlan shape:
 *
 * {
 *   events: [{
 *     externalSource, externalId, name, date, location, description, blocker?,
 *     players: [{ name, seed }],
 *     matches: [{
 *       source, sourceKey, round, players: [name], winnerName, skipReason?,
 *       charts: [{ title, artist, diffClass, plus, level, scores: { [name]: number|null } }]
 *     }]
 *   }]
 * }
 *
 * `plus` is true/false when the source says so, or null when it doesn't (ddr.tools pulls stored in
 * blamethepads keep only the difficulty label).
 */

const { drawnCharts, gameKeyForDrawing } = require('./ddrToolsClient');

const EVENT_NAME_MAX = 100;
const ROUND_MAX = 100;

function truncate(text, max) {
  const s = text == null ? '' : String(text).trim();
  return s.length > max ? s.slice(0, max) : s;
}

/** 'yyyy-mm-dd' or ISO timestamp -> 'yyyy-mm-dd HH:MM:SS', or null. */
function toSqlDate(raw) {
  if (!raw) return null;
  const s = String(raw);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}))?/);
  if (!m) return null;
  return `${m[1]} ${m[2] || '00:00:00'}`;
}

/** "7, 5, 4" -> [7, 5, 4]; [] when absent or unparseable. */
function parsePointsScale(raw) {
  if (Array.isArray(raw)) {
    return raw.map(Number).filter((n) => Number.isFinite(n));
  }
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function isScore(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Ranks players over a match's charts.
 * With a points scale, each chart awards scale[tieIndex] (dense, tie-aware), like blamethepads.
 * Without one, each chart's unique top score earns one win.
 * Ties on the primary total break on cumulative score.
 * @returns {{ winnerName: string|null, totals: Record<string, number>, cumulative: Record<string, number> }}
 */
function rankMatch(playerNames, charts, pointsScale) {
  const totals = {};
  const cumulative = {};
  for (const name of playerNames) {
    totals[name] = 0;
    cumulative[name] = 0;
  }

  for (const chart of charts) {
    const ranked = playerNames
      .map((name) => ({ name, score: chart.scores[name] }))
      .filter((r) => isScore(r.score))
      .sort((a, b) => b.score - a.score);

    for (const r of ranked) cumulative[r.name] += r.score;

    if (pointsScale.length) {
      for (const r of ranked) {
        const tieIndex = ranked.findIndex((x) => x.score === r.score);
        totals[r.name] += pointsScale[tieIndex] ?? 0;
      }
    } else if (ranked.length && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
      totals[ranked[0].name] += 1;
    }
  }

  const order = [...playerNames].sort(
    (a, b) => totals[b] - totals[a] || cumulative[b] - cumulative[a]
  );
  const [first, second] = order;
  const tiedAtTop =
    second !== undefined &&
    totals[first] === totals[second] &&
    cumulative[first] === cumulative[second];

  return { winnerName: first && !tiedAtTop ? first : null, totals, cumulative };
}

function finalizeMatch(match, pointsScale) {
  if (!match.skipReason) {
    if (match.players.length < 2) {
      match.skipReason = 'fewer than 2 players';
    } else if (!match.charts.length) {
      match.skipReason = 'no charts were played';
    } else if (!match.charts.some((c) => Object.values(c.scores).some(isScore))) {
      match.skipReason = 'no scores were recorded';
    }
  }
  match.winnerName = match.skipReason ? null : rankMatch(match.players, match.charts, pointsScale).winnerName;
  return match;
}

// ---------------------------------------------------------------------------
// ddr.tools
// ---------------------------------------------------------------------------

/** "Title|Artist::solo|hard|17|" -> { title, artist, style, diffClass, level } */
function parseChartKey(chartKey) {
  if (!chartKey || typeof chartKey !== 'string') return null;
  const [songPart, chartPart] = chartKey.split('::');
  if (!songPart || !chartPart) return null;
  const sep = songPart.indexOf('|');
  const title = sep >= 0 ? songPart.slice(0, sep) : songPart;
  const artist = sep >= 0 ? songPart.slice(sep + 1) : '';
  const [style, diffClass, level] = chartPart.split('|');
  return { title, artist, style, diffClass, level: Number(level) };
}

function ddrChart(chart) {
  const fromKey = parseChartKey(chart.chartKey) || {};
  const diffClass = (chart.diffClass || fromKey.diffClass || chart.diffAbbr || '').toLowerCase();
  const level = Number.isFinite(Number(chart.level)) ? Number(chart.level) : fromKey.level;
  return {
    title: chart.name || fromKey.title || '',
    artist: chart.artist || fromKey.artist || '',
    diffClass,
    plus: Array.isArray(chart.flags) ? chart.flags.includes('plus') : null,
    level: Number.isFinite(level) ? level : null,
  };
}

/** A linked draw's title is the blamethepads round name, so both import paths label rounds alike. */
function ddrRoundLabel(meta) {
  const title = meta?.title ? String(meta.title).trim() : '';
  const phase = meta?.phaseName ? String(meta.phaseName).trim() : '';
  return truncate(title || phase || 'ddr.tools draw', ROUND_MAX);
}

function ddrMatch(state, room, drawing) {
  const meta = drawing.meta || {};
  const isLinked = meta.type === 'piu' && meta.id;
  const players = (meta.players || []).filter((p) => p && p.name && String(p.name).trim());
  const nameById = new Map(players.map((p) => [String(p.id), String(p.name).trim()]));
  const playerNames = [...new Set(nameById.values())];
  const scoresByEntrant = meta.scoresByEntrant || {};

  const charts = drawnCharts(drawing).map((c) => {
    const scores = {};
    for (const [playerId, name] of nameById.entries()) {
      const v = scoresByEntrant[playerId]?.[c.id];
      scores[name] = isScore(v) ? v : null;
    }
    return { ...ddrChart(c), scores };
  });

  const match = {
    source: isLinked ? 'blamethepads' : 'ddrtools',
    sourceKey: isLinked ? `round:${meta.id}` : `draw:${room}:${drawing.id}`,
    round: ddrRoundLabel(meta),
    players: playerNames,
    charts,
    winnerName: null,
  };

  const gameKey = gameKeyForDrawing(state, drawing);
  if (gameKey && gameKey !== 'smx') {
    match.skipReason = `not a StepManiaX draw (game "${gameKey}")`;
  } else if (charts.length && playerNames.length) {
    const expected = charts.length * playerNames.length;
    const recorded = charts.reduce(
      (n, c) => n + Object.values(c.scores).filter(isScore).length,
      0
    );
    if (recorded > 0 && recorded < expected) {
      match.skipReason = `scores incomplete (${recorded} of ${expected} recorded)`;
    }
  }

  return finalizeMatch(match, parsePointsScale(meta.pointsPerPlace));
}

/**
 * @param {object} state ddr.tools room state
 * @param {string} room room code
 * @param {Map<string, object>} linkedTourneys blamethepads tourney rows (with `events`) by id, when available
 */
function normalizeDdrToolsRoom(state, room, linkedTourneys) {
  const groups = new Map();
  const ids = state.drawings.ids && state.drawings.ids.length
    ? state.drawings.ids
    : Object.keys(state.drawings.entities);

  for (const id of ids) {
    const drawing = state.drawings.entities[id];
    if (!drawing) continue;
    const meta = drawing.meta || {};
    const key = meta.type === 'piu' && meta.tourneyId
      ? `blamethepads:${meta.tourneyId}`
      : `ddrtools:${room}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(drawing);
  }

  const roomName = state.event?.eventName ? String(state.event.eventName).trim() : '';
  const events = [];

  for (const [key, drawings] of groups.entries()) {
    const [externalSource, externalId] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    const linked = externalSource === 'blamethepads' ? linkedTourneys.get(String(externalId)) : null;

    let name;
    if (linked) {
      name = linked.events?.name ? `${linked.events.name} - ${linked.name}` : linked.name;
    } else if (externalSource === 'blamethepads') {
      name = `${roomName || `ddr.tools ${room}`} - blamethepads tourney ${externalId}`;
    } else {
      name = roomName || `ddr.tools ${room}`;
    }

    const matches = drawings.map((d) => ddrMatch(state, room, d));
    const playerNames = [...new Set(matches.flatMap((m) => m.players))];

    events.push({
      externalSource,
      externalId: String(externalId),
      name: truncate(name, EVENT_NAME_MAX),
      date: toSqlDate(linked?.start_date || linked?.events?.start_date),
      location: linked?.events?.location || null,
      description: externalSource === 'blamethepads'
        ? `Imported from ddr.tools room ${room} (blamethepads tourney ${externalId})`
        : `Imported from ddr.tools room ${room}`,
      players: playerNames.map((n) => ({ name: n, seed: null })),
      matches,
    });
  }

  return { events };
}

/** blamethepads tourney ids referenced by a ddr.tools room's linked draws. */
function linkedTourneyIds(state) {
  const ids = new Set();
  for (const drawing of Object.values(state.drawings.entities)) {
    const meta = drawing?.meta || {};
    if (meta.type === 'piu' && meta.tourneyId && /^\d+$/.test(String(meta.tourneyId))) {
      ids.add(Number(meta.tourneyId));
    }
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// blamethepads
// ---------------------------------------------------------------------------

function btpChart(stage) {
  if (stage.charts) {
    return {
      title: stage.charts.name_en || '',
      artist: '',
      diffClass: '',
      plus: null,
      level: Number.isFinite(Number(stage.charts.level)) ? Number(stage.charts.level) : null,
    };
  }
  const meta = stage.chart_meta || {};
  const typeLabel = stage.chart_type ? String(stage.chart_type).trim() : '';
  const labelPlus = typeLabel.endsWith('+');
  const diffClass = (meta.diffClass || typeLabel.replace(/\+$/, '')).toLowerCase();
  let plus = null;
  if (Array.isArray(meta.flags)) {
    plus = meta.flags.includes('plus');
  } else if (labelPlus) {
    plus = true;
  } else if (stage.chart_source === 'smx-reference') {
    plus = false;
  }
  return {
    title: stage.chart_name || '',
    artist: meta.artist || '',
    diffClass,
    plus,
    level: Number.isFinite(Number(stage.chart_level)) ? Number(stage.chart_level) : null,
  };
}

function btpMatch(round) {
  const playerRounds = [...(round.player_rounds || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id
  );
  const nameByPlayerRound = new Map();
  for (const pr of playerRounds) {
    const name = pr.player_tourneys?.player_name ? String(pr.player_tourneys.player_name).trim() : '';
    if (name) nameByPlayerRound.set(pr.id, name);
  }
  const playerNames = [...new Set(nameByPlayerRound.values())];

  const stages = [...(round.stages || [])].sort(
    (a, b) => (a.play_order ?? Number.MAX_SAFE_INTEGER) - (b.play_order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
  );
  const charts = stages
    .filter((s) => s.charts || s.chart_name)
    .map((stage) => {
      const scores = {};
      for (const name of playerNames) scores[name] = null;
      for (const sc of stage.scores || []) {
        const name = nameByPlayerRound.get(sc.player_round_id);
        if (name && isScore(sc.score)) scores[name] = sc.score;
      }
      return { ...btpChart(stage), scores };
    });

  const match = {
    source: 'blamethepads',
    sourceKey: `round:${round.id}`,
    round: truncate(round.name || `Round ${round.id}`, ROUND_MAX),
    players: playerNames,
    charts,
    winnerName: null,
  };
  if (round.status && round.status !== 'Complete') {
    match.skipReason = `round is "${round.status}"`;
  }
  return finalizeMatch(match, parsePointsScale(round.points_per_stage));
}

/**
 * @param {{ tourney: object, smxGameId: number, players: Array<object>, rounds: Array<object> }} data
 */
function normalizeBlamethepadsTourney(data) {
  const { tourney, smxGameId, players, rounds } = data;
  const parentEvent = tourney.events || null;
  const name = parentEvent?.name ? `${parentEvent.name} - ${tourney.name}` : tourney.name;

  const event = {
    externalSource: 'blamethepads',
    externalId: String(tourney.id),
    name: truncate(name, EVENT_NAME_MAX),
    date: toSqlDate(tourney.start_date || parentEvent?.start_date),
    location: parentEvent?.location || null,
    description: `Imported from blamethepads tourney ${tourney.id}`,
    players: players
      .filter((p) => p.player_name && String(p.player_name).trim())
      .map((p) => ({
        name: String(p.player_name).trim(),
        seed: p.seed != null ? String(p.seed) : null,
      })),
    matches: rounds.map(btpMatch),
  };
  if (Number(tourney.game_id) !== Number(smxGameId)) {
    event.blocker = 'This blamethepads tourney is not a StepManiaX tourney.';
  }
  return { events: [event] };
}

module.exports = {
  normalizeDdrToolsRoom,
  normalizeBlamethepadsTourney,
  linkedTourneyIds,
  rankMatch,
  parsePointsScale,
  parseChartKey,
};

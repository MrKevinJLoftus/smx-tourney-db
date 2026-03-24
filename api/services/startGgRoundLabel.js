/**
 * Build a unique `match.round` label for start.gg imports when `fullRoundText`
 * repeats across bracket sides (e.g. two "Grand Final" sets).
 *
 * @param {object} set - start.gg Set node (may include phaseGroup, round, identifier)
 * @returns {string}
 */
function formatStartGgRoundLabel(set) {
  const base = set.fullRoundText || set.identifier || 'Set';
  const pg = set.phaseGroup;
  const phaseName = pg?.phase?.name?.trim();
  if (phaseName) {
    return `${phaseName} — ${base}`;
  }
  if (pg?.id != null) {
    return `[phaseGroup ${pg.id}] ${base}`;
  }
  if (typeof set.round === 'number' && set.round < 0) {
    return `Losers — ${base}`;
  }
  return base;
}

/**
 * Shallow clone of a set with `fullRoundText` replaced for DB import.
 * @param {object} set
 * @returns {object}
 */
function augmentStartGgSetForMatchImport(set) {
  return {
    ...set,
    fullRoundText: formatStartGgRoundLabel(set),
  };
}

module.exports = {
  formatStartGgRoundLabel,
  augmentStartGgSetForMatchImport,
};

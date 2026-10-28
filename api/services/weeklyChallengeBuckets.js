/**
 * Admin-editable level buckets for the weekly challenge draw.
 *
 * Settings are versioned by start week: a week's draw uses the newest row for its difficulty
 * whose effective_week is on or before that week, so saving never changes earlier weeks.
 * `buckets` null means the automatic thirds of the difficulty's level range.
 */

const dbconn = require('../database/connector');
const queries = require('../queries/weeklyChallenge');

const BUCKET_COUNT = 3;
const MIN_LEVEL = 1;
const MAX_LEVEL = 30;
const CACHE_TTL_MS = 60 * 1000;

class BucketConfigError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'BucketConfigError';
    this.statusCode = statusCode;
  }
}

let cached = null;
let inflight = null;
let warnedMissingTable = false;

function parseBuckets(raw) {
  if (raw == null) return null;
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(value) ? value.map((b) => ({ min: Number(b.min), max: Number(b.max) })) : null;
}

async function loadConfigs() {
  try {
    const rows = await dbconn.executeMysqlQuery(queries.GET_BUCKET_CONFIGS, []);
    return (rows || []).map((r) => ({
      id: r.id,
      effectiveWeek: r.effective_week,
      difficulty: r.difficulty,
      buckets: parseBuckets(r.buckets),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      if (!warnedMissingTable) {
        console.error(
          'weeklyChallenge: weekly_challenge_bucket_config is missing; using automatic buckets. ' +
            'Apply migration_add_weekly_challenge_bucket_config.sql.'
        );
        warnedMissingTable = true;
      }
      return [];
    }
    throw err;
  }
}

/**
 * Every saved bucket setting, oldest first. Cached briefly; if the database is unreachable,
 * the last loaded settings are reused so the draw never silently falls back to defaults.
 */
async function getConfigs() {
  if (cached && Date.now() < cached.expiresAt) return cached.configs;
  if (inflight) return inflight;
  inflight = loadConfigs()
    .then((configs) => {
      cached = { configs, expiresAt: Date.now() + CACHE_TTL_MS };
      return configs;
    })
    .catch((err) => {
      if (cached) {
        console.error('weeklyChallenge: reloading bucket settings failed, reusing last ones:', err.message);
        return cached.configs;
      }
      throw err;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * The setting in force for a difficulty in a given week, or null for automatic.
 * @returns {{ id: number, effectiveWeek: string, buckets: Array<{min:number,max:number}>|null } | null}
 */
function settingFor(configs, difficultyKey, weekKey) {
  let match = null;
  for (const config of configs) {
    if (config.difficulty === difficultyKey && config.effectiveWeek <= weekKey) match = config;
  }
  return match;
}

/** @returns {Array<{min:number,max:number}>} validated buckets */
function validateBuckets(buckets) {
  if (!Array.isArray(buckets) || buckets.length !== BUCKET_COUNT) {
    throw new BucketConfigError(`Provide exactly ${BUCKET_COUNT} buckets.`);
  }
  return buckets.map((bucket, i) => {
    const min = Number(bucket && bucket.min);
    const max = Number(bucket && bucket.max);
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new BucketConfigError(`Bucket ${i + 1} needs whole-number min and max levels.`);
    }
    if (min < MIN_LEVEL || max > MAX_LEVEL) {
      throw new BucketConfigError(`Bucket ${i + 1} must stay within levels ${MIN_LEVEL}-${MAX_LEVEL}.`);
    }
    if (min > max) throw new BucketConfigError(`Bucket ${i + 1} has a min above its max.`);
    return { min, max };
  });
}

/**
 * @param {{ difficulty: string, effectiveWeek: string, buckets: Array|null, createdBy?: number|null }} setting
 */
async function saveSetting({ difficulty, effectiveWeek, buckets, createdBy = null }) {
  try {
    await dbconn.executeMysqlQuery(queries.CREATE_BUCKET_CONFIG, [
      effectiveWeek,
      difficulty,
      buckets ? JSON.stringify(buckets) : null,
      createdBy,
    ]);
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      throw new BucketConfigError(
        'The bucket settings table is missing. Apply migration_add_weekly_challenge_bucket_config.sql.',
        503
      );
    }
    throw err;
  }
  cached = null;
}

module.exports = {
  BUCKET_COUNT,
  MIN_LEVEL,
  MAX_LEVEL,
  BucketConfigError,
  getConfigs,
  settingFor,
  validateBuckets,
  saveSetting,
};

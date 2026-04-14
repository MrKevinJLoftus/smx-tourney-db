const { isConfigured, StartGgGraphqlError } = require('../services/startGgClient');
const { fetchUpcomingStepmaniaxEvents } = require('../services/startGgUpcoming');

/**
 * GET /api/startgg/upcoming-stepmaniax
 * Query params:
 * - daysBack (default 2): include events whose startAt >= now - daysBack days
 * - limit (default 15): max events returned
 */
exports.getUpcomingStepmaniax = async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      message: 'start.gg API is not configured (set START_GG_API_KEY on the server).',
    });
  }

  const daysBackRaw = req.query?.daysBack;
  const limitRaw = req.query?.limit;

  const daysBack = daysBackRaw != null ? Number(daysBackRaw) : 2;
  const limit = limitRaw != null ? Number(limitRaw) : 15;

  try {
    const data = await fetchUpcomingStepmaniaxEvents({
      daysBack: Number.isFinite(daysBack) ? daysBack : 2,
      limit: Number.isFinite(limit) ? limit : 15,
    });
    return res.status(200).json(data);
  } catch (e) {
    if (e instanceof StartGgGraphqlError) {
      return res.status(502).json({ message: e.message || 'start.gg API error' });
    }
    console.error('getUpcomingStepmaniax:', e);
    return res.status(500).json({ message: e.message || 'Failed to fetch upcoming events' });
  }
};


const ratingService = require('../services/ratingService');

exports.generateSeeding = async (req, res) => {
  const { playerIds } = req.body || {};

  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ message: 'playerIds must be a non-empty array.' });
  }

  try {
    const result = await ratingService.generateSeeding(playerIds);
    res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error('generateSeeding:', error);
    }
    res.status(status).json({ message: error.message || 'Failed to generate seeding.' });
  }
};

exports.rebuildRatings = async (req, res) => {
  try {
    const summary = await ratingService.rebuildRatings();
    res.status(200).json({
      message: 'Player ratings rebuilt successfully.',
      ...summary,
    });
  } catch (error) {
    console.error('rebuildRatings:', error);
    res.status(500).json({ message: error.message || 'Failed to rebuild player ratings.' });
  }
};

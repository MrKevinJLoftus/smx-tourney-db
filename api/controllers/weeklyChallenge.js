const weeklyChallenge = require('../services/weeklyChallenge');
const weeklyChallengeHistory = require('../services/weeklyChallengeHistory');
const { Smx573Error } = require('../services/smx573Client');

exports.getWeeklyChallenge = async (req, res) => {
  const weekOffset = req.query.week == null || req.query.week === '' ? 0 : Number(req.query.week);

  weeklyChallengeHistory.finalizeDueWeeksInBackground();

  try {
    const result = await weeklyChallenge.getWeeklyChallenge({ weekOffset });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof weeklyChallenge.WeeklyChallengeError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error instanceof Smx573Error) {
      console.error('weeklyChallenge.get:', error.message);
      return res
        .status(502)
        .json({ message: `Could not load scores from smx.573.no: ${error.message}` });
    }
    throw error;
  }
};

exports.getBucketSettings = async (req, res) => {
  try {
    res.status(200).json(await weeklyChallenge.getBucketSettings());
  } catch (error) {
    if (error instanceof Smx573Error) {
      return res.status(502).json({ message: `Could not load charts from smx.573.no: ${error.message}` });
    }
    throw error;
  }
};

exports.saveBucketSetting = async (req, res) => {
  const { buckets, applyToCurrentWeek } = req.body || {};
  try {
    const result = await weeklyChallenge.saveBucketSetting({
      difficulty: req.params.difficulty,
      buckets,
      applyToCurrentWeek: applyToCurrentWeek === true,
      userId: req.userData && req.userData.userId,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof weeklyChallenge.WeeklyChallengeError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error instanceof Smx573Error) {
      return res.status(502).json({ message: `Saved, but reloading charts from smx.573.no failed: ${error.message}` });
    }
    throw error;
  }
};

exports.getAllTime = async (req, res) => {
  weeklyChallengeHistory.finalizeDueWeeksInBackground();

  try {
    const result = await weeklyChallengeHistory.getAllTime();
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof weeklyChallenge.WeeklyChallengeError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
};

const express = require('express');
const weeklyChallengeController = require('../controllers/weeklyChallenge');
const asyncWrapper = require('../middleware/async-wrapper');

const router = express.Router();

router.get('/', asyncWrapper(weeklyChallengeController.getWeeklyChallenge));
router.get('/all-time', asyncWrapper(weeklyChallengeController.getAllTime));

module.exports = router;

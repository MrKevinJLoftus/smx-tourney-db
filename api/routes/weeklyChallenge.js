const express = require('express');
const weeklyChallengeController = require('../controllers/weeklyChallenge');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');

const router = express.Router();

// Public routes
router.get('/', asyncWrapper(weeklyChallengeController.getWeeklyChallenge));
router.get('/all-time', asyncWrapper(weeklyChallengeController.getAllTime));

// Admin-only routes
router.get('/admin/buckets', checkAdmin, asyncWrapper(weeklyChallengeController.getBucketSettings));
router.put('/admin/buckets/:difficulty', checkAdmin, asyncWrapper(weeklyChallengeController.saveBucketSetting));

module.exports = router;

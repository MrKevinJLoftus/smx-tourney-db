const express = require('express');
const seedController = require('../controllers/seed');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

router.post('/generate', asyncWrapper(seedController.generateSeeding));
router.post('/rebuild-ratings', checkAdmin, asyncWrapper(seedController.rebuildRatings));

module.exports = router;

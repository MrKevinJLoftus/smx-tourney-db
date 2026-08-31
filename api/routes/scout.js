const express = require('express');
const scoutController = require('../controllers/scout');
const asyncWrapper = require('../middleware/async-wrapper');

const router = express.Router();

router.get('/players/search', asyncWrapper(scoutController.searchPlayers));
router.get('/players/resolve', asyncWrapper(scoutController.resolvePlayer));
router.post('/compare', asyncWrapper(scoutController.compare));

module.exports = router;

const express = require('express');
const browseController = require('../controllers/browse');
const asyncWrapper = require('../middleware/async-wrapper');
const router = express.Router();

// Public routes
router.get("/top5", asyncWrapper(browseController.getTop5Lists));

module.exports = router;


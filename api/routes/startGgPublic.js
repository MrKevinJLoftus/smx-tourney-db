const express = require('express');
const asyncWrapper = require('../middleware/async-wrapper');
const startGgPublicController = require('../controllers/startGgPublic');

const router = express.Router();

router.get(
  '/upcoming-stepmaniax',
  asyncWrapper(startGgPublicController.getUpcomingStepmaniax)
);

module.exports = router;


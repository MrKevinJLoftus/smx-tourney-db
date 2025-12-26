const express = require('express');
const eventPlayerController = require('../controllers/eventPlayer');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

// All routes are admin-only
router.post("/", checkAdmin, asyncWrapper(eventPlayerController.addPlayerToEvent));
router.put("/:id", checkAdmin, asyncWrapper(eventPlayerController.updateEventPlayer));
router.delete("/:id", checkAdmin, asyncWrapper(eventPlayerController.removePlayerFromEvent));

module.exports = router;


const express = require('express');
const playerController = require('../controllers/player');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

// Public routes
router.get("/", asyncWrapper(playerController.getAllPlayers));
router.get("/:id", asyncWrapper(playerController.getPlayerById));
router.get("/gamertag/:gamertag", asyncWrapper(playerController.getPlayerByGamertag));
router.get("/event/:eventId", asyncWrapper(playerController.getPlayersByEvent));

// Admin-only routes
router.post("/", checkAdmin, asyncWrapper(playerController.createPlayer));
router.put("/:id", checkAdmin, asyncWrapper(playerController.updatePlayer));

module.exports = router;


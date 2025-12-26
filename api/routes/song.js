const express = require('express');
const songController = require('../controllers/song');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

// Public routes
router.get("/", asyncWrapper(songController.getAllSongs));
router.get("/:id", asyncWrapper(songController.getSongById));

// Admin-only routes
router.post("/", checkAdmin, asyncWrapper(songController.createSong));
router.put("/:id", checkAdmin, asyncWrapper(songController.updateSong));
router.delete("/:id", checkAdmin, asyncWrapper(songController.deleteSong));

module.exports = router;


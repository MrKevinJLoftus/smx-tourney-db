const express = require('express');
const matchController = require('../controllers/match');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

// Public routes
router.get("/event/:eventId", asyncWrapper(matchController.getMatchesByEvent));
router.get("/:id", asyncWrapper(matchController.getMatchById));

// Admin-only routes
router.post("/", checkAdmin, asyncWrapper(matchController.createMatch));
router.put("/:id", checkAdmin, asyncWrapper(matchController.updateMatch));
router.delete("/:id", checkAdmin, asyncWrapper(matchController.deleteMatch));

module.exports = router;


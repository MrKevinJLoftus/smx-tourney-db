const express = require('express');
const eventController = require('../controllers/event');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

// Public routes
router.get("/", asyncWrapper(eventController.getAllEvents));
router.get("/:id", asyncWrapper(eventController.getEventById));

// Admin-only routes
router.post("/", checkAdmin, asyncWrapper(eventController.createEvent));
router.put("/:id", checkAdmin, asyncWrapper(eventController.updateEvent));
router.delete("/:id", checkAdmin, asyncWrapper(eventController.deleteEvent));

module.exports = router;


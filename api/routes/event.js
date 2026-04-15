const express = require('express');
const eventController = require('../controllers/event');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

// Public routes
router.get("/", asyncWrapper(eventController.getAllEvents));
router.get("/search", asyncWrapper(eventController.searchEvents));

// Admin-only routes
router.get("/admin/all", checkAdmin, asyncWrapper(eventController.getAllEventsAdmin));
router.post("/", checkAdmin, asyncWrapper(eventController.createEvent));
router.patch("/:id/hidden", checkAdmin, asyncWrapper(eventController.setEventHidden));
router.put("/:id", checkAdmin, asyncWrapper(eventController.updateEvent));
router.delete("/:id", checkAdmin, asyncWrapper(eventController.deleteEvent));

// Public route (keep after /admin/*)
router.get("/:id", asyncWrapper(eventController.getEventById));

module.exports = router;


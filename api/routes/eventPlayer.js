const express = require('express');
const multer = require('multer');
const eventPlayerController = require('../controllers/eventPlayer');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

// Configure multer for memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV files
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// All routes are admin-only
router.post("/", checkAdmin, asyncWrapper(eventPlayerController.addPlayerToEvent));
router.post("/event/:eventId/bulk-import", checkAdmin, upload.single('csv'), asyncWrapper(eventPlayerController.bulkImportPlayers));
router.put("/:id", checkAdmin, asyncWrapper(eventPlayerController.updateEventPlayer));
router.delete("/:id", checkAdmin, asyncWrapper(eventPlayerController.removePlayerFromEvent));

module.exports = router;


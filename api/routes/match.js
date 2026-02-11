const express = require('express');
const multer = require('multer');
const matchController = require('../controllers/match');
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
    // Accept JSON files
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  }
});

// Public routes
router.get("/search", asyncWrapper(matchController.searchMatches));
router.get("/player/:playerId", asyncWrapper(matchController.getMatchesByPlayer));
router.get("/event/:eventId", asyncWrapper(matchController.getMatchesByEvent));
router.get("/:id", asyncWrapper(matchController.getMatchById));

// Admin-only routes
router.post("/", checkAdmin, asyncWrapper(matchController.createMatch));
router.post("/bulk-import/:eventId", checkAdmin, upload.single('file'), asyncWrapper(matchController.bulkImportMatches));
router.put("/:id", checkAdmin, asyncWrapper(matchController.updateMatch));
router.delete("/:id", checkAdmin, asyncWrapper(matchController.deleteMatch));

module.exports = router;


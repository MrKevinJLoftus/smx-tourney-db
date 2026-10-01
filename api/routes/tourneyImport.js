const express = require('express');
const tourneyImportController = require('../controllers/tourneyImport');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');

const router = express.Router();

router.get(
  '/blamethepads/tourneys',
  checkAdmin,
  asyncWrapper(tourneyImportController.listBlamethepadsTourneys)
);
router.post('/preview', checkAdmin, asyncWrapper(tourneyImportController.previewTourneyImport));
router.post('/import', checkAdmin, asyncWrapper(tourneyImportController.importTourney));

module.exports = router;

const express = require('express');
const startGgImportController = require('../controllers/startGgImport');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');

const router = express.Router();

router.post('/preview', checkAdmin, asyncWrapper(startGgImportController.previewStartGgEvent));
router.post('/import', checkAdmin, asyncWrapper(startGgImportController.importFullStartGgEvent));
router.post(
  '/import-by-id',
  checkAdmin,
  asyncWrapper(startGgImportController.importStartGgEventById)
);
router.post(
  '/stepmania/refresh',
  checkAdmin,
  asyncWrapper(startGgImportController.refreshStepmaniaDiscovery)
);

module.exports = router;

const express = require('express');
const startGgImportController = require('../controllers/startGgImport');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAdmin = require('../middleware/check-admin');

const router = express.Router();

router.post('/preview', checkAdmin, asyncWrapper(startGgImportController.previewStartGgEvent));
router.post('/import', checkAdmin, asyncWrapper(startGgImportController.importFullStartGgEvent));

module.exports = router;

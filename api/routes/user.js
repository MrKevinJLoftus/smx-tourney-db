const express = require('express');
const userController = require('../controllers/user');
const asyncWrapper = require('../middleware/async-wrapper');
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const router = express.Router();

router.post("/login", asyncWrapper(userController.userLogin));
router.post("/signUp", checkAdmin, asyncWrapper(userController.createUser));
router.post("/updatePassword", checkAuth, asyncWrapper(userController.updatePassword));

module.exports = router;

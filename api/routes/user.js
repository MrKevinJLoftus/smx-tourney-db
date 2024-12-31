const express = require('express');
const userController = require('../controllers/user');
const asyncWrapper = require('../middleware/async-wrapper');
const router = express.Router();

router.post("/login", asyncWrapper(userController.userLogin));
router.post("/signUp", asyncWrapper(userController.createUser));

module.exports = router;

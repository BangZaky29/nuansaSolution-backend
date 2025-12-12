// backend/src/routes/session.routes.js
const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');

// Login / Logout
router.post('/login', sessionController.loginUser);
router.post('/logout', sessionController.logoutUser);

// Get sessions for a user
router.get('/:user_id', sessionController.getUserSessions);

module.exports = router;

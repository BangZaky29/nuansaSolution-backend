// backend/src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/session.middleware');

// Public route
router.get('/:user_id/access', userController.checkAccess);

// Protected routes
router.get('/:user_id/profile', authenticate, userController.getProfile);
router.get('/:user_id/orders', authenticate, userController.getOrders);

module.exports = router;

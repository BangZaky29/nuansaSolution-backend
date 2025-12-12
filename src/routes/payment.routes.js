// backend/src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/session.middleware');

// Semua payment routes butuh authentication
router.post('/create', authenticate, paymentController.createPayment);
router.get('/:order_id/status', authenticate, paymentController.getPaymentStatus);
router.post('/:order_id/cancel', authenticate, paymentController.cancelPayment);

module.exports = router;

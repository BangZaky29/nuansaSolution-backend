const express = require('express');
const router = express.Router();
const controller = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/session.middleware');

router.post('/create', authenticate, controller.createPayment);
router.get('/status/:order_id', authenticate, controller.getPaymentStatus);
router.post('/cancel/:order_id', authenticate, controller.cancelPayment);

module.exports = router;

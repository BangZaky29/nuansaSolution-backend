const express = require('express');
const router = express.Router();
const controller = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/session.middleware');

router.post('/create', authenticate, controller.createPayment);
router.get('/status/:order_id', authenticate, controller.getPaymentStatus);
router.post('/verify/:order_id', authenticate, controller.verifyPayment);
router.post('/resume/:order_id', authenticate, controller.resumePayment);
router.post('/cancel/:order_id', authenticate, controller.cancelPayment);
router.get('/invoice/:order_id', authenticate, controller.getInvoice);

module.exports = router;

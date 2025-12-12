const express = require('express');
const router = express.Router();
const ctrl = require('./tables.controller');

router.get('/orders', ctrl.getOrders);
router.get('/payments', ctrl.getPayments);
router.get('/users', ctrl.getUsers);
router.get('/user_sessions', ctrl.getUserSessions);
router.get('/otp_codes', ctrl.getOtpCodes);

module.exports = router;

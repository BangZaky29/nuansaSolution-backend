const express = require('express');
const router = express.Router();
const controller = require('../controllers/webhook.controller');

router.post('/midtrans', controller.handleMidtransNotification);
router.post('/midtrans-legacy', controller.midtransWebhook);

module.exports = router;

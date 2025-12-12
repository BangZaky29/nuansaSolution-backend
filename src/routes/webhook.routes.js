// backend/src/routes/webhook.routes.js
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// Webhook dari Midtrans (no auth needed)
router.post('/midtrans', webhookController.handleMidtransNotification);
router.get('/test', webhookController.testWebhook);

module.exports = router;

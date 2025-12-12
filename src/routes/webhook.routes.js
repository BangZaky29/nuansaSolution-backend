const express = require('express');
const router = express.Router();
const controller = require('../controllers/webhook.controller');

router.post('/midtrans', controller.midtransWebhook);

module.exports = router;

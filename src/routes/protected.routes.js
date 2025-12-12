// backend/src/routes/protected.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/session.middleware');
const { requireActiveOrder } = require('../middlewares/activeOrder.middleware');

// Route yang memerlukan order aktif
router.get('/dashboard', authenticate, requireActiveOrder, (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to dashboard',
    user: req.user,
    active_order: req.activeOrder
  });
});

router.get('/content', authenticate, requireActiveOrder, (req, res) => {
  res.json({
    success: true,
    message: 'Protected content',
    data: {
      content: 'This is premium content',
      user: req.user,
      order: req.activeOrder
    }
  });
});

module.exports = router;

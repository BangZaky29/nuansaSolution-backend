// backend/src/routes/feature.routes.js
const express = require('express');
const router = express.Router();
const { FeatureController, DocumentController } = require('../controllers/feature.controller');
const { authenticate } = require('../middlewares/session.middleware');
const { 
  requireFeature, 
  recordFeatureUsage,
  requireActiveSubscription 
} = require('../middlewares/feature.middleware');

// ============================================
// FEATURE MANAGEMENT ROUTES
// ============================================

// Get all available features (public)
router.get('/all', FeatureController.getAllFeatures);

// Get user's subscription (protected)
router.get('/my-subscription', authenticate, FeatureController.getMySubscription);

// Get usage history (protected)
router.get('/usage-history', authenticate, FeatureController.getUsageHistory);

// Check feature access (protected)
router.post('/check-access', authenticate, FeatureController.checkFeatureAccess);

// ============================================
// DOCUMENT GENERATION ROUTES (with Feature Protection)
// ============================================

// Surat Perjanjian
router.post(
  '/documents/generate-surat-perjanjian',
  authenticate,
  requireFeature('SURAT_PERJANJIAN'),
  recordFeatureUsage,
  DocumentController.generateSuratPerjanjian
);

// Surat Kuasa
router.post(
  '/documents/generate-surat-kuasa',
  authenticate,
  requireFeature('SURAT_KUASA'),
  recordFeatureUsage,
  DocumentController.generateSuratKuasa
);

// Surat Permohonan
router.post(
  '/documents/generate-surat-permohonan',
  authenticate,
  requireFeature('SURAT_PERMOHONAN'),
  recordFeatureUsage,
  async (req, res) => {
    // Implementation here
    res.json({ 
      success: true, 
      message: 'Surat permohonan generated',
      remaining_usage: req.feature.remaining_usage
    });
  }
);

// Add more document types as needed...

module.exports = router;

// ============================================
// backend/src/controllers/payment.controller.js (UPDATED)
// ============================================
const db = require('../config/db');
const midtransService = require('../services/midtrans.service');
const featureService = require('../services/feature.service');
const notificationService = require('../services/notification.service');

exports.createPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { user_id, package_code, payment_method } = req.body;

    if (!user_id || !package_code || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak lengkap'
      });
    }

    await connection.beginTransaction();

    // Get user
    const [users] = await connection.query(
      'SELECT email, phone FROM users WHERE id = ?',
      [user_id]
    );
    if (!users.length) throw new Error('User tidak ditemukan');

    // Get package details
    const [packages] = await connection.query(
      'SELECT * FROM packages WHERE package_code = ? AND is_active = TRUE',
      [package_code]
    );
    if (!packages.length) throw new Error('Package tidak ditemukan');

    const pkg = packages[0];

    // Expire old pending orders
    await connection.query(
      `UPDATE orders SET status = 'expired'
       WHERE user_id = ? AND status = 'pending'`,
      [user_id]
    );

    const order_id = `ORD-${user_id}-${Date.now()}`;
    const invoice_number = `INV-${Date.now()}`;

    // Insert order
    await connection.query(
      `INSERT INTO orders (user_id, order_id, package_id, package_name, gross_amount, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [user_id, order_id, pkg.id, pkg.package_name, pkg.price]
    );

    // Insert payment
    const [paymentMethods] = await connection.query(
      'SELECT id FROM payment_methods WHERE method_code = ?',
      [payment_method]
    );
    const payment_method_id = paymentMethods[0]?.id || null;

    await connection.query(
      `INSERT INTO payments (order_id, user_id, payment_method, payment_method_id, gross_amount, transaction_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [order_id, user_id, payment_method, payment_method_id, pkg.price]
    );

    // Create invoice
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // 24 hours

    await connection.query(
      `INSERT INTO invoices (invoice_number, order_id, user_id, package_id, subtotal, total, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?, 'unpaid', ?)`,
      [invoice_number, order_id, user_id, pkg.id, pkg.price, pkg.price, dueDate]
    );

    // Create Midtrans transaction
    const snapToken = await midtransService.createTransaction({
      order_id,
      gross_amount: pkg.price,
      customer_details: {
        email: users[0].email,
        phone: users[0].phone
      },
      item_details: [{
        id: pkg.package_code,
        name: pkg.package_name,
        price: pkg.price,
        quantity: 1
      }]
    });

    await connection.commit();

    res.json({
      success: true,
      data: {
        order_id,
        invoice_number,
        snap_token: snapToken,
        package: {
          code: pkg.package_code,
          name: pkg.package_name,
          price: pkg.price,
          duration_months: pkg.duration_months
        }
      }
    });

  } catch (err) {
    await connection.rollback();
    console.error('Create payment error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to create payment'
    });
  } finally {
    connection.release();
  }
};

// Get payment/invoice details
exports.getInvoice = async (req, res) => {
  try {
    const { order_id } = req.params;

    const [invoices] = await db.query(`
      SELECT 
        i.*,
        o.package_name,
        o.status AS order_status,
        p.transaction_status,
        p.payment_method,
        u.email,
        u.phone
      FROM invoices i
      JOIN orders o ON i.order_id = o.order_id
      JOIN payments p ON i.order_id = p.order_id
      JOIN users u ON i.user_id = u.id
      WHERE i.order_id = ?
    `, [order_id]);

    if (!invoices.length) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoices[0]
    });

  } catch (err) {
    console.error('Get invoice error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice'
    });
  }
};

// ============================================
// backend/src/controllers/webhook.controller.js (UPDATED)
// ============================================
exports.handleMidtransNotification = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const notification = req.body;
    
    console.log('📥 Midtrans Notification:', {
      order_id: notification.order_id,
      transaction_status: notification.transaction_status
    });

    const {
      order_id,
      transaction_status,
      fraud_status,
      status_code,
      gross_amount,
      signature_key,
      transaction_id,
      payment_type
    } = notification;

    // Verify signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const expectedSignature = require('crypto')
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');

    if (signature_key !== expectedSignature) {
      console.error('❌ Invalid signature');
      return res.status(403).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    await connection.beginTransaction();

    // Get order
    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE order_id = ?',
      [order_id]
    );

    if (!orders.length) {
      throw new Error('Order not found');
    }

    const order = orders[0];
    let updateStatus = order.status;

    // Determine order status
    if (transaction_status === 'capture' && fraud_status === 'accept') {
      updateStatus = 'paid';
    } else if (transaction_status === 'settlement') {
      updateStatus = 'paid';
    } else if (['deny', 'cancel'].includes(transaction_status)) {
      updateStatus = 'failed';
    } else if (transaction_status === 'expire') {
      updateStatus = 'expired';
    }

    // Update order
    await connection.query(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?',
      [updateStatus, order_id]
    );

    // Update payment
    await connection.query(
      `UPDATE payments SET 
        transaction_id = ?,
        transaction_status = ?,
        payment_method = ?,
        raw_response = ?,
        updated_at = NOW()
       WHERE order_id = ?`,
      [transaction_id, transaction_status, payment_type, JSON.stringify(notification), order_id]
    );

    // Update invoice
    if (updateStatus === 'paid') {
      await connection.query(
        'UPDATE invoices SET status = "paid", paid_at = NOW() WHERE order_id = ?',
        [order_id]
      );

      // ✨ CREATE SUBSCRIPTION (NEW!)
      try {
        const subscription = await featureService.createSubscription(order.user_id, order_id);
        
        console.log(`✅ Subscription created:`, subscription);

        // Send notification
        await notificationService.sendPaymentSuccess(order.user_id, {
          order_id,
          package_name: order.package_name,
          amount: order.gross_amount,
          subscription
        });

      } catch (subError) {
        console.error('Failed to create subscription:', subError);
        // Don't rollback payment if subscription creation fails
        // Just log the error and notify admin
      }
    }

    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Notification processed'
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Webhook Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    connection.release();
  }
};

// ============================================
// backend/src/app.js (UPDATE ROUTES)
// ============================================


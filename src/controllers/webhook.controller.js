// backend/src/controllers/webhook.controller.js

const crypto = require('crypto');
const db = require('../config/db');

/**
 * Verify Midtrans notification signature
 */
const verifySignature = (orderId, statusCode, grossAmount, serverKey) => {
  const hash = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
  return hash;
};

/**
 * Handle Midtrans notification webhook
 * POST /api/webhook/midtrans
 */
exports.handleMidtransNotification = async (req, res) => {
  try {
    const notification = req.body;
    
    console.log('📥 Midtrans Notification Received:', {
      order_id: notification.order_id,
      transaction_status: notification.transaction_status,
      fraud_status: notification.fraud_status,
      payment_type: notification.payment_type
    });

    // Extract notification data
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
    const expectedSignature = verifySignature(
      order_id,
      status_code,
      gross_amount,
      serverKey
    );

    if (signature_key !== expectedSignature) {
      console.error('❌ Invalid signature');
      return res.status(403).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Get order from database
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE order_id = ?',
      [order_id]
    );

    if (orders.length === 0) {
      console.error('❌ Order not found:', order_id);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];
    let updateStatus = order.status;

    // Handle transaction status berdasarkan database enum: 'pending','paid','expired','failed'
    if (transaction_status === 'capture') {
      if (fraud_status === 'accept') {
        updateStatus = 'paid';
      } else {
        updateStatus = 'failed';
      }
    } else if (transaction_status === 'settlement') {
      updateStatus = 'paid';
    } else if (transaction_status === 'pending') {
      updateStatus = 'pending';
    } else if (['deny', 'cancel'].includes(transaction_status)) {
      updateStatus = 'failed';
    } else if (transaction_status === 'expire') {
      updateStatus = 'expired';
    }

    // Update order status di tabel orders
    await db.query(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?',
      [updateStatus, order_id]
    );

    console.log(`✅ Order ${order_id} updated to ${updateStatus}`);

    // Update payment record di tabel payments
    await db.query(
      `UPDATE payments SET 
        transaction_id = ?,
        transaction_status = ?,
        payment_method = ?,
        raw_response = ?,
        updated_at = NOW()
       WHERE order_id = ?`,
      [
        transaction_id || null,
        transaction_status,
        payment_type || null,
        JSON.stringify(notification),
        order_id
      ]
    );

    console.log(`✅ Payment record updated for order ${order_id}`);

    // If payment successful, update order expiry_date
    if (updateStatus === 'paid') {
      // Calculate expiry date based on package
      let expiryMonths = 1; // Default 1 month
      if (order.package_name === 'Paket B') {
        expiryMonths = 3;
      } else if (order.package_name === 'Paket C') {
        expiryMonths = 6;
      }

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      // Update expiry_date di tabel orders
      await db.query(
        'UPDATE orders SET expiry_date = ? WHERE order_id = ?',
        [expiryDate, order_id]
      );

      console.log(`✅ Expiry date set for order ${order_id} until ${expiryDate}`);

      // TODO: Send email notification to user
      // await emailService.sendPaymentSuccess(order);
    }

    // Send success response
    res.status(200).json({
      success: true,
      message: 'Notification processed successfully'
    });

  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Manual payment verification (for testing)
 * GET /api/webhook/verify/:orderId
 */
exports.manualVerification = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔍 Manual verification for order: ${orderId}`);

    // Get order from database
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE order_id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Simulate successful payment notification
    const notification = {
      order_id: orderId,
      transaction_status: 'settlement',
      fraud_status: 'accept',
      status_code: '200',
      gross_amount: order.gross_amount.toString(),
      transaction_id: `TEST-${Date.now()}`,
      payment_type: 'manual_verification',
      signature_key: crypto
        .createHash('sha512')
        .update(
          `${orderId}200${order.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`
        )
        .digest('hex')
    };

    // Process notification
    req.body = notification;
    await exports.handleMidtransNotification(req, res);

  } catch (error) {
    console.error('❌ Manual verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
};

// Legacy webhook handler (untuk kompatibilitas dengan kode lama)
exports.midtransWebhook = async (req, res) => {
  try {
    console.log('🔥 WEBHOOK MASUK (Legacy Handler)');
    console.log(req.body);

    const { order_id, transaction_status } = req.body;

    let orderStatus = 'pending';

    if (transaction_status === 'settlement') {
      orderStatus = 'paid';
    } else if (['cancel', 'expire', 'deny'].includes(transaction_status)) {
      orderStatus = 'failed';
    }

    // Update orders table
    await db.query(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?',
      [orderStatus, order_id]
    );

    // Update payments table
    await db.query(
      `UPDATE payments SET
        transaction_id = ?,
        transaction_status = ?,
        payment_method = ?,
        raw_response = ?,
        updated_at = NOW()
       WHERE order_id = ?`,
      [
        req.body.transaction_id,
        transaction_status,
        req.body.payment_type,
        JSON.stringify(req.body),
        order_id
      ]
    );

    console.log(`✅ Order ${order_id} updated to ${orderStatus}`);

    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ WEBHOOK ERROR:', err);
    res.status(500).send('ERROR');
  }
};

module.exports = exports;
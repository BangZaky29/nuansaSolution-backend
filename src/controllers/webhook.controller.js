// backend/src/controllers/webhook.controller.js
const crypto = require('crypto');
const db = require('../config/db');

// POST /api/webhook/midtrans
// Handle Midtrans notification webhook
exports.handleMidtransNotification = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const notification = req.body;
    
    // 🔥 STEP 1: VERIFY SIGNATURE
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const signatureKey = crypto
      .createHash('sha512')
      .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`)
      .digest('hex');

    if (signatureKey !== notification.signature_key) {
      return res.status(403).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const {
      order_id,
      transaction_status,
      fraud_status,
      transaction_id,
      payment_type,
      transaction_time,
      settlement_time,
      status_code,
      gross_amount
    } = notification;

    console.log(`🔔 Webhook received: ${order_id} - ${transaction_status}`);

    await connection.beginTransaction();

    // 🔥 STEP 2: UPDATE PAYMENT RECORD
    await connection.query(
      `UPDATE payments 
       SET transaction_id = ?,
           transaction_status = ?,
           payment_type = ?,
           transaction_time = ?,
           settlement_time = ?,
           fraud_status = ?,
           status_code = ?
       WHERE order_id = ?`,
      [
        transaction_id,
        transaction_status,
        payment_type,
        transaction_time || null,
        settlement_time || null,
        fraud_status || null,
        status_code,
        order_id
      ]
    );

    // 🔥 STEP 3: HANDLE BERDASARKAN STATUS
    let orderStatus = 'pending';
    let shouldActivate = false;

    if (transaction_status === 'capture') {
      if (fraud_status === 'accept') {
        orderStatus = 'paid';
        shouldActivate = true;
      } else {
        orderStatus = 'failed';
      }
    } else if (transaction_status === 'settlement') {
      orderStatus = 'paid';
      shouldActivate = true;
    } else if (transaction_status === 'deny' || transaction_status === 'cancel') {
      orderStatus = 'failed';
    } else if (transaction_status === 'expire') {
      orderStatus = 'expired';
    }

    // 🔥 STEP 4: AKTIVASI PAKET JIKA SETTLEMENT/CAPTURE SUCCESS
    // Update status order sesuai hasil transaksi
    await connection.query(
      `UPDATE orders 
       SET status = ?
       WHERE order_id = ?`,
      [orderStatus, order_id]
    );

    // 🔥 STEP 5: VALIDASI - CEK TIDAK ADA DUPLICATE ACTIVE ORDER
    const [user] = await connection.query(
      'SELECT user_id FROM orders WHERE order_id = ?',
      [order_id]
    );

    if (user.length > 0 && shouldActivate) {
      const user_id = user[0].user_id;
      
      // Count active orders (seharusnya hanya 1)
      const [activeCount] = await connection.query(
        `SELECT COUNT(*) as count 
         FROM orders 
         WHERE user_id = ? 
           AND status = 'paid'`,
        [user_id]
      );

      if (activeCount[0].count > 1) {
        console.error(`⚠️ WARNING: User ${user_id} has ${activeCount[0].count} active orders!`);
        
        // Emergency fix: keep only the newest one
        await connection.query(
          `UPDATE orders
           SET status = 'expired'
           WHERE user_id = ?
             AND status = 'paid'
             AND order_id != ?`,
          [user_id, order_id]
        );
        
        console.log(`🔧 Fixed: Expired old orders, keeping only ${order_id}`);
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Notification processed',
      data: {
        order_id,
        status: orderStatus,
        activated: shouldActivate
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing notification',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// GET /api/webhook/test
// Test endpoint untuk simulasi webhook
exports.testWebhook = async (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is working'
  });
};

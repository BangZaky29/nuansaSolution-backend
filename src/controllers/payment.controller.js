// backend/src/controllers/payment.controller.js
const db = require('../config/db');
const midtransService = require('../services/midtrans.service');

// POST /api/payment/create
// CRITICAL: Auto expire order lama saat buat order baru
exports.createPayment = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { user_id, package_name, gross_amount } = req.body;

    // Validasi input
    if (!user_id || !package_name || !gross_amount) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak lengkap'
      });
    }

    await connection.beginTransaction();

    // 🔥 STEP 1: EXPIRE SEMUA ORDER AKTIF USER
    const [expireResult] = await connection.query(
      `UPDATE orders
       SET status = 'expired'
       WHERE user_id = ? 
         AND status = 'paid'`,
      [user_id]
    );

    console.log(`✅ Expired ${expireResult.affectedRows} old active orders for user ${user_id}`);

    // 🔥 STEP 2: GENERATE ORDER ID BARU
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const order_id = `ORD-${user_id}-${timestamp}-${random}`;


    // 🔥 STEP 4: INSERT ORDER BARU dengan status PENDING
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (user_id, order_id, gross_amount, package_name, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [user_id, order_id, gross_amount, package_name]
    );

    // 🔥 STEP 5: INSERT PAYMENT RECORD
    await connection.query(
      `INSERT INTO payments 
       (user_id, order_id, gross_amount, transaction_status)
       VALUES (?, ?, ?, 'pending')`,
      [user_id, order_id, gross_amount]
    );

    // 🔥 STEP 6: GENERATE MIDTRANS SNAP TOKEN
    const [users] = await connection.query(
      'SELECT email, phone FROM users WHERE id = ?',
      [user_id]
    );

    if (users.length === 0) {
      throw new Error('User tidak ditemukan');
    }

    const user = users[0];
    
    const snapToken = await midtransService.createTransaction({
      order_id,
      gross_amount,
      customer_details: {
        email: user.email,
        phone: user.phone
      },
      item_details: [{
        id: order_id,
        price: gross_amount,
        quantity: 1,
        name: package_name
      }]
    });

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Order berhasil dibuat. Order aktif sebelumnya telah dinonaktifkan.',
      data: {
        order_id,
        snap_token: snapToken,
        package_name,
        gross_amount,
        expired_old_orders: expireResult.affectedRows
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat payment',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// GET /api/payment/:order_id/status
// Cek status payment
exports.getPaymentStatus = async (req, res) => {
  const { order_id } = req.params;

  try {
    const [payments] = await db.query(
      `SELECT 
        p.order_id,
        p.transaction_id,
        p.transaction_status,
        p.payment_type,
        p.gross_amount,
        p.transaction_time,
        p.settlement_time,
        o.status as order_status,
        o.package_name
      FROM payments p
      JOIN orders o ON p.order_id = o.order_id
      WHERE p.order_id = ?`,
      [order_id]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: payments[0]
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil status payment'
    });
  }
};

// POST /api/payment/:order_id/cancel
// Cancel payment/order
exports.cancelPayment = async (req, res) => {
  const { order_id } = req.params;

  try {
    // Update order status
    await db.query(
      `UPDATE orders SET status = 'failed' WHERE order_id = ?`,
      [order_id]
    );

    // Update payment status
    await db.query(
      `UPDATE payments SET transaction_status = 'cancel' WHERE order_id = ?`,
      [order_id]
    );

    res.json({
      success: true,
      message: 'Order berhasil dibatalkan'
    });

  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membatalkan order'
    });
  }
};

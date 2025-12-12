const db = require('../config/db');
const midtransService = require('../services/midtrans.service');

// ================= CREATE PAYMENT =================
exports.createPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { user_id, package_name, gross_amount, payment_method } = req.body;

    if (!user_id || !package_name || !gross_amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak lengkap'
      });
    }

    if (!['va_bca', 'qris'].includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Metode pembayaran tidak valid'
      });
    }

    await connection.beginTransaction();

    // cek user
    const [users] = await connection.query(
      `SELECT email, phone FROM users WHERE id=?`,
      [user_id]
    );
    if (!users.length) throw new Error('User tidak ditemukan');

    // expire order lama
    await connection.query(
      `UPDATE orders SET status='expired'
       WHERE user_id=? AND status='pending'`,
      [user_id]
    );

    const order_id = `ORD-${user_id}-${Date.now()}`;

    // insert order
    await connection.query(
      `INSERT INTO orders (user_id, order_id, package_name, gross_amount, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [user_id, order_id, package_name, gross_amount]
    );

    // insert payment
    await connection.query(
      `INSERT INTO payments
       (order_id, user_id, payment_method, gross_amount, transaction_status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [order_id, user_id, payment_method, gross_amount]
    );

    // midtrans snap
    const snapToken = await midtransService.createTransaction({
      order_id,
      gross_amount,
      customer_details: {
        email: users[0].email,
        phone: users[0].phone
      },
      item_details: [{
        id: order_id,
        name: package_name,
        price: gross_amount,
        quantity: 1
      }]
    });

    await connection.commit();

    res.json({
      success: true,
      data: {
        order_id,
        snap_token: snapToken
      }
    });

  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
};

// ================= GET STATUS =================
exports.getPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.params;

    const [rows] = await db.query(
      `SELECT o.order_id, o.status AS order_status,
              p.transaction_status, p.payment_method, p.gross_amount
       FROM orders o
       JOIN payments p ON o.order_id = p.order_id
       WHERE o.order_id = ?`,
      [order_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan'
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= CANCEL =================
exports.cancelPayment = async (req, res) => {
  try {
    const { order_id } = req.params;

    await midtransService.cancelTransaction(order_id);

    await db.query(
      `UPDATE orders SET status='failed' WHERE order_id=?`,
      [order_id]
    );

    await db.query(
      `UPDATE payments SET transaction_status='cancel' WHERE order_id=?`,
      [order_id]
    );

    res.json({ success: true, message: 'Payment dibatalkan' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

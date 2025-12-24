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
       LEFT JOIN payments p ON o.order_id = p.order_id
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

// ================= VERIFY PAYMENT FROM MIDTRANS =================
exports.verifyPayment = async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user?.user_id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get order from database
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE order_id = ? AND user_id = ?',
      [order_id, user_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan'
      });
    }

    // Check transaction status from Midtrans
    const midtransStatus = await midtransService.checkTransactionStatus(order_id);
    
    console.log('Midtrans transaction status:', midtransStatus);

    const transactionStatus = midtransStatus.transaction_status;
    let updateStatus = orders[0].status;

    // Update status berdasarkan Midtrans
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      updateStatus = 'paid';
    } else if (['deny', 'cancel'].includes(transactionStatus)) {
      updateStatus = 'failed';
    } else if (transactionStatus === 'expire') {
      updateStatus = 'expired';
    } else if (transactionStatus === 'pending') {
      updateStatus = 'pending';
    }

    // Update order status if changed
    if (updateStatus !== orders[0].status) {
      await db.query(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?',
        [updateStatus, order_id]
      );

      // Update payment record
      await db.query(
        `UPDATE payments SET 
          transaction_id = ?,
          transaction_status = ?,
          payment_method = ?,
          raw_response = ?,
          updated_at = NOW()
         WHERE order_id = ?`,
        [
          midtransStatus.transaction_id || null,
          transactionStatus,
          midtransStatus.payment_type || null,
          JSON.stringify(midtransStatus),
          order_id
        ]
      );

      console.log(`✅ Order ${order_id} verified and updated to ${updateStatus}`);
    }

    res.json({
      success: true,
      data: {
        order_id,
        status: updateStatus,
        transaction_status: transactionStatus,
        midtrans_data: midtransStatus
      }
    });

  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Gagal memverifikasi pembayaran'
    });
  }
};

// ================= RESUME PAYMENT =================
exports.resumePayment = async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user?.user_id;

    console.log('Resume payment request:', { order_id, user_id });

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get order data
    const [orders] = await db.query(
      `SELECT o.order_id, o.user_id, o.package_name, o.gross_amount, o.status,
              p.payment_method
       FROM orders o
       LEFT JOIN payments p ON o.order_id = p.order_id
       WHERE o.order_id = ? AND o.user_id = ?`,
      [order_id, user_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan'
      });
    }

    const order = orders[0];

    // Check if order is pending
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Order tidak dapat dilanjutkan. Status: ' + order.status
      });
    }

    // Get user data
    const [users] = await db.query(
      `SELECT email, phone FROM users WHERE id=?`,
      [user_id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    // Convert gross_amount to number if it's a string (from DECIMAL)
    const grossAmount = Number(order.gross_amount);

    // Create new snap token for existing order
    const snapToken = await midtransService.createTransaction({
      order_id: order.order_id,
      gross_amount: grossAmount,
      customer_details: {
        email: users[0].email,
        phone: users[0].phone
      },
      item_details: [{
        id: order.order_id,
        name: order.package_name,
        price: grossAmount,
        quantity: 1
      }]
    });

    res.json({
      success: true,
      data: {
        order_id: order.order_id,
        snap_token: snapToken
      }
    });

  } catch (err) {
    console.error('Resume payment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= CANCEL =================
exports.cancelPayment = async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user?.user_id;

    console.log('Cancel payment request:', { order_id, user_id });

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Verify order belongs to user
    const [orders] = await db.query(
      `SELECT order_id, status FROM orders WHERE order_id = ? AND user_id = ?`,
      [order_id, user_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan'
      });
    }

    const order = orders[0];

    // Only allow cancel for pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Order tidak dapat dibatalkan. Status: ' + order.status
      });
    }

    // Try to cancel in Midtrans (optional, continue even if fails)
    try {
      await midtransService.cancelTransaction(order_id);
    } catch (midtransError) {
      // Continue even if Midtrans cancel fails (order might already be expired)
      console.warn('Midtrans cancel error:', midtransError.message);
    }

    // Update order status
    await db.query(
      `UPDATE orders SET status='failed' WHERE order_id=?`,
      [order_id]
    );

    // Update payment status if payment record exists
    await db.query(
      `UPDATE payments SET transaction_status='cancel' WHERE order_id=?`,
      [order_id]
    );

    res.json({ 
      success: true, 
      message: 'Pembayaran berhasil dibatalkan' 
    });
  } catch (err) {
    console.error('Cancel payment error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Terjadi kesalahan saat membatalkan pembayaran'
    });
  }
};

// ================= GET INVOICE =================
exports.getInvoice = async (req, res) => {
  try {
    const { order_id } = req.params;
    const [invoices] = await db.query(`
      SELECT 
        o.order_id,
        o.package_name,
        o.gross_amount,
        o.status AS order_status,
        p.transaction_status,
        p.payment_method,
        u.email,
        u.phone
      FROM orders o
      LEFT JOIN payments p ON o.order_id = p.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_id = ?
    `, [order_id]);

    if (!invoices.length) {
      return res.status(404).json({
        success: false,
        message: 'Invoice tidak ditemukan'
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
      message: 'Gagal mengambil invoice'
    });
  }
};

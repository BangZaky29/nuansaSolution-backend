// backend/src/controllers/user.controller.js
const db = require('../config/db');

// GET /api/user/:user_id/access
// Cek apakah user punya akses aktif
exports.checkAccess = async (req, res) => {
  const { user_id } = req.params;

  try {
    // Query order aktif user
    const [orders] = await db.query(
      `SELECT 
        o.id,
        o.order_id,
        o.package_name,
        o.gross_amount,
        o.status,
        o.created_at
      FROM orders o
      WHERE o.user_id = ? 
        AND o.status = 'paid'
      ORDER BY o.created_at DESC
      LIMIT 1`,
      [user_id]
    );

    if (orders.length === 0) {
      return res.json({
        success: true,
        access: false,
        message: 'Tidak ada paket aktif',
        data: null
      });
    }

    const activeOrder = orders[0];

    res.json({
      success: true,
      access: true,
      message: 'User memiliki paket aktif',
      data: {
        order_id: activeOrder.order_id,
        package_name: activeOrder.package_name,
        gross_amount: activeOrder.gross_amount
      }
    });

  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat cek akses'
    });
  }
};

// GET /api/user/:user_id/profile
// Get user profile dan order history
exports.getProfile = async (req, res) => {
  const { user_id } = req.params;

  try {
    // Get user data
    const [users] = await db.query(
      'SELECT id, email, phone, created_at FROM users WHERE id = ?',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    // Get active order
    const [activeOrders] = await db.query(
      `SELECT 
        order_id,
        package_name,
        gross_amount,
        status
      FROM orders
      WHERE user_id = ? 
        AND status = 'paid'
      ORDER BY created_at DESC
      LIMIT 1`,
      [user_id]
    );

    // Get order history
    const [orderHistory] = await db.query(
      `SELECT 
        order_id,
        package_name,
        gross_amount,
        status,
        created_at
      FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10`,
      [user_id]
    );

    res.json({
      success: true,
      data: {
        user: users[0],
        active_order: activeOrders[0] || null,
        order_history: orderHistory
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil profil'
    });
  }
};

// GET /api/user/:user_id/orders
// Get all orders dari user
exports.getOrders = async (req, res) => {
  const { user_id } = req.params;
  const { status } = req.query;

  try {
    let query = `
      SELECT 
        o.order_id,
        o.package_name,
        o.gross_amount,
        o.status,
        o.created_at,
        p.transaction_status,
        p.payment_type
      FROM orders o
      LEFT JOIN payments p ON o.order_id = p.order_id
      WHERE o.user_id = ?
    `;

    const params = [user_id];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC';

    const [orders] = await db.query(query, params);

    res.json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data order'
    });
  }
};

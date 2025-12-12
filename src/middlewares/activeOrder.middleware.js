// ============================================
// backend/src/middlewares/activeOrder.middleware.js
// ============================================

const dbPool = require('../config/db');

// Middleware untuk cek apakah user punya order aktif
exports.requireActiveOrder = async (req, res, next) => {
  try {
    const user_id = req.user?.user_id || req.params.user_id;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID tidak ditemukan'
      });
    }

    // Query order aktif
    const [orders] = await dbPool.query(
      `SELECT 
        order_id,
        package_name,
        status
       FROM orders
       WHERE user_id = ? 
         AND status = 'paid'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user_id]
    );

    if (orders.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Anda tidak memiliki paket aktif.',
        access: false
      });
    }

    // Set active order info ke request
    req.activeOrder = orders[0];
    next();

  } catch (error) {
    console.error('Active order check error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat cek akses'
    });
  }
};

// Middleware untuk cek apakah user TIDAK punya order aktif
// (berguna untuk prevent duplicate purchase)
exports.preventDuplicateOrder = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID tidak ditemukan'
      });
    }

    // Query order aktif
    const [orders] = await dbPool.query(
      `SELECT order_id, package_name
       FROM orders
       WHERE user_id = ? 
         AND status = 'paid'`,
      [user_id]
    );

    if (orders.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Anda sudah memiliki paket aktif. Paket lama akan diganti dengan paket baru.',
        current_order: orders[0],
        warning: 'Pembelian baru akan menggantikan paket aktif saat ini'
      });
    }

    next();

  } catch (error) {
    console.error('Duplicate order check error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat cek order'
    });
  }
};

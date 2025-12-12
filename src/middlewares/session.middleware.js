// backend/src/middlewares/session.middleware.js
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan'
      });
    }

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );

    // Cek sesi login aktif di database
    const [sessions] = await db.query(
      `SELECT id 
       FROM user_sessions 
       WHERE user_id = ? AND logout_at IS NULL 
       ORDER BY login_at DESC 
       LIMIT 1`,
      [decoded.user_id]
    );
    if (sessions.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Sesi tidak aktif'
      });
    }

    // Set user info ke request
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email
    };

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// src/controllers/session.controller.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Login user
 */
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [userRows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (userRows.length === 0) return res.status(401).json({ message: "Invalid email or password" });

    const user = userRows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ message: "Invalid email or password" });

    // buat session
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const [sessionResult] = await db.query(
      "INSERT INTO user_sessions (user_id, ip_address) VALUES (?, ?)",
      [user.id, ipAddress]
    );

    res.status(200).json({
      message: "Login successful",
      user_id: user.id,
      session_id: sessionResult.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
};

/**
 * Logout user
 */
exports.logoutUser = async (req, res) => {
  try {
    const { session_id } = req.body;
    await db.query("UPDATE user_sessions SET logout_at = NOW() WHERE id = ?", [session_id]);
    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Logout failed" });
  }
};

/**
 * Get all sessions for a user
 */
exports.getUserSessions = async (req, res) => {
  try {
    const { user_id } = req.params;
    const [sessions] = await db.query(
      "SELECT * FROM user_sessions WHERE user_id = ? ORDER BY login_at DESC",
      [user_id]
    );
    res.status(200).json({ sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
};

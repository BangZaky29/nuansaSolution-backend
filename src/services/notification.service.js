// backend/src/services/notification.service.js
const db = require('../config/db');
// TODO: Install nodemailer: npm install nodemailer
// const nodemailer = require('nodemailer');

class NotificationService {
  constructor() {
    // Configure email transporter
    // this.transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_HOST,
    //   port: process.env.SMTP_PORT,
    //   secure: true,
    //   auth: {
    //     user: process.env.SMTP_USER,
    //     pass: process.env.SMTP_PASS
    //   }
    // });
  }

  /**
   * Create notification in database
   */
  async createNotification(userId, type, title, message, data = {}) {
    try {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, message, JSON.stringify(data)]
      );

      console.log(`✅ Notification created for user ${userId}: ${title}`);

    } catch (error) {
      console.error('Create notification error:', error);
    }
  }

  /**
   * Send payment success notification
   */
  async sendPaymentSuccess(userId, paymentData) {
    try {
      const { order_id, package_name, amount, subscription } = paymentData;

      // Create in-app notification
      await this.createNotification(
        userId,
        'payment',
        'Pembayaran Berhasil! 🎉',
        `Pembayaran untuk ${package_name} sebesar Rp ${amount.toLocaleString('id-ID')} telah berhasil. Akses Anda aktif hingga ${new Date(subscription.expired_at).toLocaleDateString('id-ID')}.`,
        {
          order_id,
          package_name,
          subscription_id: subscription.subscription_id
        }
      );

      // Send email (TODO: uncomment when email is configured)
      // await this.sendEmail(
      //   userId,
      //   'Pembayaran Berhasil - Nuansa Solution',
      //   this.getPaymentSuccessEmailTemplate(paymentData)
      // );

      console.log(`✅ Payment success notification sent to user ${userId}`);

    } catch (error) {
      console.error('Send payment success notification error:', error);
    }
  }

  /**
   * Send subscription expiring notification
   */
  async sendSubscriptionExpiring(userId, subscription) {
    try {
      const { package_name, expired_at, days_remaining } = subscription;

      await this.createNotification(
        userId,
        'subscription',
        '⚠️ Langganan Akan Berakhir',
        `Langganan ${package_name} Anda akan berakhir dalam ${days_remaining} hari (${new Date(expired_at).toLocaleDateString('id-ID')}). Perpanjang sekarang untuk terus menikmati layanan.`,
        {
          subscription_id: subscription.id,
          expired_at,
          days_remaining
        }
      );

      // Send email
      // await this.sendEmail(...);

      console.log(`✅ Expiring notification sent to user ${userId}`);

    } catch (error) {
      console.error('Send expiring notification error:', error);
    }
  }

  /**
   * Send feature usage limit notification
   */
  async sendFeatureUsageLimitReached(userId, featureCode, featureName) {
    try {
      await this.createNotification(
        userId,
        'feature',
        '⚠️ Batas Penggunaan Tercapai',
        `Anda telah mencapai batas penggunaan untuk fitur "${featureName}". Upgrade paket Anda untuk akses unlimited.`,
        { feature_code: featureCode }
      );

      console.log(`✅ Usage limit notification sent to user ${userId}`);

    } catch (error) {
      console.error('Send usage limit notification error:', error);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, limit = 20) {
    try {
      const [notifications] = await db.query(
        `SELECT * FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, limit]
      );

      return notifications;

    } catch (error) {
      console.error('Get user notifications error:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      await db.query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE id = ? AND user_id = ?`,
        [notificationId, userId]
      );

      return { success: true };

    } catch (error) {
      console.error('Mark notification as read error:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      await db.query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE user_id = ? AND is_read = FALSE`,
        [userId]
      );

      return { success: true };

    } catch (error) {
      console.error('Mark all as read error:', error);
      throw error;
    }
  }

  /**
   * Email template for payment success
   */
  getPaymentSuccessEmailTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Pembayaran Berhasil!</h1>
          </div>
          <div class="content">
            <p>Terima kasih atas pembayaran Anda.</p>
            <p><strong>Detail Pembayaran:</strong></p>
            <ul>
              <li>Order ID: ${data.order_id}</li>
              <li>Paket: ${data.package_name}</li>
              <li>Jumlah: Rp ${data.amount.toLocaleString('id-ID')}</li>
              <li>Aktif hingga: ${new Date(data.subscription.expired_at).toLocaleDateString('id-ID')}</li>
            </ul>
            <p>Anda sekarang dapat mengakses semua fitur yang tersedia di paket Anda.</p>
          </div>
          <div class="footer">
            <p>Nuansa Solution - Platform Layanan Legal Terpercaya</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send email (generic method)
   */
  async sendEmail(userId, subject, htmlContent) {
    try {
      // Get user email
      const [users] = await db.query(
        'SELECT email FROM users WHERE id = ?',
        [userId]
      );

      if (!users.length) {
        throw new Error('User not found');
      }

      // TODO: Uncomment when email is configured
      // const mailOptions = {
      //   from: process.env.SMTP_FROM,
      //   to: users[0].email,
      //   subject,
      //   html: htmlContent
      // };

      // await this.transporter.sendMail(mailOptions);

      console.log(`✅ Email would be sent to ${users[0].email}`);

    } catch (error) {
      console.error('Send email error:', error);
    }
  }
}

module.exports = new NotificationService();

// ============================================
// backend/src/controllers/notification.controller.js
// ============================================
const notificationService = require('../services/notification.service');

class NotificationController {
  /**
   * GET /api/notifications
   * Get user notifications
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.user_id;
      const limit = parseInt(req.query.limit) || 20;

      const notifications = await notificationService.getUserNotifications(userId, limit);

      const unreadCount = notifications.filter(n => !n.is_read).length;

      res.json({
        success: true,
        data: {
          notifications,
          unread_count: unreadCount
        }
      });

    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications'
      });
    }
  }

  /**
   * PUT /api/notifications/:id/read
   * Mark notification as read
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;

      await notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        message: 'Notification marked as read'
      });

    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * PUT /api/notifications/mark-all-read
   * Mark all notifications as read
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.user_id;

      await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });

    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  }
}

module.exports = new NotificationController();

// ============================================
// backend/src/routes/notification.routes.js
// ============================================
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/session.middleware');

router.get('/', authenticate, notificationController.getNotifications);
router.put('/:id/read', authenticate, notificationController.markAsRead);
router.put('/mark-all-read', authenticate, notificationController.markAllAsRead);

module.exports = router;

// Add to app.js:
// const notificationRoutes = require('./routes/notification.routes');
// app.use(`${apiPrefix}/notifications`, notificationRoutes);
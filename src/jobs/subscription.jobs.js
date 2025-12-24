// backend/src/jobs/subscription.jobs.js
// Install: npm install node-cron
const cron = require('node-cron');
const db = require('../config/db');
const featureService = require('../services/feature.service');
const notificationService = require('../services/notification.service');

class SubscriptionJobs {
  /**
   * Initialize all cron jobs
   */
  init() {
    console.log('🕒 Initializing subscription cron jobs...');

    // Run every hour to check expired subscriptions
    this.scheduleExpireCheck();

    // Run daily at 09:00 to send expiring notifications
    this.scheduleExpiringNotifications();

    // Run daily at 10:00 to clean up old data
    this.scheduleCleanup();

    console.log('✅ All cron jobs initialized');
  }

  /**
   * Check and expire subscriptions every hour
   */
  scheduleExpireCheck() {
    // Run at minute 0 of every hour
    cron.schedule('0 * * * *', async () => {
      console.log('🔄 Running expire check...');
      
      try {
        const [result] = await db.query(`
          UPDATE subscriptions
          SET status = 'expired'
          WHERE status = 'active' 
            AND expired_at < NOW()
        `);

        if (result.affectedRows > 0) {
          console.log(`✅ Expired ${result.affectedRows} subscriptions`);
        }

      } catch (error) {
        console.error('❌ Expire check error:', error);
      }
    });

    console.log('  ✓ Expire check job scheduled (every hour)');
  }

  /**
   * Send expiring subscription notifications daily at 09:00
   */
  scheduleExpiringNotifications() {
    // Run at 09:00 every day
    cron.schedule('0 9 * * *', async () => {
      console.log('🔄 Sending expiring notifications...');
      
      try {
        // Get subscriptions expiring in 7 days
        const expiring7Days = await featureService.getExpiringSubscriptions(7);
        
        for (const sub of expiring7Days) {
          await notificationService.sendSubscriptionExpiring(sub.user_id, sub);
        }

        console.log(`✅ Sent ${expiring7Days.length} expiring (7 days) notifications`);

        // Get subscriptions expiring in 3 days
        const expiring3Days = await featureService.getExpiringSubscriptions(3);
        
        for (const sub of expiring3Days) {
          await notificationService.sendSubscriptionExpiring(sub.user_id, sub);
        }

        console.log(`✅ Sent ${expiring3Days.length} expiring (3 days) notifications`);

        // Get subscriptions expiring in 1 day
        const expiring1Day = await featureService.getExpiringSubscriptions(1);
        
        for (const sub of expiring1Day) {
          await notificationService.sendSubscriptionExpiring(sub.user_id, sub);
        }

        console.log(`✅ Sent ${expiring1Day.length} expiring (1 day) notifications`);

      } catch (error) {
        console.error('❌ Expiring notifications error:', error);
      }
    });

    console.log('  ✓ Expiring notifications job scheduled (daily at 09:00)');
  }

  /**
   * Clean up old data daily at 10:00
   */
  scheduleCleanup() {
    // Run at 10:00 every day
    cron.schedule('0 10 * * *', async () => {
      console.log('🔄 Running data cleanup...');
      
      try {
        // Delete old expired orders (older than 90 days)
        const [orderResult] = await db.query(`
          DELETE FROM orders
          WHERE status = 'expired' 
            AND updated_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
        `);

        console.log(`✅ Cleaned up ${orderResult.affectedRows} old expired orders`);

        // Delete old read notifications (older than 30 days)
        const [notifResult] = await db.query(`
          DELETE FROM notifications
          WHERE is_read = TRUE 
            AND read_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        console.log(`✅ Cleaned up ${notifResult.affectedRows} old notifications`);

        // Delete old feature logs (older than 180 days)
        const [logResult] = await db.query(`
          DELETE FROM feature_logs
          WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)
        `);

        console.log(`✅ Cleaned up ${logResult.affectedRows} old feature logs`);

      } catch (error) {
        console.error('❌ Cleanup error:', error);
      }
    });

    console.log('  ✓ Data cleanup job scheduled (daily at 10:00)');
  }

  /**
   * Manual trigger for testing
   */
  async runExpireCheckNow() {
    console.log('🔄 Manual expire check triggered...');
    
    try {
      const [result] = await db.query(`
        UPDATE subscriptions
        SET status = 'expired'
        WHERE status = 'active' 
          AND expired_at < NOW()
      `);

      return {
        success: true,
        expired_count: result.affectedRows
      };

    } catch (error) {
      console.error('Manual expire check error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SubscriptionJobs();

// ============================================
// Add to backend/src/app.js
// ============================================

// After const app = express();
const subscriptionJobs = require('./jobs/subscription.jobs');

// Initialize cron jobs after server starts
app.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start cron jobs
  if (process.env.ENABLE_CRON === 'true') {
    subscriptionJobs.init();
  }
});

// Manual trigger endpoint (for testing/admin)
app.post(`${apiPrefix}/admin/expire-check`, authenticate, async (req, res) => {
  // TODO: Add admin role check
  const result = await subscriptionJobs.runExpireCheckNow();
  res.json(result);
});

// ============================================
// .env additions
// ============================================

// Add to .env:
// ENABLE_CRON=true
// SMTP_HOST=smtp.gmail.com
// SMTP_PORT=465
// SMTP_USER=your-email@gmail.com
// SMTP_PASS=your-app-password
// SMTP_FROM=Nuansa Solution <noreply@nuansasolution.com>

// ============================================
// package.json additions
// ============================================

// Add to package.json dependencies:
// {
//   "dependencies": {
//     ...existing dependencies...,
//     "node-cron": "^3.0.3",
//     "nodemailer": "^6.9.7"
//   }
// }
// backend/src/services/feature.service.js
const db = require('../config/db');

class FeatureService {
  /**
   * Check if user has access to a specific feature
   * @param {number} userId 
   * @param {string} featureCode 
   * @returns {Promise<{hasAccess: boolean, remainingUsage: number, message: string}>}
   */
  async checkFeatureAccess(userId, featureCode) {
    try {
      // Call stored procedure
      const [results] = await db.query(
        'CALL sp_check_feature_access(?, ?, @has_access, @remaining_usage)',
        [userId, featureCode]
      );

      const [[accessResult]] = await db.query(
        'SELECT @has_access AS has_access, @remaining_usage AS remaining_usage'
      );

      const hasAccess = Boolean(accessResult.has_access);
      const remainingUsage = accessResult.remaining_usage;

      return {
        hasAccess,
        remainingUsage: remainingUsage === -1 ? 'unlimited' : remainingUsage,
        message: hasAccess 
          ? 'Access granted' 
          : 'No active subscription or usage limit reached'
      };

    } catch (error) {
      console.error('Feature access check error:', error);
      throw new Error('Failed to check feature access');
    }
  }

  /**
   * Record feature usage
   * @param {number} userId 
   * @param {string} featureCode 
   * @param {string} action 
   * @param {object} metadata 
   * @param {string} ipAddress 
   */
  async recordFeatureUsage(userId, featureCode, action, metadata = {}, ipAddress = null) {
    try {
      await db.query(
        'CALL sp_record_feature_usage(?, ?, ?, ?, ?)',
        [userId, featureCode, action, JSON.stringify(metadata), ipAddress]
      );

      return { success: true, message: 'Usage recorded' };

    } catch (error) {
      console.error('Record feature usage error:', error);
      throw new Error('Failed to record feature usage');
    }
  }

  /**
   * Get user's active subscription with features
   * @param {number} userId 
   */
  async getUserSubscription(userId) {
    try {
      const [subscriptions] = await db.query(`
        SELECT 
          s.id AS subscription_id,
          s.package_id,
          p.package_code,
          p.package_name,
          p.price,
          s.started_at,
          s.expired_at,
          DATEDIFF(s.expired_at, NOW()) AS days_remaining,
          s.status
        FROM subscriptions s
        JOIN packages p ON s.package_id = p.id
        WHERE s.user_id = ? 
          AND s.status = 'active' 
          AND s.expired_at > NOW()
        LIMIT 1
      `, [userId]);

      if (subscriptions.length === 0) {
        return null;
      }

      const subscription = subscriptions[0];

      // Get features for this subscription
      const [features] = await db.query(`
        SELECT 
          f.feature_code,
          f.feature_name,
          f.description,
          pf.usage_limit,
          COALESCE(ufu.usage_count, 0) AS usage_count,
          ufu.last_used_at,
          CASE 
            WHEN pf.usage_limit IS NULL THEN 'unlimited'
            WHEN COALESCE(ufu.usage_count, 0) >= pf.usage_limit THEN 'exhausted'
            ELSE 'available'
          END AS status
        FROM package_features pf
        JOIN features f ON pf.feature_id = f.id
        LEFT JOIN user_feature_usage ufu ON 
          ufu.subscription_id = ? AND ufu.feature_id = f.id
        WHERE pf.package_id = ?
        ORDER BY f.feature_name
      `, [subscription.subscription_id, subscription.package_id]);

      return {
        ...subscription,
        features
      };

    } catch (error) {
      console.error('Get user subscription error:', error);
      throw new Error('Failed to get user subscription');
    }
  }

  /**
   * Get user feature usage history
   * @param {number} userId 
   * @param {number} limit 
   */
  async getUserFeatureHistory(userId, limit = 50) {
    try {
      const [history] = await db.query(`
        SELECT 
          fl.id,
          f.feature_code,
          f.feature_name,
          fl.action,
          fl.metadata,
          fl.created_at
        FROM feature_logs fl
        JOIN features f ON fl.feature_id = f.id
        WHERE fl.user_id = ?
        ORDER BY fl.created_at DESC
        LIMIT ?
      `, [userId, limit]);

      return history;

    } catch (error) {
      console.error('Get feature history error:', error);
      throw new Error('Failed to get feature history');
    }
  }

  /**
   * Get all available features with their packages
   */
  async getAllFeatures() {
    try {
      const [features] = await db.query(`
        SELECT 
          f.id,
          f.feature_code,
          f.feature_name,
          f.description,
          f.is_active
        FROM features f
        WHERE f.is_active = TRUE
        ORDER BY f.feature_name
      `);

      // Get packages for each feature
      for (let feature of features) {
        const [packages] = await db.query(`
          SELECT 
            p.package_code,
            p.package_name,
            pf.usage_limit
          FROM package_features pf
          JOIN packages p ON pf.package_id = p.id
          WHERE pf.feature_id = ? AND p.is_active = TRUE
        `, [feature.id]);

        feature.available_in_packages = packages;
      }

      return features;

    } catch (error) {
      console.error('Get all features error:', error);
      throw new Error('Failed to get features');
    }
  }

  /**
   * Create subscription after successful payment
   * @param {number} userId 
   * @param {string} orderId 
   */
  async createSubscription(userId, orderId) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get order details
      const [orders] = await connection.query(`
        SELECT o.*, p.id AS package_id, p.duration_months
        FROM orders o
        JOIN packages p ON o.package_name = p.package_name
        WHERE o.order_id = ? AND o.user_id = ?
      `, [orderId, userId]);

      if (orders.length === 0) {
        throw new Error('Order not found');
      }

      const order = orders[0];

      // Calculate subscription dates
      const startedAt = new Date();
      const expiredAt = new Date();
      expiredAt.setMonth(expiredAt.getMonth() + order.duration_months);

      // Expire old active subscriptions
      await connection.query(`
        UPDATE subscriptions
        SET status = 'cancelled'
        WHERE user_id = ? AND status = 'active'
      `, [userId]);

      // Create new subscription
      const [result] = await connection.query(`
        INSERT INTO subscriptions (user_id, package_id, order_id, status, started_at, expired_at)
        VALUES (?, ?, ?, 'active', ?, ?)
      `, [userId, order.package_id, orderId, startedAt, expiredAt]);

      await connection.commit();

      return {
        subscription_id: result.insertId,
        package_name: order.package_name,
        started_at: startedAt,
        expired_at: expiredAt
      };

    } catch (error) {
      await connection.rollback();
      console.error('Create subscription error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Cancel user subscription
   * @param {number} userId 
   * @param {number} subscriptionId 
   */
  async cancelSubscription(userId, subscriptionId) {
    try {
      const [result] = await db.query(`
        UPDATE subscriptions
        SET status = 'cancelled'
        WHERE id = ? AND user_id = ?
      `, [subscriptionId, userId]);

      if (result.affectedRows === 0) {
        throw new Error('Subscription not found');
      }

      return { success: true, message: 'Subscription cancelled' };

    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  }

  /**
   * Get expiring subscriptions (for reminder notifications)
   * @param {number} daysThreshold 
   */
  async getExpiringSubscriptions(daysThreshold = 7) {
    try {
      const [subscriptions] = await db.query(`
        SELECT 
          s.id,
          s.user_id,
          u.email,
          u.phone,
          p.package_name,
          s.expired_at,
          DATEDIFF(s.expired_at, NOW()) AS days_remaining
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        JOIN packages p ON s.package_id = p.id
        WHERE s.status = 'active'
          AND s.expired_at > NOW()
          AND DATEDIFF(s.expired_at, NOW()) <= ?
        ORDER BY s.expired_at ASC
      `, [daysThreshold]);

      return subscriptions;

    } catch (error) {
      console.error('Get expiring subscriptions error:', error);
      throw error;
    }
  }
}

module.exports = new FeatureService();
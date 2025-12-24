// backend/src/middlewares/feature.middleware.js
const featureService = require('../services/feature.service');

/**
 * Middleware to check if user has access to a specific feature
 * Usage: router.post('/generate-surat', requireFeature('SURAT_PERJANJIAN'), controller)
 */
const requireFeature = (featureCode, autoRecord = true) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized - Please login first'
        });
      }

      // Check feature access
      const accessCheck = await featureService.checkFeatureAccess(userId, featureCode);

      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - No active subscription or usage limit reached',
          feature_code: featureCode,
          remaining_usage: accessCheck.remainingUsage
        });
      }

      // Attach feature info to request
      req.feature = {
        code: featureCode,
        remaining_usage: accessCheck.remainingUsage,
        auto_record: autoRecord
      };

      next();

    } catch (error) {
      console.error('Feature middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check feature access'
      });
    }
  };
};

/**
 * Middleware to record feature usage after successful operation
 * Usage: Place this after your controller logic
 */
const recordFeatureUsage = async (req, res, next) => {
  // Store original send function
  const originalSend = res.send;

  // Override send function
  res.send = async function (data) {
    // Only record if response is successful and feature info exists
    if (res.statusCode < 400 && req.feature && req.feature.auto_record) {
      try {
        const metadata = {
          endpoint: req.originalUrl,
          method: req.method,
          response_status: res.statusCode,
          // Add any custom metadata from request
          ...(req.featureMetadata || {})
        };

        const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;

        await featureService.recordFeatureUsage(
          req.user.user_id,
          req.feature.code,
          req.featureAction || 'feature_used',
          metadata,
          ipAddress
        );

        console.log(`✅ Feature usage recorded: ${req.feature.code} by user ${req.user.user_id}`);

      } catch (error) {
        console.error('Failed to record feature usage:', error);
        // Don't block the response if recording fails
      }
    }

    // Call original send
    originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware to check if user has active subscription
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Please login first'
      });
    }

    const subscription = await featureService.getUserSubscription(userId);

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: 'No active subscription - Please purchase a package first',
        redirect_to: '/pricing'
      });
    }

    // Check if subscription is expiring soon
    if (subscription.days_remaining <= 7) {
      // Add warning header
      res.set('X-Subscription-Warning', `Your subscription will expire in ${subscription.days_remaining} days`);
    }

    // Attach subscription info to request
    req.subscription = subscription;

    next();

  } catch (error) {
    console.error('Subscription middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription status'
    });
  }
};

/**
 * Helper function to set feature metadata (call in controller before response)
 */
const setFeatureMetadata = (req, action, metadata = {}) => {
  req.featureAction = action;
  req.featureMetadata = metadata;
};

module.exports = {
  requireFeature,
  recordFeatureUsage,
  requireActiveSubscription,
  setFeatureMetadata
};
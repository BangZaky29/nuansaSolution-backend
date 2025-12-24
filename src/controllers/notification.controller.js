const notificationService = require('../services/notification.service');

class NotificationController {
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
      res.status(500).json({ success: false, message: 'Failed to get notifications' });
    }
  }

  async markAsRead(req, res) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;
      await notificationService.markAsRead(id, userId);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
  }

  async markAllAsRead(req, res) {
    try {
      const userId = req.user.user_id;
      await notificationService.markAllAsRead(userId);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
    }
  }
}

module.exports = new NotificationController();

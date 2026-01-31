const db = require('../services/db');
const logger = require('../utils/logger');

// 🔹 Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await db.query(
      `SELECT * FROM automation.notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Fetch error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// 🔹 Create a notification
exports.createNotification = async (req, res) => {
  try {
    const { user_id, type, title, message, data } = req.body;

    const result = await db.query(
      `INSERT INTO automation.notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, type, title, message, JSON.stringify(data)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Create error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

// 🔹 Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE automation.notifications 
       SET read = true 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Marked as read', data: result.rows[0] });
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Mark read error: ${err.message}`);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// 🔹 Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `DELETE FROM automation.notifications WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Delete error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// 🔹 Mark all notifications as read for a user
exports.markAllAsRead = async (req, res) => {
  try {
    const { user_id } = req.params;

    await db.query(
      `UPDATE automation.notifications 
       SET read = true 
       WHERE user_id = $1 AND read = false`,
      [user_id]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Bulk mark read error: ${err.message}`);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

// 🔹 Get all notifications (admin view)
exports.getAllNotifications = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM automation.notifications ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    logger.error(`[NOTIFICATIONS][ADMIN] Fetch error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch all notifications' });
  }
};

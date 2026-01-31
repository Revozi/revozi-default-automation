const { supabase } = require('../services/supabaseClient');
const logger = require('../utils/logger');

// 🔹 Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Fetch error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// 🔹 Create a notification
exports.createNotification = async (req, res) => {
  try {
    const { user_id, type, title, message, data } = req.body;

    const { error, data: insertData } = await supabase
      .from('notifications')
      .insert([{ user_id, type, title, message, data }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(insertData);
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Create error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

// 🔹 Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Marked as read', data });
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Mark read error: ${err.message}`);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// 🔹 Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

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

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user_id)
      .eq('read', false);

    if (error) throw error;

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    logger.error(`[NOTIFICATIONS] Bulk mark read error: ${err.message}`);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};
// 🔹 Get all notifications (admin view)
exports.getAllNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    logger.error(`[NOTIFICATIONS][ADMIN] Fetch error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch all notifications' });
  }
};

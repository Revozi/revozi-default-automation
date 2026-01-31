const { supabase } = require('../services/supabaseClient');
const { notifyTrap } = require('../services/notificationService');
const logger = require('../utils/logger');

const MAX_REMINDERS = parseInt(process.env.MAX_REMINDERS || '3');
const ENABLE_SMS = process.env.ENABLE_SMS === 'true';
const ENABLE_EMAIL = process.env.ENABLE_EMAIL === 'true';
const ENABLE_WHATSAPP = process.env.ENABLE_WHATSAPP === 'true';

// Run this every hour
async function runReminderCron() {
  logger.info('[REMINDER] Running reminder scheduler...');

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .lte('reminders_sent', MAX_REMINDERS)
    .is('active', false);

  if (error) {
    logger.error(`[REMINDER] Failed to fetch users: ${error.message}`);
    return;
  }

  const now = new Date();
  for (const user of users) {
    const lastReminder = new Date(user.last_reminder || user.created_at);
    const hoursSince = (now - lastReminder) / (1000 * 60 * 60);

    if (hoursSince >= 24 && user.reminders_sent < MAX_REMINDERS) {
      const msg = `Hi ${user.email}, we noticed you haven't completed your process. Need help?`;

      await notifyTrap({
        platform: 'reminder',
        user: user.email,
        message: msg,
      });

      await supabase
        .from('users')
        .update({
          reminders_sent: (user.reminders_sent || 0) + 1,
          last_reminder: new Date(),
        })
        .eq('id', user.id);

      logger.info(`[REMINDER] Reminder sent to ${user.email}`);
    }

    // Auto-delete after 72 hours of no engagement
    const hoursSinceCreation = (now - new Date(user.created_at)) / (1000 * 60 * 60);
    if (hoursSinceCreation >= 72 && user.reminders_sent >= MAX_REMINDERS) {
      await supabase.from('users').delete().eq('id', user.id);
      logger.info(`[REMINDER] Deleted unengaged user: ${user.email}`);
    }
  }
}

module.exports = runReminderCron;

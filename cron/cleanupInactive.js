const cron = require('node-cron');
const { supabase } = require('../services/supabaseClient');
const runReminderCron = require('./reminderScheduler');

// 🧹 Schedules both reminder + cleanup crons
function cleanupInactive() {
  //  Hourly reminders for unengaged users
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running reminder scheduler...');
    await runReminderCron();
  });

  //  Daily cleanup at 2 AM for long-inactive users
  cron.schedule('0 2 * * *', async () => {
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    const { data, error } = await supabase
      .from('users')
      .delete()
      .lt('last_active', cutoff);

    if (error) {
      console.error(`[CRON] Cleanup failed: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      console.log(`[CRON] Deleted ${data.length} inactive users`);
    } else {
      console.log('[CRON] No inactive users to delete today');
    }
  });

  console.log('[CRON]  Reminder + Inactive cleanup cron scheduled');
}

module.exports = cleanupInactive;

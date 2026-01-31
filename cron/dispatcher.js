const cron = require('node-cron');
const { supabase } = require('../services/supabaseClient');
const logger = require('../utils/logger');
const botMap = require('../bots/botMap');

const MAX_RETRIES = 3;

function dispatcherCron() {
  cron.schedule('*/10 * * * *', async () => {
    logger.info('[DISPATCHER] Checking post queue...');
    const now = new Date().toISOString();

    const { data: posts } = await supabase
      .from('post_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('priority', { ascending: false });

    for (const post of posts) {
      const runBot = botMap[post.platform];
      if (!runBot) {
        logger.error(`[DISPATCHER] No bot for ${post.platform}`);
        continue;
      }

      try {
        await runBot({ mediaUrl: post.media_url, caption: post.caption });

        await supabase.from('post_queue')
          .update({
            status: 'posted',
            last_attempt_at: new Date()
          })
          .eq('id', post.id);

        logger.info(`[DISPATCHER] Posted to ${post.platform}`);
      } catch (err) {
        const retryCount = post.retries + 1;
        const failed = retryCount >= MAX_RETRIES;

        await supabase.from('post_queue')
          .update({
            status: failed ? 'failed' : 'pending',
            retries: retryCount,
            last_attempt_at: new Date()
          })
          .eq('id', post.id);

        logger.error(`[DISPATCHER] Failed to post on ${post.platform}. Retry ${retryCount}`);
      }
    }
  });
}

module.exports = dispatcherCron;

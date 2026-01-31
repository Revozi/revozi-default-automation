const cron = require('node-cron');
const db = require('../services/db');
const logger = require('../utils/logger');
const botMap = require('../bots/botMap');

const MAX_RETRIES = 3;

function dispatcherCron() {
  cron.schedule('*/10 * * * *', async () => {
    logger.info('[DISPATCHER] Checking post queue...');
    const now = new Date().toISOString();

    try {
      const result = await db.query(
        `SELECT * FROM automation.post_queue 
         WHERE status = 'pending' 
         AND scheduled_at <= $1 
         ORDER BY priority DESC`,
        [now]
      );
      const posts = result.rows;

      for (const post of posts) {
        const runBot = botMap[post.platform];
        if (!runBot) {
          logger.error(`[DISPATCHER] No bot for ${post.platform}`);
          continue;
        }

        try {
          await runBot({ mediaUrl: post.media_url, caption: post.caption });

          await db.query(
            `UPDATE automation.post_queue 
             SET status = 'posted', last_attempt_at = NOW() 
             WHERE id = $1`,
            [post.id]
          );

          logger.info(`[DISPATCHER] Posted to ${post.platform}`);
        } catch (err) {
          const retryCount = post.retries + 1;
          const failed = retryCount >= MAX_RETRIES;

          await db.query(
            `UPDATE automation.post_queue 
             SET status = $1, retries = $2, last_attempt_at = NOW() 
             WHERE id = $3`,
            [failed ? 'failed' : 'pending', retryCount, post.id]
          );

          logger.error(`[DISPATCHER] Failed to post on ${post.platform}. Retry ${retryCount}`);
        }
      }
    } catch (error) {
      logger.error(`[DISPATCHER] Error: ${error.message}`);
    }
  });
}

module.exports = dispatcherCron;

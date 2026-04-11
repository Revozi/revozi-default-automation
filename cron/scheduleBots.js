const cron = require('node-cron');
const logger = require('../utils/logger');

const runInstagramBot = require('../bots/instagramBot');
const runTwitterBot = require('../bots/twitterBot');
const runTikTokBot = require('../bots/tiktokBot');
const runTelegramBot = require('../bots/telegramBot');
const runFacebookBot = require('../bots/facebookBot');
const runRedditBot = require('../bots/redditBot');
const runGmbBot = require('../bots/gmbBot');
const runPinterestBot = require('../bots/pinterestBot');

async function safeRun(name, fn) {
  try {
    await fn();
  } catch (err) {
    logger.error(`[CRON] ${name} failed: ${err.message}`);
  }
}

function startCronJobs() {
  logger.info('[CRON] All bots will start on schedule');

  cron.schedule('*/15 * * * *', async () => {
    logger.info('[CRON] InstagramBot Triggered');
    await safeRun('InstagramBot', () => runInstagramBot());
  });

  cron.schedule('5,35 * * * *', async () => {
    logger.info('[CRON] TwitterBot Triggered');
    await safeRun('TwitterBot', () => runTwitterBot());
  });

  cron.schedule('10,40 * * * *', async () => {
    logger.info('[CRON] TikTokBot Triggered');
    await safeRun('TikTokBot', () => runTikTokBot());
  });

  cron.schedule('20 * * * *', async () => {
    logger.info('[CRON] TelegramBot Triggered');
    await safeRun('TelegramBot', () => runTelegramBot());
  });

  cron.schedule('25,55 * * * *', async () => {
    logger.info('[CRON] FacebookBot Triggered');
    await safeRun('FacebookBot', () => runFacebookBot());
  });

  cron.schedule('30 * * * *', async () => {
    logger.info('[CRON] RedditBot Triggered');
    await safeRun('RedditBot', () => runRedditBot());
  });

  cron.schedule('45 * * * *', async () => {
    logger.info('[CRON] GmbBot Triggered');
    await safeRun('GmbBot', () => runGmbBot());
  });

  cron.schedule('50 * * * *', async () => {
    logger.info('[CRON] PinterestBot Triggered');
    await safeRun('PinterestBot', () => runPinterestBot());
  });
}

module.exports = startCronJobs;

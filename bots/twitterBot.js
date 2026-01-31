const axios = require('axios');
const logger = require('../utils/logger');
const db = require('../services/db');

const { loadProviderCredentials } = require('../utils/credentials');

// Load twitter credentials; support multiple via TWITTER_CREDENTIALS or numbered envs
const twitterCreds = loadProviderCredentials('TWITTER', ['user_id', 'bearer_token']);

async function logToSupabase(activity) {
  await db.query(
      `INSERT INTO automation.engagements (platform, action, error, account, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [activity.platform || 'unknown', activity.action, activity.error, activity.account]
    );
}

async function getProfile() {
  const resp = await axios.get(
    `https://api.twitter.com/2/users/${userId}`,
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  );
  logger.info(`[TwitterBot] Profile: ${JSON.stringify(resp.data)}`);
  await logToSupabase({ action: 'getProfile', data: resp.data });
  return resp.data;
}

async function postContent(text) {
  const resp = await axios.post(
    'https://api.twitter.com/2/tweets',
    { text },
    { headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' } }
  );
  logger.info(`[TwitterBot] Tweeted: ${text}`);
  await logToSupabase({ action: 'postContent', text, resp: resp.data });
  return resp.data;
}

async function likeContent(tweetId) {
  if (!userId) return;
  await axios.post(
    `https://api.twitter.com/2/users/${userId}/likes`,
    { tweet_id: tweetId },
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  );
  logger.info(`[TwitterBot] Liked tweet: ${tweetId}`);
  await logToSupabase({ action: 'likeContent', tweetId });
}

async function commentOnContent(tweetId, text) {
  const resp = await axios.post(
    'https://api.twitter.com/2/tweets',
    { text, reply: { in_reply_to_tweet_id: tweetId } },
    { headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' } }
  );
  logger.info(`[TwitterBot] Replied to ${tweetId}: ${text}`);
  await logToSupabase({ action: 'commentOnContent', tweetId, text, resp: resp.data });
}

async function autoReplyToComments(tweetId, replyText) {
  // Not implemented: would require streaming or polling mentions.
  logger.info('[TwitterBot] autoReplyToComments: Not implemented');
}

async function runTwitterBot() {
  logger.info('[TwitterBot] Starting (Axios-based)');
  if (!twitterCreds.length) {
    logger.error('[TwitterBot] No Twitter credentials configured (see TWITTER_CREDENTIALS or TWITTER_USER_ID/_1)');
    return;
  }

  try {
    const { runWithRateLimit } = require('../utils/rateLimiter');
    await runWithRateLimit(twitterCreds, async (cred) => {
      const bearer = cred.bearer_token || cred.bearerToken;
      const uid = cred.user_id || cred.userId;
      if (!bearer || !uid) {
        logger.warn('[TwitterBot] Skipping incomplete credential', { cred });
        return;
      }

      const profileResp = await axios.get(
        `https://api.twitter.com/2/users/${uid}`,
        { headers: { Authorization: `Bearer ${bearer}` } }
      );
      logger.info(`[TwitterBot] Profile for ${uid}: ${JSON.stringify(profileResp.data)}`);
      await logToSupabase({ action: 'getProfile', data: profileResp.data, account: uid });

      // Post a tweet
      const tweetResp = await axios.post(
        'https://api.twitter.com/2/tweets',
        { text: 'Hello world from Axios bot!' },
        { headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' } }
      );

      const tweet = tweetResp.data;
      logger.info(`[TwitterBot] Tweeted for ${uid}`);
      await logToSupabase({ action: 'postContent', account: uid, text: 'Hello world from Axios bot!', resp: tweet });

      // Like and reply if possible
      const tweetId = tweet?.data?.id || tweet?.id;
      if (tweetId) {
        await axios.post(
          `https://api.twitter.com/2/users/${uid}/likes`,
          { tweet_id: tweetId },
          { headers: { Authorization: `Bearer ${bearer}` } }
        );
        await axios.post(
          'https://api.twitter.com/2/tweets',
          { text: 'Nice tweet!', reply: { in_reply_to_tweet_id: tweetId } },
          { headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' } }
        );
        logger.info(`[TwitterBot] Liked and replied to ${tweetId} for ${uid}`);
        await logToSupabase({ action: 'likeAndReply', account: uid, tweetId });
      }
    }, { concurrency: 1, delayMs: 500 });

    logger.info('[TwitterBot] Automation complete');
    await logToSupabase({ action: 'runTwitterBot', status: 'complete' });
  } catch (error) {
    logger.error(`[TwitterBot] Error: ${error.response?.data?.detail || error.message}`);
    await logToSupabase({ action: 'runTwitterBot', error: error.message });
  }
}

module.exports = runTwitterBot;
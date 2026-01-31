const axios = require('axios');
const logger = require('../utils/logger');
const db = require('../services/db');

const { loadProviderCredentials } = require('../utils/credentials');

// Load configured Facebook credentials (supports multiple)
const fbCredentials = loadProviderCredentials('FACEBOOK', ['pageId', 'accessToken']);

async function logToSupabase(activity) {
  try {
    await db.query(
      `INSERT INTO automation.engagements (platform, action, error, account, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [activity.platform || 'unknown', activity.action, activity.error, activity.account]
    );
  } catch (err) {
    logger.error(`[FacebookBot] Supabase log error: ${err.message}`);
  }
}

async function getProfile(accessToken) {
  const resp = await axios.get(
    `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`
  );
  logger.info(`[FacebookBot] Profile: ${JSON.stringify(resp.data)}`);
  await logToSupabase({ action: 'getProfile', data: resp.data });
  return resp.data;
}

async function postContentForPage(pageId, accessToken, message) {
  const resp = await axios.post(
    `https://graph.facebook.com/${pageId}/feed`,
    { message, access_token: accessToken }
  );
  logger.info(`[FacebookBot] Post published to ${pageId}`);
  await logToSupabase({ action: 'postContent', pageId, message, resp: resp.data });
  return resp.data;
}

async function commentOnContent(postId, message) {
  const resp = await axios.post(
    `https://graph.facebook.com/${postId}/comments`,
    { message, access_token: fbAccessToken }
  );
  logger.info(`[FacebookBot] Commented on ${postId}`);
  await logToSupabase({ action: 'commentOnContent', postId, message, resp: resp.data });
}

async function autoReplyToComments(postId, replyMessage) {
  logger.info('[FacebookBot] autoReplyToComments: Not implemented');
  await logToSupabase({ action: 'autoReplyToComments', status: 'not-implemented', postId });
}

async function runFacebookBot() {
  logger.info('[FacebookBot] Starting (Axios-based)');

  if (!fbCredentials.length) {
    const msg = '[FacebookBot] No Facebook credentials configured (see FACEBOOK_CREDENTIALS or FACEBOOK_PAGE_ID/_1 vars)';
    logger.error(msg);
    await logToSupabase({ action: 'runFacebookBot', error: msg });
    return;
  }

  try {
    // Post to all configured pages
    const { runWithRateLimit } = require('../utils/rateLimiter');
    await runWithRateLimit(fbCredentials, async (cred) => {
      const { pageId, accessToken } = cred;
      if (!pageId || !accessToken) {
        logger.warn('[FacebookBot] Skipping incomplete credential entry', { cred });
        return;
      }

      await getProfile(accessToken);
      const post = await postContentForPage(pageId, accessToken, 'Hello from Axios Facebook bot!');
      const postId = post?.id;

      if (postId) {
        await commentOnContent(postId, 'Nice post!');
        await autoReplyToComments(postId, 'Thanks for your comment!');
      }
    }, { concurrency: 1, delayMs: 800 });

    logger.info('[FacebookBot] Task complete');
    await logToSupabase({ action: 'runFacebookBot', status: 'complete' });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    logger.error(`[FacebookBot] Error: ${msg}`);
    await logToSupabase({ action: 'runFacebookBot', error: msg });
  }
}

module.exports = runFacebookBot;

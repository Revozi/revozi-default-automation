const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { loadProviderCredentials } = require('../utils/credentials');
const { autoGenerateContent } = require('../utils/autoContent');

const fbCredentials = loadProviderCredentials('FACEBOOK', ['pageId', 'accessToken']);

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'facebook',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[FacebookBot] Supabase log error: ${err.message}`);
  }
}

async function fetchNextQueuedPost() {
  const now = new Date().toISOString();
  const { data: posts } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('platform', 'facebook')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(1);
  return Array.isArray(posts) && posts.length > 0 ? posts[0] : null;
}

async function postContentForPage(pageId, accessToken, message) {
  const resp = await axios.post(
    `https://graph.facebook.com/${pageId}/feed`,
    { message, access_token: accessToken }
  );
  logger.info(`[FacebookBot] Post published to page ${pageId}`);
  await logToSupabase({ action: 'postContent', pageId, message, resp: resp.data });
  return resp.data;
}

async function runFacebookBot(payload = {}) {
  logger.info('[FacebookBot] Starting (Axios-based)');

  if (!fbCredentials.length) {
    logger.error('[FacebookBot] No Facebook credentials configured (see FACEBOOK_CREDENTIALS or FACEBOOK_PAGE_ID/_1 vars)');
    return;
  }

  let textToPost = String(payload.caption || payload.text || '').trim();
  let queuedPost = null;

  if (!textToPost) {
    queuedPost = await fetchNextQueuedPost();
    if (queuedPost) {
      textToPost = String(queuedPost.caption || queuedPost.text || '').trim();
    }
    if (!textToPost) {
      logger.info('[FacebookBot] Queue empty — auto-generating Revozi content...');
      const generated = await autoGenerateContent('facebook');
      textToPost = generated.caption;
    }
  }

  try {
    const { runWithRateLimit } = require('../utils/rateLimiter');
    await runWithRateLimit(fbCredentials, async (cred) => {
      const { pageId, accessToken } = cred;
      if (!pageId || !accessToken) {
        logger.warn('[FacebookBot] Skipping incomplete credential entry', { cred });
        return;
      }
      await postContentForPage(pageId, accessToken, textToPost);
    }, { concurrency: 1, delayMs: 800 });

    if (queuedPost) {
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date() })
        .eq('id', queuedPost.id);
    }

    logger.info('[FacebookBot] Task complete');
    await logToSupabase({ action: 'runFacebookBot', status: 'complete' });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    logger.error(`[FacebookBot] Error: ${msg}`);
    await logToSupabase({ action: 'runFacebookBot', error: msg });
  }
}

module.exports = runFacebookBot;

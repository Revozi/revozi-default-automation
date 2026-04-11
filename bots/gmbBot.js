const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { loadProviderCredentials } = require('../utils/credentials');
const { autoGenerateContent } = require('../utils/autoContent');

const gmbCreds = loadProviderCredentials('GMB', ['locationId', 'accessToken']);

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'google-my-business',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[GmbBot] Supabase log error: ${err.message}`);
  }
}

async function fetchNextQueuedPost() {
  const now = new Date().toISOString();
  const { data: posts } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('platform', 'gmb')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(1);
  return Array.isArray(posts) && posts.length > 0 ? posts[0] : null;
}

async function postContentForAccount(locationId, token, summary) {
  const resp = await axios.post(
    `https://mybusiness.googleapis.com/v4/accounts/${locationId}/localPosts`,
    { languageCode: 'en', summary },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  logger.info(`[GmbBot] Post created for ${locationId}`);
  await logToSupabase({ action: 'postContent', summary, account: locationId, response: resp.data });
  return resp.data;
}

async function runGmbBot(payload = {}) {
  logger.info('[GmbBot] Starting (Axios-based)');

  if (!gmbCreds.length) {
    logger.error('[GmbBot] No GMB credentials configured (see GMB_CREDENTIALS or GMB_LOCATION_ID/_1)');
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
      logger.info('[GmbBot] Queue empty — auto-generating Revozi content...');
      const generated = await autoGenerateContent('gmb');
      textToPost = generated.caption;
    }
  }

  try {
    const { runWithRateLimit } = require('../utils/rateLimiter');
    await runWithRateLimit(gmbCreds, async (cred) => {
      const token = cred.accessToken || cred.access_token;
      const locationId = cred.locationId || cred.location_id;
      if (!token || !locationId) {
        logger.warn('[GmbBot] Skipping incomplete credential', { cred });
        return;
      }
      await postContentForAccount(locationId, token, textToPost);
    }, { concurrency: 1, delayMs: 800 });

    if (queuedPost) {
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date() })
        .eq('id', queuedPost.id);
    }

    logger.info('[GmbBot] Task complete');
    await logToSupabase({ action: 'runGmbBot', status: 'complete' });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    logger.error(`[GmbBot] Error: ${msg}`);
    await logToSupabase({ action: 'runGmbBot', error: msg });
  }
}

module.exports = runGmbBot;

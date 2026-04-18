const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { autoGenerateContent } = require('../utils/autoContent');

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'twitter',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch(e) {}
}

async function postTweet(text, cred) {
  const oauth = OAuth({
    consumer: { key: cred.api_key, secret: cred.api_secret },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    }
  });
  const url = 'https://api.twitter.com/2/tweets';
  const token = { key: cred.access_token, secret: cred.access_token_secret };
  const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'POST' }, token));
  const resp = await axios.post(url, { text }, {
    headers: { ...authHeader, 'Content-Type': 'application/json' }
  });
  return resp.data;
}

async function runTwitterBot(payload = {}) {
  logger.info('[TwitterBot] Starting (Axios-based)');

  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  logger.info(`[TwitterBot] Credentials check - apiKey:${!!apiKey} apiSecret:${!!apiSecret} accessToken:${!!accessToken} accessTokenSecret:${!!accessTokenSecret}`);

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    logger.error('[TwitterBot] Missing OAuth credentials');
    return;
  }

  const cred = { api_key: apiKey, api_secret: apiSecret, access_token: accessToken, access_token_secret: accessTokenSecret };

  try {
    const { data: posts, error } = await supabase
      .from('post_queue')
      .select('*')
      .eq('platform', 'twitter')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .limit(5);

    if (error) { logger.error(`[TwitterBot] Supabase error: ${error.message}`); return; }
    if (!posts || posts.length === 0) {
      logger.info('[TwitterBot] Queue empty — auto-generating Revozi content...');
      const generated = await autoGenerateContent('twitter');
      const result = await postTweet(generated.caption, cred);
      logger.info(`[TwitterBot] Auto-generated tweet posted successfully`);
      await logToSupabase({ action: 'postContent', text: generated.caption, resp: result });
      return;
    }

    logger.info(`[TwitterBot] Found ${posts.length} pending post(s)`);

    for (const post of posts) {
      try {
        logger.info(`[TwitterBot] Attempting to tweet: ${post.caption}`);
        const result = await postTweet(post.caption, cred);
        logger.info(`[TwitterBot] SUCCESS - Tweeted: ${post.caption}`);
        await supabase.from('post_queue').update({ status: 'posted', last_attempt_at: new Date().toISOString() }).eq('id', post.id);
        await logToSupabase({ action: 'postContent', text: post.caption, resp: result });
      } catch (err) {
        const errDetail = JSON.stringify(err.response?.data || err.message);
        logger.error(`[TwitterBot] FAILED to post: ${errDetail}`);
        await supabase.from('post_queue').update({ status: 'failed', last_attempt_at: new Date().toISOString(), retries: (post.retries || 0) + 1 }).eq('id', post.id);
      }
    }

    logger.info('[TwitterBot] Automation complete');
  } catch (error) {
    logger.error(`[TwitterBot] Error: ${error.message}`);
  }
}

module.exports = runTwitterBot;

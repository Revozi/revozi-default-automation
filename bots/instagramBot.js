const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { autoGenerateContent } = require('../utils/autoContent');

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'instagram',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[InstagramBot] Supabase log error: ${err.message}`);
  }
}

async function fetchNextQueuedPost() {
  const now = new Date().toISOString();
  const { data: posts } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('platform', 'instagram')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(1);
  return Array.isArray(posts) && posts.length > 0 ? posts[0] : null;
}

async function uploadImageToInstagram(imageUrl, token, igId) {
  const { data } = await axios.post(`https://graph.facebook.com/v18.0/${igId}/media`, {
    image_url: imageUrl,
    is_carousel_item: true,
    access_token: token,
  });
  return data.id;
}

async function createCarouselPost(mediaIds, caption, token, igId) {
  const { data: creation } = await axios.post(`https://graph.facebook.com/v18.0/${igId}/media`, {
    children: mediaIds,
    caption,
    media_type: 'CAROUSEL',
    access_token: token,
  });
  const { data: publish } = await axios.post(`https://graph.facebook.com/v18.0/${igId}/media_publish`, {
    creation_id: creation.id,
    access_token: token,
  });
  return publish;
}

async function getRecentMedia(igId, token) {
  const { data } = await axios.get(`https://graph.facebook.com/v18.0/${igId}/media`, {
    params: { access_token: token, fields: 'id,caption,media_url,permalink' },
  });
  return data.data;
}

async function runInstagramBot() {
  logger.info('[InstagramBot] Starting (Graph API)');

  const { loadProviderCredentials } = require('../utils/credentials');
  const fbCreds = loadProviderCredentials('FACEBOOK', ['pageId', 'accessToken']);
  const igId = process.env.IG_BUSINESS_ID;

  if (!fbCreds.length || !igId) {
    logger.error('[InstagramBot] Missing Facebook credentials or IG_BUSINESS_ID');
    return;
  }

  // Determine content to post
  let queuedPost = await fetchNextQueuedPost();
  if (!queuedPost) {
    logger.info('[InstagramBot] Queue empty — auto-generating Revozi content...');
    const generated = await autoGenerateContent('instagram');
    queuedPost = { caption: generated.caption, media_url: generated.media_url };
  }

  const caption = String(queuedPost.caption || queuedPost.text || '').trim();
  const imageUrl = queuedPost.media_url;

  if (!imageUrl) {
    logger.error('[InstagramBot] No media_url — Instagram requires an image');
    return;
  }

  try {
    const { runWithRateLimit } = require('../utils/rateLimiter');
    await runWithRateLimit(fbCreds, async (cred) => {
      const token = cred.accessToken || cred.access_token;
      if (!token) return;

      const mediaIds = await Promise.all([
        uploadImageToInstagram(imageUrl, token, igId),
      ]);
      const postResp = await createCarouselPost(mediaIds, caption, token, igId);
      logger.info(`[InstagramBot] Post created: ${postResp.id}`);
      await logToSupabase({ action: 'createPost', caption, response: postResp, account: cred.pageId });
    }, { concurrency: 1, delayMs: 800 });

    if (queuedPost.id) {
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date() })
        .eq('id', queuedPost.id);
    }

    logger.info('[InstagramBot] Task complete');
    await logToSupabase({ action: 'runInstagramBot', status: 'complete' });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`[InstagramBot] Error: ${msg}`);
    await logToSupabase({ action: 'runInstagramBot', error: msg });
  }
}

module.exports = runInstagramBot;

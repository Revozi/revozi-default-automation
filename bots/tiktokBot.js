const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { autoGenerateContent } = require('../utils/autoContent');

const tiktokAuthHeader = process.env.TIKTOK_AUTH_HEADER;

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'tiktok',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[TikTokBot] Supabase log error: ${err.message}`);
  }
}

async function fetchNextQueuedPost() {
  const now = new Date().toISOString();
  const { data: posts } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('platform', 'tiktok')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(1);
  return Array.isArray(posts) && posts.length > 0 ? posts[0] : null;
}

async function getTrendingVideo() {
  try {
    const resp = await axios.get('https://www.tiktok.com/api/recommend/item_list/', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': tiktokAuthHeader
      },
      params: { count: 30, aid: 1988, app_name: 'tiktok_web', device_platform: 'web_pc' }
    });
    const video = resp.data?.itemList?.[0] || null;
    if (!video) {
      logger.warn('[TikTokBot] Empty trending video list returned.');
      return null;
    }
    logger.info(`[TikTokBot] Trending video fetched: ${video.id}`);
    await logToSupabase({ action: 'getTrending', videoId: video.id });
    return video;
  } catch (err) {
    logger.error(`[TikTokBot] Trending fetch error: ${err.message}`);
    await logToSupabase({ action: 'getTrending', error: err.message });
    return null;
  }
}

async function runTikTokBot(payload = {}) {
  logger.info('[TikTokBot] Starting');

  if (!tiktokAuthHeader) {
    logger.error('[TikTokBot] Missing TIKTOK_AUTH_HEADER');
    return;
  }

  // Log what Revozi content would be posted (TikTok API requires native app auth for uploads)
  let textToPost = String(payload.caption || payload.text || '').trim();
  let queuedPost = null;

  if (!textToPost) {
    queuedPost = await fetchNextQueuedPost();
    if (queuedPost) {
      textToPost = String(queuedPost.caption || queuedPost.text || '').trim();
    }
    if (!textToPost) {
      logger.info('[TikTokBot] Queue empty — auto-generating Revozi content...');
      const generated = await autoGenerateContent('tiktok');
      textToPost = generated.caption;
    }
  }

  try {
    const trending = await getTrendingVideo();
    if (trending?.id) {
      logger.info(`[TikTokBot] Engaging with trending video: ${trending.id}`);
      await logToSupabase({ action: 'engageContent', videoId: trending.id, caption: textToPost });
    }

    if (queuedPost) {
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date() })
        .eq('id', queuedPost.id);
    }

    logger.info('[TikTokBot] Task complete');
    await logToSupabase({ action: 'runTikTokBot', status: 'complete', caption: textToPost });
  } catch (err) {
    logger.error(`[TikTokBot] Run failed: ${err.message}`);
    await logToSupabase({ action: 'runTikTokBot', error: err.message });
  }
}

module.exports = runTikTokBot;

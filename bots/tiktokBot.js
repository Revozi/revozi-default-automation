const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

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

async function getTrendingVideo() {
  try {
    const resp = await axios.get('https://www.tiktok.com/api/recommend/item_list/', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': tiktokAuthHeader
      },
      params: { count: 1 }
    });
    const video = resp.data?.itemList?.[0] || null;
    logger.info(`[TikTokBot] Trending video: ${JSON.stringify(video)}`);
    await logToSupabase({ action: 'getTrending', video });
    return video;
  } catch (err) {
    logger.error(`[TikTokBot] Trending fetch error: ${err.message}`);
    await logToSupabase({ action: 'getTrending', error: err.message });
    return null;
  }
}



async function likeContent(videoId) {
  logger.info(`[TikTokBot] Like simulation for video: ${videoId}`);
  await logToSupabase({ action: 'likeContent', videoId });
}

async function commentOnContent(videoId, commentText) {
  logger.info(`[TikTokBot] Comment simulation on ${videoId}: ${commentText}`);
  await logToSupabase({ action: 'commentOnContent', videoId, commentText });
}

async function autoReplyToComments() {
  logger.info('[TikTokBot] autoReplyToComments: Not supported');
}

async function runTikTokBot() {
  logger.info('[TikTokBot] Starting');

  if (!tiktokAuthHeader) {
    logger.error('[TikTokBot] Missing TIKTOK_AUTH_HEADER');
    await logToSupabase({ action: 'runTikTokBot', error: 'Missing auth header' });
    return;
  }

  try {
    const trending = await getTrendingVideo();
    if (trending?.id) {
      await likeContent(trending.id);
      await commentOnContent(trending.id, 'Nice TikTok!');
    }

    await autoReplyToComments();
    logger.info('[TikTokBot] Task complete');
    await logToSupabase({ action: 'runTikTokBot', status: 'complete' });
  } catch (err) {
    logger.error(`[TikTokBot] Run failed: ${err.message}`);
    await logToSupabase({ action: 'runTikTokBot', error: err.message });
  }
}

module.exports = runTikTokBot;

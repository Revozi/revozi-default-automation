const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

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

async function runInstagramBot() {
  logger.info('[InstagramBot] Starting (Graph API)');

  const { loadProviderCredentials } = require('../utils/credentials');
  const fbCreds = loadProviderCredentials('FACEBOOK', ['pageId', 'accessToken']);
  const igId = process.env.IG_BUSINESS_ID;

  if (!fbCreds.length || !igId) {
    const msg = '[InstagramBot] Missing Facebook credentials or IG_BUSINESS_ID';
    logger.error(msg);
    await logToSupabase({ action: 'runInstagramBot', error: msg });
    return;
  }

  try {
    const { runWithRateLimit } = require('../utils/rateLimiter');
    await runWithRateLimit(fbCreds, async (cred) => {
      const token = cred.accessToken || cred.access_token;
      if (!token) return;

      // 1. Auto-post multiple images (Carousel)
      const mediaIds = await Promise.all([
        uploadImageToInstagram('https://example.com/image1.jpg', token, igId),
        uploadImageToInstagram('https://example.com/image2.jpg', token, igId),
      ]);
      const postResp = await createCarouselPost(mediaIds, 'Auto-posted from bot', token, igId);
      logger.info(`[InstagramBot] Carousel post created: ${postResp.id}`);
      await logToSupabase({ action: 'createCarouselPost', mediaIds, response: postResp, account: cred.pageId });

      // 2. Auto-comment on recent media
      const recent = await getRecentMedia(igId, token);
      await runWithRateLimit(recent, async (media) => {
        const commentResp = await axios.post(
          `https://graph.facebook.com/v18.0/${media.id}/comments`,
          { message: 'Awesome content!', access_token: token }
        );
        logger.info(`[InstagramBot] Commented on: ${media.id}`);
        await logToSupabase({ action: 'comment', mediaId: media.id, response: commentResp.data, account: cred.pageId });
      }, { concurrency: 1, delayMs: 300 });

      // 3. Auto-like recent posts (first 3)
      await runWithRateLimit(recent.slice(0,3), async (media) => {
        const likeResp = await axios.post(
          `https://graph.facebook.com/v18.0/${media.id}/likes`,
          { access_token: token }
        );
        logger.info(`[InstagramBot] Liked: ${media.id}`);
        await logToSupabase({ action: 'like', mediaId: media.id, response: likeResp.data, account: cred.pageId });
      }, { concurrency: 1, delayMs: 300 });

      // 4. Auto-reply to comments
      await runWithRateLimit(recent, async (media) => {
        const comments = await getComments(media.id, token);
        for (let comment of comments.data) {
          const replyResp = await axios.post(
            `https://graph.facebook.com/v18.0/${comment.id}/replies`,
            { message: 'Thanks for engaging!', access_token: token }
          );
          logger.info(`[InstagramBot] Replied to comment: ${comment.id}`);
          await logToSupabase({ action: 'reply', commentId: comment.id, response: replyResp.data, account: cred.pageId });
        }
      }, { concurrency: 1, delayMs: 300 });

    }, { concurrency: 1, delayMs: 800 });

    logger.info('[InstagramBot] Task complete');
    await logToSupabase({ action: 'runInstagramBot', status: 'complete' });

  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`[InstagramBot] Error: ${msg}`);
    await logToSupabase({ action: 'runInstagramBot', error: msg });
  }
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
    params: {
      access_token: token,
      fields: 'id,caption,media_url,permalink',
    },
  });
  return data.data;
}

async function getComments(mediaId, token) {
  const { data } = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}/comments`, {
    params: { access_token: token },
  });
  return data;
}

module.exports = runInstagramBot;

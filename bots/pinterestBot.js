const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { autoGenerateContent } = require('../utils/autoContent');

const pinterestToken = process.env.PINTEREST_ACCESS_TOKEN;
const pinterestBoardId = process.env.PINTEREST_BOARD_ID;

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'pinterest',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[PinterestBot] Supabase log error: ${err.message}`);
  }
}

async function fetchNextQueuedPost() {
  const now = new Date().toISOString();
  const { data: posts } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('platform', 'pinterest')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(1);

  return Array.isArray(posts) && posts.length > 0 ? posts[0] : null;
}

async function postPin(queuedPost) {
  const description = String(queuedPost.caption || queuedPost.text || 'Revozi — AI-powered business automation. #Revozi #AI #BusinessGrowth').trim();
  const imageUrl = queuedPost.media_url;

  if (!imageUrl) {
    throw new Error('[PinterestBot] No media_url — Pinterest requires an image');
  }

  const payload = {
    board_id: pinterestBoardId,
    title: description.substring(0, 100),
    alt_text: description.substring(0, 500),
    media_source: {
      source_type: 'image_url',
      url: imageUrl
    },
    description
  };

  try {
    const resp = await axios.post(
      'https://api.pinterest.com/v5/pins',
      payload,
      {
        headers: {
          Authorization: `Bearer ${pinterestToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info('[PinterestBot] Pin created successfully');
    await logToSupabase({ action: 'postPin', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[PinterestBot] postPin error: ${msg}`);
    await logToSupabase({ action: 'postPin', error: msg });
    throw error;
  }
}

async function runPinterestBot(payload = {}) {
  logger.info('[PinterestBot] Starting automation task');

  if (!pinterestToken || !pinterestBoardId) {
    logger.error('[PinterestBot] PINTEREST_ACCESS_TOKEN or PINTEREST_BOARD_ID not set');
    return;
  }

  let queuedPost = null;

  if (payload.media_url || payload.caption || payload.text) {
    queuedPost = payload;
  } else {
    queuedPost = await fetchNextQueuedPost();
    if (!queuedPost) {
      logger.info('[PinterestBot] Queue empty — auto-generating Revozi content...');
      const generated = await autoGenerateContent('pinterest');
      queuedPost = { caption: generated.caption, media_url: generated.media_url };
    }
  }

  try {
    await postPin(queuedPost);

    if (queuedPost.id) {
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date() })
        .eq('id', queuedPost.id);
    }

    logger.info('[PinterestBot] Task complete');
    await logToSupabase({ action: 'runPinterestBot', status: 'complete' });
  } catch (error) {
    // Already logged in postPin
  }
}

module.exports = runPinterestBot;

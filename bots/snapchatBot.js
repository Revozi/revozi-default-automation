const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

const snapchatAccessToken = process.env.SNAPCHAT_ACCESS_TOKEN;
const snapchatAdAccountId = process.env.SNAPCHAT_AD_ACCOUNT_ID;

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'snapchat',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[SnapchatBot] Supabase log error: ${err.message}`);
  }
}

async function createSnap() {
  const payload = {
    media_type: 'IMAGE',
    media_url: 'https://example.com/snap-image.jpg',
    caption: 'Automated Snap from bot! 📸',
    duration: 10,
    filters: ['funny', 'trending']
  };

  try {
    const resp = await axios.post(
      'https://adsapi.snapchat.com/v1/ads',
      payload,
      {
        headers: {
          Authorization: `Bearer ${snapchatAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info('[SnapchatBot] Snap created successfully');
    await logToSupabase({ action: 'createSnap', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[SnapchatBot] createSnap error: ${msg}`);
    await logToSupabase({ action: 'createSnap', error: msg });
    throw error;
  }
}

async function postToStory() {
  const payload = {
    media_type: 'IMAGE',
    media_url: 'https://example.com/story-image.jpg',
    caption: 'Check out my automated story! 🎉',
    duration: 24, // 24 hours
    ad_account_id: snapchatAdAccountId
  };

  try {
    const resp = await axios.post(
      'https://adsapi.snapchat.com/v1/ads',
      payload,
      {
        headers: {
          Authorization: `Bearer ${snapchatAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info('[SnapchatBot] Story posted successfully');
    await logToSupabase({ action: 'postToStory', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[SnapchatBot] postToStory error: ${msg}`);
    await logToSupabase({ action: 'postToStory', error: msg });
    throw error;
  }
}

async function sendDirectMessage(recipientId, message) {
  const payload = {
    recipient_id: recipientId,
    message: message,
    message_type: 'TEXT'
  };

  try {
    const resp = await axios.post(
      'https://adsapi.snapchat.com/v1/ads',
      payload,
      {
        headers: {
          Authorization: `Bearer ${snapchatAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.info(`[SnapchatBot] DM sent to ${recipientId}: ${message}`);
    await logToSupabase({ action: 'sendDirectMessage', payload, response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[SnapchatBot] sendDirectMessage error: ${msg}`);
    await logToSupabase({ action: 'sendDirectMessage', error: msg });
    throw error;
  }
}

async function getInsights() {
  try {
    const resp = await axios.get(
      `https://adsapi.snapchat.com/v1/ads/${snapchatAdAccountId}/insights`,
      {
        headers: {
          Authorization: `Bearer ${snapchatAccessToken}`
        }
      }
    );
    logger.info('[SnapchatBot] Insights retrieved successfully');
    await logToSupabase({ action: 'getInsights', response: resp.data });
    return resp.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[SnapchatBot] getInsights error: ${msg}`);
    await logToSupabase({ action: 'getInsights', error: msg });
    throw error;
  }
}

async function runSnapchatBot() {
  logger.info('[SnapchatBot] Starting automation task');
  if (!snapchatAccessToken) {
    const msg = '[SnapchatBot] SNAPCHAT_ACCESS_TOKEN not set';
    logger.error(msg);
    await logToSupabase({ action: 'runSnapchatBot', error: msg });
    return;
  }

  try {
    // Create a snap
    await createSnap();
    
    // Post to story
    await postToStory();
    
    // Get insights
    await getInsights();
    
    logger.info('[SnapchatBot] Task complete');
    await logToSupabase({ action: 'runSnapchatBot', status: 'complete' });
  } catch (error) {
    // Already logged in individual functions
  }
}

module.exports = runSnapchatBot;

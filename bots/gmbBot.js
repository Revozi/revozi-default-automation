const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

const { loadProviderCredentials } = require('../utils/credentials');
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

async function getProfile() {
  // GMB API doesn’t expose a direct profile endpoint.
  logger.info('[GmbBot] getProfile: Not supported');
  await logToSupabase({ action: 'getProfile', note: 'Not supported by GMB API' });
}

async function postContent(summary) {
  const payload = {
    languageCode: 'en',
    summary
  };

  const resp = await axios.post(
    `https://mybusiness.googleapis.com/v4/accounts/${gmbLocationId}/localPosts`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${gmbAccessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  logger.info('[GmbBot] Post created');
  await logToSupabase({ action: 'postContent', summary, response: resp.data });
}

async function runGmbBot() {
  logger.info('[GmbBot] Starting (Axios-based)');

  if (!gmbCreds.length) {
    const errMsg = '[GmbBot] No GMB credentials configured (see GMB_CREDENTIALS or GMB_LOCATION_ID/_1)';
    logger.error(errMsg);
    await logToSupabase({ action: 'runGmbBot', error: errMsg });
    return;
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
      await postContentForAccount(locationId, token, 'Bot update!');
    }, { concurrency: 1, delayMs: 800 });

    logger.info('[GmbBot] Task complete');
    await logToSupabase({ action: 'runGmbBot', status: 'complete' });
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[GmbBot] Error: ${errMsg}`);
    await logToSupabase({ action: 'runGmbBot', error: errMsg });
  }
}

async function postContentForAccount(locationId, token, summary) {
  const payload = {
    languageCode: 'en',
    summary
  };

  const resp = await axios.post(
    `https://mybusiness.googleapis.com/v4/accounts/${locationId}/localPosts`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  logger.info(`[GmbBot] Post created for ${locationId}`);
  await logToSupabase({ action: 'postContent', summary, account: locationId, response: resp.data });
}

module.exports = runGmbBot;

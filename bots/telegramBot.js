const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

const { loadProviderCredentials } = require('../utils/credentials');

// Support multiple telegram bots via TELEGRAM_CREDENTIALS or TELEGRAM_BOT_TOKEN_1 etc.
const telegramCreds = loadProviderCredentials('TELEGRAM', ['bot_token', 'chat_id']);

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'telegram',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[TelegramBot] Supabase log error: ${err.message}`);
  }
}

async function getProfile() {
  try {
    const resp = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
    logger.info(`[TelegramBot] Profile: ${JSON.stringify(resp.data)}`);
    await logToSupabase({ action: 'getProfile', data: resp.data });
    return resp.data;
  } catch (err) {
    logger.error(`[TelegramBot] getProfile error: ${err.message}`);
    await logToSupabase({ action: 'getProfile', error: err.message });
  }
}

async function postContent(message) {
  try {
    const resp = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text: message }
    );
    logger.info('[TelegramBot] Message sent');
    await logToSupabase({ action: 'postContent', message, response: resp.data });
  } catch (err) {
    logger.error(`[TelegramBot] postContent error: ${err.message}`);
    await logToSupabase({ action: 'postContent', error: err.message });
  }
}

async function autoReplyToMessages() {
  try {
    const resp = await axios.get(
      `https://api.telegram.org/bot${botToken}/getUpdates`
    );
    const updates = resp.data.result || [];
    for (const update of updates) {
      if (update.message && update.message.text && update.message.text.toLowerCase().includes('hello')) {
        await postContent('Hi! This is an auto-reply.');
        logger.info('[TelegramBot] Auto-replied to message');
        await logToSupabase({ action: 'autoReplyToMessages', update });
      }
    }
  } catch (err) {
    logger.error(`[TelegramBot] autoReplyToMessages error: ${err.message}`);
    await logToSupabase({ action: 'autoReplyToMessages', error: err.message });
  }
}

async function runTelegramBot() {
  logger.info('[TelegramBot] Starting (Supabase + Axios)');
  if (!telegramCreds.length) {
    logger.error('[TelegramBot] No Telegram credentials configured (see TELEGRAM_CREDENTIALS or TELEGRAM_BOT_TOKEN/_1)');
    return;
  }

  try {
    const { runWithRateLimit } = require('../utils/rateLimiter');
    await runWithRateLimit(telegramCreds, async (cred) => {
      const token = cred.bot_token || cred.botToken;
      const cid = cred.chat_id || cred.chatId;
      if (!token || !cid) {
        logger.warn('[TelegramBot] Skipping incomplete credential', { cred });
        return;
      }

      const resp = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
      logger.info(`[TelegramBot] Profile: ${JSON.stringify(resp.data)}`);
      await logToSupabase({ action: 'getProfile', data: resp.data, account: cid });

      await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        { chat_id: cid, text: 'Hello from Supabase-integrated Telegram bot!' }
      );
      logger.info('[TelegramBot] Message sent');
      await logToSupabase({ action: 'postContent', account: cid });
    }, { concurrency: 2, delayMs: 300 });

    logger.info('[TelegramBot] Task complete');
    await logToSupabase({ action: 'runTelegramBot', status: 'complete' });
  } catch (error) {
    const msg = error.response?.data?.description || error.message;
    logger.error(`[TelegramBot] Error: ${msg}`);
    await logToSupabase({ action: 'runTelegramBot', error: msg });
  }
}

module.exports = runTelegramBot;

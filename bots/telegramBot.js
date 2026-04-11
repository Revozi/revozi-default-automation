const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { loadProviderCredentials } = require('../utils/credentials');
const { autoGenerateContent } = require('../utils/autoContent');

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

async function fetchNextQueuedPost() {
  const now = new Date().toISOString();
  const { data: posts } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('platform', 'telegram')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(1);
  return Array.isArray(posts) && posts.length > 0 ? posts[0] : null;
}

async function runTelegramBot(payload = {}) {
  logger.info('[TelegramBot] Starting (Supabase + Axios)');

  if (!telegramCreds.length) {
    logger.error('[TelegramBot] No Telegram credentials configured (see TELEGRAM_CREDENTIALS or TELEGRAM_BOT_TOKEN/_1)');
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
      logger.info('[TelegramBot] Queue empty — auto-generating Revozi content...');
      const generated = await autoGenerateContent('telegram');
      textToPost = generated.caption;
    }
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

      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: cid,
        text: textToPost,
        parse_mode: 'HTML'
      });
      logger.info(`[TelegramBot] Message sent to chat ${cid}`);
      await logToSupabase({ action: 'postContent', text: textToPost, account: cid });
    }, { concurrency: 2, delayMs: 300 });

    if (queuedPost) {
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date() })
        .eq('id', queuedPost.id);
    }

    logger.info('[TelegramBot] Task complete');
    await logToSupabase({ action: 'runTelegramBot', status: 'complete' });
  } catch (error) {
    const msg = error.response?.data?.description || error.message;
    logger.error(`[TelegramBot] Error: ${msg}`);
    await logToSupabase({ action: 'runTelegramBot', error: msg });
  }
}

module.exports = runTelegramBot;

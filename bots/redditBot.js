const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { autoGenerateContent } = require('../utils/autoContent');

const redditToken = process.env.REDDIT_ACCESS_TOKEN;
const redditUser = process.env.REDDIT_USER;
const defaultSubreddit = process.env.DEFAULT_SUBREDDIT || 'revozi';

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'reddit',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[RedditBot] Supabase log error: ${err.message}`);
  }
}

async function fetchNextQueuedPost() {
  const now = new Date().toISOString();
  const { data: posts } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('platform', 'reddit')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(1);
  return Array.isArray(posts) && posts.length > 0 ? posts[0] : null;
}

async function postContent(subreddit, title, text) {
  const resp = await axios.post(
    'https://oauth.reddit.com/api/submit',
    new URLSearchParams({ sr: subreddit, kind: 'self', title, text }),
    {
      headers: {
        Authorization: `bearer ${redditToken}`,
        'User-Agent': `RedditBot/1.0 by ${redditUser}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  logger.info(`[RedditBot] Posted to r/${subreddit}: ${title}`);
  await logToSupabase({ action: 'postContent', subreddit, title, text, response: resp.data });
  return resp.data;
}

async function runRedditBot(payload = {}) {
  logger.info('[RedditBot] Starting (Supabase + Axios)');

  if (!redditToken || !redditUser) {
    logger.error('[RedditBot] REDDIT_ACCESS_TOKEN or REDDIT_USER not set in .env');
    return;
  }

  let textToPost = String(payload.caption || payload.text || '').trim();
  let titleToPost = String(payload.title || '').trim();
  let queuedPost = null;

  if (!textToPost) {
    queuedPost = await fetchNextQueuedPost();
    if (queuedPost) {
      textToPost = String(queuedPost.caption || queuedPost.text || '').trim();
      titleToPost = String(queuedPost.title || '').trim();
    }
    if (!textToPost) {
      logger.info('[RedditBot] Queue empty — auto-generating Revozi content...');
      const generated = await autoGenerateContent('reddit');
      textToPost = generated.caption;
    }
  }

  if (!titleToPost) {
    titleToPost = textToPost.substring(0, 100);
  }

  try {
    await postContent(defaultSubreddit, titleToPost, textToPost);

    if (queuedPost) {
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date() })
        .eq('id', queuedPost.id);
    }

    logger.info('[RedditBot] Task complete');
    await logToSupabase({ action: 'runRedditBot', status: 'complete' });
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    logger.error(`[RedditBot] Error: ${msg}`);
    await logToSupabase({ action: 'runRedditBot', error: msg });
  }
}

module.exports = runRedditBot;

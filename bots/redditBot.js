const axios = require('axios');
const logger = require('../utils/logger');
const { supabase } = require('../services/supabaseClient');

const redditToken = process.env.REDDIT_ACCESS_TOKEN;
const redditUser = process.env.REDDIT_USER;

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

async function getProfile() {
  try {
    const resp = await axios.get(
      'https://oauth.reddit.com/api/v1/me',
      {
        headers: {
          Authorization: `bearer ${redditToken}`,
          'User-Agent': `RedditBot/1.0 by ${redditUser}`
        }
      }
    );
    logger.info(`[RedditBot] Profile: ${JSON.stringify(resp.data)}`);
    await logToSupabase({ action: 'getProfile', data: resp.data });
    return resp.data;
  } catch (err) {
    logger.error(`[RedditBot] getProfile error: ${err.message}`);
    await logToSupabase({ action: 'getProfile', error: err.message });
  }
}

async function postContent(subreddit, title, text) {
  try {
    const resp = await axios.post(
      'https://oauth.reddit.com/api/submit',
      new URLSearchParams({
        sr: subreddit,
        kind: 'self',
        title,
        text
      }),
      {
        headers: {
          Authorization: `bearer ${redditToken}`,
          'User-Agent': `RedditBot/1.0 by ${redditUser}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    logger.info(`[RedditBot] Posted to r/${subreddit}: ${title}`);
    await logToSupabase({
      action: 'postContent',
      subreddit,
      title,
      text,
      response: resp.data
    });
    return resp.data;
  } catch (err) {
    logger.error(`[RedditBot] postContent error: ${err.message}`);
    await logToSupabase({ action: 'postContent', error: err.message });
  }
}

async function commentOnContent(thingId, text) {
  try {
    const resp = await axios.post(
      'https://oauth.reddit.com/api/comment',
      new URLSearchParams({ thing_id: thingId, text }),
      {
        headers: {
          Authorization: `bearer ${redditToken}`,
          'User-Agent': `RedditBot/1.0 by ${redditUser}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    logger.info(`[RedditBot] Commented on ${thingId}: ${text}`);
    await logToSupabase({ action: 'commentOnContent', thingId, text, response: resp.data });
  } catch (err) {
    logger.error(`[RedditBot] commentOnContent error: ${err.message}`);
    await logToSupabase({ action: 'commentOnContent', error: err.message });
  }
}

async function autoReplyToComments() {
  logger.info('[RedditBot] autoReplyToComments: Not implemented');
  await logToSupabase({ action: 'autoReplyToComments', status: 'not_implemented' });
}

async function runRedditBot() {
  logger.info('[RedditBot] Starting (Supabase + Axios)');
  if (!redditToken || !redditUser) {
    logger.error('[RedditBot] REDDIT_ACCESS_TOKEN or REDDIT_USER not set in .env');
    return;
  }

  try {
    await getProfile();

    const post = await postContent('test', 'Bot post title', 'Bot post body');
    const postId = post?.json?.data?.id;

    if (postId) {
      await commentOnContent(`t3_${postId}`, 'Nice post!');
      await autoReplyToComments();
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

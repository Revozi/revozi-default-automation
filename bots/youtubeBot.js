const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { google } = require('googleapis');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');

const YT_TITLE_LIMIT = 100;
const YT_DESC_LIMIT = 5000;

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'youtube',
      ...activity,
      created_at: new Date().toISOString(),
    }]);
  } catch (err) {
    logger.error(`[YoutubeBot] Supabase log error: ${err.message}`);
  }
}

function buildOAuthClient() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

async function downloadToTemp(url) {
  const tmp = path.join(os.tmpdir(), `yt-${crypto.randomBytes(6).toString('hex')}.mp4`);
  const writer = fs.createWriteStream(tmp);
  const resp = await axios.get(url, { responseType: 'stream', maxContentLength: Infinity, maxBodyLength: Infinity });
  await new Promise((resolve, reject) => {
    resp.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  return tmp;
}

function buildSnippet(caption, payload) {
  const baseTitle = payload.title || caption || payload.text || 'Untitled Video';
  const title = String(baseTitle).slice(0, YT_TITLE_LIMIT);
  const description = String(payload.description || caption || payload.text || '').slice(0, YT_DESC_LIMIT);
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  return {
    snippet: { title, description, tags, categoryId: '22' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  };
}

async function uploadOne(youtube, filePath, requestBody) {
  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody,
    media: { body: fs.createReadStream(filePath) },
  });
  return res.data;
}

async function fetchPendingPosts(limit = 5) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('post_queue')
    .select('*')
    .eq('platform', 'youtube')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error(`[YoutubeBot] Supabase queue error: ${error.message}`);
    return [];
  }
  return data || [];
}

async function processPayload(youtube, payload) {
  const { mediaUrl, videoPath, caption } = payload;
  let localPath = videoPath;
  let downloaded = false;

  try {
    if (!localPath && mediaUrl) {
      logger.info(`[YoutubeBot] Downloading media from ${mediaUrl}`);
      localPath = await downloadToTemp(mediaUrl);
      downloaded = true;
    }
    if (!localPath || !fs.existsSync(localPath)) {
      throw new Error('YouTube requires a video file (mediaUrl or videoPath)');
    }

    const requestBody = buildSnippet(caption, payload);
    const result = await uploadOne(youtube, localPath, requestBody);
    logger.info(`[YoutubeBot] Uploaded video id=${result.id} title="${requestBody.snippet.title}"`);
    return result;
  } finally {
    if (downloaded && localPath) {
      fs.promises.unlink(localPath).catch(() => {});
    }
  }
}

async function runYoutubeBot(payload = {}) {
  logger.info('[YoutubeBot] Starting');

  const oauth2 = buildOAuthClient();
  if (!oauth2) {
    logger.error('[YoutubeBot] Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN');
    return;
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  // Direct invocation path: dispatcher passes { mediaUrl, caption }; tests pass { videoPath, ... }
  if (payload && (payload.mediaUrl || payload.videoPath)) {
    try {
      const result = await processPayload(youtube, payload);
      await logToSupabase({
        action: 'uploadVideo',
        video_id: result.id,
        title: result?.snippet?.title || null,
        response: result,
      });
      logger.info('[YoutubeBot] Direct payload upload complete');
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      logger.error(`[YoutubeBot] Direct payload failed: ${msg}`);
      await logToSupabase({ action: 'uploadVideo', error: msg });
    }
    return;
  }

  // Cron path: drain pending YouTube rows in post_queue
  const posts = await fetchPendingPosts();
  if (!posts.length) {
    logger.info('[YoutubeBot] Queue empty — nothing to upload');
    return;
  }

  logger.info(`[YoutubeBot] Found ${posts.length} pending YouTube post(s)`);

  for (const post of posts) {
    try {
      const result = await processPayload(youtube, {
        mediaUrl: post.media_url,
        caption: post.caption,
        title: post.title,
        description: post.description,
        tags: post.tags,
      });
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date().toISOString() })
        .eq('id', post.id);
      await logToSupabase({
        action: 'uploadVideo',
        video_id: result.id,
        title: result?.snippet?.title || null,
        response: result,
      });
      logger.info(`[YoutubeBot] SUCCESS post_queue.id=${post.id} -> video ${result.id}`);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      logger.error(`[YoutubeBot] FAILED post_queue.id=${post.id}: ${msg}`);
      await supabase.from('post_queue')
        .update({ status: 'failed', last_attempt_at: new Date().toISOString(), retries: (post.retries || 0) + 1 })
        .eq('id', post.id);
      await logToSupabase({ action: 'uploadVideo', queue_id: post.id, error: msg });
    }
  }

  logger.info('[YoutubeBot] Complete');
}

module.exports = runYoutubeBot;

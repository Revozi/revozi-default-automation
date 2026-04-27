const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../utils/logger');
const { supabase } = require('../services/pgClient');
const { loadProviderCredentials } = require('../utils/credentials');
const { autoGenerateContent } = require('../utils/autoContent');

const ytCreds = loadProviderCredentials('YOUTUBE', ['accessToken', 'channelId']);

async function logToSupabase(activity) {
  try {
    await supabase.from('engagements').insert([{
      platform: 'youtube',
      ...activity,
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    logger.error(`[YoutubeBot] Supabase log error: ${err.message}`);
  }
}

async function fetchNextQueuedPost() {
  const now = new Date().toISOString();
  const { data: posts } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('platform', 'youtube')
    .lte('scheduled_at', now)
    .order('priority', { ascending: false })
    .limit(1);
  return Array.isArray(posts) && posts.length > 0 ? posts[0] : null;
}

async function uploadVideo(token, videoPath, title, description, tags = []) {
  const metadata = {
    snippet: {
      title: title || 'Untitled Video',
      description: description || '',
      tags: tags,
      categoryId: '22'
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false
    }
  };

  const form = new FormData();
  form.append('metadata', JSON.stringify(metadata), { contentType: 'application/json' });
  
  if (videoPath && fs.existsSync(videoPath)) {
    form.append('video', fs.createReadStream(videoPath), { contentType: 'video/*' });
  } else {
    throw new Error('Video file not found');
  }

  const response = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos',
    form,
    {
      headers: { ...form.getHeaders(), 'Authorization': `Bearer ${token}` },
      params: { part: 'snippet,status', uploadType: 'multipart' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
  );

  logger.info(`[YoutubeBot] Video uploaded: ${response.data.id}`);
  return response.data;
}

async function postContentForAccount(token, channelId, payload) {
  const { videoPath, title, description, tags, caption, text } = payload;

  if (!videoPath) {
    throw new Error('YouTube requires video content');
  }

  const videoTitle = title || caption || text || 'Untitled Video';
  const videoDesc = description || text || '';
  const videoTags = tags || [];
  
  const result = await uploadVideo(token, videoPath, videoTitle, videoDesc, videoTags);
  
  await logToSupabase({ 
    action: 'uploadVideo', 
    video_id: result.id,
    title: videoTitle,
    channel: channelId,
    response: result 
  });
  
  return result;
}

async function runYoutubeBot(payload = {}) {
  logger.info('[YoutubeBot] Starting');

  if (!ytCreds.length) {
    logger.error('[YoutubeBot] No YouTube credentials configured');
    return;
  }

  let postData = payload;
  let queuedPost = null;

  if (!payload.videoPath && !payload.text) {
    queuedPost = await fetchNextQueuedPost();
    if (queuedPost) {
      postData = {
        videoPath: queuedPost.media_url,
        title: queuedPost.title,
        caption: queuedPost.caption,
        text: queuedPost.text,
        tags: queuedPost.tags || []
      };
    }
  }

  try {
    const { runWithRateLimit } = require('../utils/rateLimiter');
    await runWithRateLimit(ytCreds, async (cred) => {
      const token = cred.accessToken || cred.access_token;
      const channelId = cred.channelId || cred.channel_id;
      
      if (!token) {
        logger.warn('[YoutubeBot] Missing access token');
        return;
      }
      
      await postContentForAccount(token, channelId, postData);
    }, { concurrency: 1, delayMs: 2000 });

    if (queuedPost) {
      await supabase.from('post_queue')
        .update({ status: 'posted', last_attempt_at: new Date() })
        .eq('id', queuedPost.id);
    }

    logger.info('[YoutubeBot] Complete');
    await logToSupabase({ action: 'runYoutubeBot', status: 'complete' });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    logger.error(`[YoutubeBot] Error: ${msg}`);
    await logToSupabase({ action: 'runYoutubeBot', error: msg });
  }
}

module.exports = runYoutubeBot;

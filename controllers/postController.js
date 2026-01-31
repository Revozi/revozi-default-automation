const { supabase } = require('../services/supabaseClient');
const { generateCaption } = require('../services/aiService');
const {
  generateImageFromPrompt,
  generateVideoFromPrompt,
} = require('../services/replicateService');
const logger = require('../utils/logger');

const axios = require('axios');

// Helper: Decide media type based on platform
const inferMediaType = (platform) => {
  const videoPlatforms = ['tiktok', 'youtubeshorts'];
  return videoPlatforms.includes(platform.toLowerCase()) ? 'video' : 'image';
};

// 1. Schedule a post (AI caption + optional media + queue it)
exports.schedulePost = async (req, res) => {
  const { platform, media_prompt, media_url, scheduled_at, type } = req.body;

  if (!platform || !media_prompt) {
    return res.status(400).json({ error: 'Missing platform or media_prompt' });
  }

  try {
    // 1. Generate AI Caption with multi-language support
    const { languages = process.env.SUPPORTED_LANGS?.split(',') } = req.body;
    const generatedContent = await generateCaption({
      prompt: media_prompt,
      platform,
      languages,
      geo: req.geoRegion
    });
    logger.info(`[SCHEDULE_POST] Multi-language captions generated for ${platform}`);

    // 2. Decide if we need to generate media
    let finalMediaUrl = media_url;
    const shouldGenerate = !finalMediaUrl || finalMediaUrl.trim() === '';
    const requestedType = type || inferMediaType(platform); // fallback by platform
    if (shouldGenerate) {
      logger.info(`[SCHEDULE_POST] No media_url provided, generating media of type: ${requestedType}`);
      try {
        if (requestedType === 'video' && process.env.ENABLE_VIDEO_GEN === 'true') {
          finalMediaUrl = await generateVideoFromPrompt(media_prompt);
          logger.info(`[SCHEDULE_POST] Video generated: ${finalMediaUrl}`);
        } else {
          finalMediaUrl = await generateImageFromPrompt(media_prompt);
          logger.info(`[SCHEDULE_POST] Image generated: ${finalMediaUrl}`);
        }

        if (!finalMediaUrl) {
          throw new Error(`No ${requestedType} URL was returned from generation`);
        }
      } catch (genErr) {
        logger.error(`[SCHEDULE_POST] Media generation failed: ${genErr.message}`);
        return res.status(500).json({ error: 'Media generation failed', detail: genErr.message });
      }
    }


    // 3. Save to generated_posts
    await supabase.from('generated_posts').insert({
      platform,
      media_prompt,
      media_url: finalMediaUrl,
      queued: true,
      metadata: {
        captions: generatedContent.captions,
        transcripts: generatedContent.transcripts
      },
      extras: generatedContent.extras
    });

    // 4. Save to post_queue
    const { error } = await supabase.from('post_queue').insert({
      platform,
      media_url: finalMediaUrl,
      metadata: {
        captions: generatedContent.captions,
        transcripts: generatedContent.transcripts
      },
      extras: generatedContent.extras,
      priority: 0,
      scheduled_at: scheduled_at || new Date(),
    });

    if (error) throw error;

    res.json({ message: 'Post scheduled successfully' });
  } catch (err) {
    logger.error(`[SCHEDULE_POST] ${err.stack}`);
    res.status(500).json({ error: 'Failed to schedule post', detail: err.message });
  }
};

// 2. Preview caption with multi-language support (no queue)
exports.previewCaption = async (req, res) => {
  const { platform, prompt } = req.body;
  if (!platform || !prompt) {
    return res.status(400).json({ error: 'Missing platform or prompt' });
  }

  try {
    const { languages = process.env.SUPPORTED_LANGS?.split(',') } = req.body;
    const generatedContent = await generateCaption({
      prompt,
      platform,
      languages,
      geo: req.geoRegion
    });
    res.json({
      platform,
      prompt,
      ...generatedContent
    });
  } catch (err) {
    logger.error(`[PREVIEW_CAPTION] ${err.stack}`);
    res.status(500).json({ error: 'Failed to generate multi-language caption' });
  }
};

// 3. Retry all failed posts manually
exports.retryFailedPosts = async (req, res) => {
  try {
    const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
    const now = new Date().toISOString();

    const { data: posts, error } = await supabase
      .from('post_queue')
      .select('*')
      .eq('status', 'failed')
      .lt('retries', MAX_RETRIES);

    if (error) return res.status(500).json({ error: error.message });
    if (!posts.length) return res.json({ message: 'No failed posts to retry' });

    const updates = posts.map((post) =>
      supabase.from('post_queue').update({
        status: 'pending',
        scheduled_at: now,
      }).eq('id', post.id)
    );

    await Promise.all(updates);
    res.json({ message: `${posts.length} post(s) marked for retry.` });
  } catch (err) {
    logger.error(`[RETRY_FAILED] ${err.stack}`);
    res.status(500).json({ error: 'Retry failed posts failed' });
  }
};

// 4. Retry posts by platform
exports.retryByPlatform = async (req, res) => {
  const { platform } = req.body;
  const now = new Date().toISOString();

  if (!platform) return res.status(400).json({ error: 'Missing platform' });

  try {
    const { data: posts, error } = await supabase
      .from('post_queue')
      .select('*')
      .eq('status', 'failed')
      .eq('platform', platform)
      .lt('retries', parseInt(process.env.MAX_RETRIES || '3'));

    if (error) return res.status(500).json({ error: error.message });
    if (!posts.length) return res.json({ message: `No failed posts for ${platform}` });

    const updates = posts.map((post) =>
      supabase.from('post_queue').update({
        status: 'pending',
        scheduled_at: now,
      }).eq('id', post.id)
    );

    await Promise.all(updates);
    res.json({ message: `${posts.length} post(s) on ${platform} requeued.` });
  } catch (err) {
    logger.error(`[RETRY_PLATFORM] ${err.stack}`);
    res.status(500).json({ error: 'Retry by platform failed' });
  }
};

// 5. View full post queue with language support
exports.getPostQueue = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('post_queue')
      .select('*')
      .order('scheduled_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Handle language selection and fallback
    const localizedData = data.map(post => {
      const captions = post.metadata?.captions || { en: post.caption }; // Fallback for legacy posts
      const transcripts = post.metadata?.transcripts || {};
      const geoAware = post.extras?.geoAware || {};

      return {
        ...post,
        caption: captions[req.targetLang] || captions.en, // Fallback to English
        transcript: transcripts[req.targetLang] || transcripts.en,
        geoMessage: geoAware[req.targetLang] || geoAware.en,
        originalMetadata: post.metadata, // Keep full metadata for reference
        originalExtras: post.extras
      };
    });

    res.json(localizedData);
  } catch (err) {
    logger.error(`[GET_POST_QUEUE] ${err.stack}`);
    res.status(500).json({ error: 'Failed to load post queue' });
  }
};

// 6. Get generated posts with language support
exports.getGeneratedPosts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Handle language selection and fallback
    const localizedData = data.map(post => {
      const captions = post.metadata?.captions || { en: post.caption }; // Fallback for legacy posts
      const transcripts = post.metadata?.transcripts || {};
      const geoAware = post.extras?.geoAware || {};

      return {
        ...post,
        caption: captions[req.targetLang] || captions.en, // Fallback to English
        transcript: transcripts[req.targetLang] || transcripts.en,
        geoMessage: geoAware[req.targetLang] || geoAware.en,
        originalMetadata: post.metadata, // Keep full metadata for reference
        originalExtras: post.extras
      };
    });

    res.json(localizedData);
  } catch (err) {
    logger.error(`[GET_GENERATED_POSTS] ${err.stack}`);
    res.status(500).json({ error: 'Failed to load generated posts' });
  }
};

// 6. View generated posts
exports.getGeneratedPosts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    logger.error(`[GET_GENERATED_POSTS] ${err.stack}`);
    res.status(500).json({ error: 'Failed to fetch generated posts' });
  }
};

// 7. Delete a post (cleanup or admin UI)
exports.deletePost = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('post_queue').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    logger.error(`[DELETE_POST] ${err.stack}`);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

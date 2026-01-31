const { supabase } = require('../services/supabaseClient');
const logger = require('../utils/logger');

// THRESHOLDS
const LIKE_THRESHOLD = 100;
const VIEW_THRESHOLD = 1000;

exports.engagementCallback = async (req, res) => {
  try {
    const { post_id, platform, likes = 0, shares = 0, comments = 0, views = 0, user_id } = req.body;

    if (!post_id || !platform) {
      return res.status(400).json({ error: 'Missing required fields: post_id or platform' });
    }

    // Insert engagement metrics
    const { data, error: insertError } = await supabase
      .from('engagements')
      .insert([
        {
          post_id,
          platform,
          likes,
          shares,
          comments,
          views,
          user_id,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    logger.info(`[ENGAGEMENT] Saved metrics for post ${post_id} on ${platform}`);

    // Check reward condition
    const meetsThreshold = likes >= LIKE_THRESHOLD || views >= VIEW_THRESHOLD;
    if (meetsThreshold) {
      logger.info(`[ENGAGEMENT] Threshold met for post ${post_id}. Calling RPC: award_tokens_if_needed`);

      const { data: rewardData, error: rewardError } = await supabase.rpc('award_tokens_if_needed', {
        input_post_id: post_id,
        input_user_id: user_id,
      });

      if (rewardError) {
        logger.error(`[ENGAGEMENT] RPC error: ${rewardError.message}`);
        return res.status(500).json({ error: 'Reward function failed', detail: rewardError.message });
      }

      return res.json({ message: 'Engagement saved and reward triggered', reward: rewardData });
    }

    return res.json({ message: 'Engagement saved. Threshold not met.' });
  } catch (err) {
    logger.error(`[ENGAGEMENT_CALLBACK] ${err.message}`);
    return res.status(500).json({ error: 'Failed to record engagement', detail: err.message });
  }
};
exports.getAllEngagements = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('engagements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ engagements: data });
  } catch (err) {
    logger.error(`[ENGAGEMENT_GET_ALL] ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch engagements', detail: err.message });
  }
};

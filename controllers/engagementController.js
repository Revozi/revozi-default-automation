const db = require('../services/db');
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
    const result = await db.query(
      `INSERT INTO automation.engagements (post_id, platform, likes, shares, comments, views, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [post_id, platform, likes, shares, comments, views, user_id]
    );

    const engagement = result.rows[0];

    logger.info(`[ENGAGEMENT] Saved metrics for post ${post_id} on ${platform}`);

    // Check reward condition
    const meetsThreshold = likes >= LIKE_THRESHOLD || views >= VIEW_THRESHOLD;
    if (meetsThreshold) {
      logger.info(`[ENGAGEMENT] Threshold met for post ${post_id}. Calling function: award_tokens_if_needed`);

      // Call PostgreSQL function
      const rewardResult = await db.query(
        `SELECT automation.award_tokens_if_needed($1, $2) as result`,
        [post_id, user_id]
      );

      const rewardData = rewardResult.rows[0]?.result;

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
    const result = await db.query(
      `SELECT * FROM automation.engagements ORDER BY created_at DESC`
    );

    return res.json({ engagements: result.rows });
  } catch (err) {
    logger.error(`[ENGAGEMENT_GET_ALL] ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch engagements', detail: err.message });
  }
};

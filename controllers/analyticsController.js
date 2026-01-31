const db = require('../services/db');
const logger = require('../utils/logger');

// 📊 1. Engagement stats per platform
exports.getEngagementStats = async (req, res) => {
  try {
    // Call PostgreSQL function
    const result = await db.query(`SELECT * FROM automation.get_platform_engagement_stats()`);
    res.json({ platforms: result.rows });
  } catch (err) {
    logger.error(`[ANALYTICS] Engagement stats error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch engagement stats' });
  }
};

// 🪙 2. Reward breakdown by type
exports.getRewardStats = async (req, res) => {
  try {
    // Call PostgreSQL function
    const result = await db.query(`SELECT * FROM automation.get_reward_stats_by_type()`);
    res.json(result.rows); // Return array directly
  } catch (err) {
    logger.error(`[ANALYTICS] Reward stats error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch reward stats' });
  }
};

// 🧑‍💼 3. Top users by total engagement
exports.getTopUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT user_id, likes, shares, comments, views FROM automation.engagements`
    );

    // Aggregate engagement scores in Node.js
    const userStats = result.rows.reduce((acc, e) => {
      const score = e.likes + e.shares + e.comments + e.views;
      acc[e.user_id] = (acc[e.user_id] || 0) + score;
      return acc;
    }, {});

    const topUsers = Object.entries(userStats)
      .map(([user_id, total]) => ({ user_id, total_engagement: total }))
      .sort((a, b) => b.total_engagement - a.total_engagement)
      .slice(0, 10); // top 10

    res.json({ top_users: topUsers });
  } catch (err) {
    logger.error(`[ANALYTICS] Top users error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch top users', detail: err.message });
  }
};

// 🎁 4. Full reward list
exports.getAllRewards = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM automation.rewards ORDER BY issued_at DESC`
    );

    res.json({ rewards: result.rows });
  } catch (err) {
    logger.error(`[ANALYTICS] Fetch all rewards error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch all rewards' });
  }
};

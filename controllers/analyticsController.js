const { supabase } = require('../services/supabaseClient');
const logger = require('../utils/logger');

// 📊 1. Engagement stats per platform
exports.getEngagementStats = async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_platform_engagement_stats');
    if (error) throw error;
    res.json({ platforms: data });
  } catch (err) {
    logger.error(`[ANALYTICS] Engagement stats error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch engagement stats' });
  }
};

// 🪙 2. Reward breakdown by type
exports.getRewardStats = async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_reward_stats_by_type');
    if (error) throw error;
    res.json(data); // Return array directly
  } catch (err) {
    logger.error(`[ANALYTICS] Reward stats error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch reward stats' });
  }
};

// 🧑‍💼 3. Top users by total engagement
exports.getTopUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('engagements')
      .select('user_id, likes, shares, comments, views')
    
    if (error) throw error;

    // Aggregate engagement scores in Node.js
    const userStats = data.reduce((acc, e) => {
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
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .order('issued_at', { ascending: false });

    if (error) throw error;
    res.json({ rewards: data });
  } catch (err) {
    logger.error(`[ANALYTICS] Fetch all rewards error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch all rewards' });
  }
};

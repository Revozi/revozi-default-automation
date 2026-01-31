const db = require('./db');
const logger = require('../utils/logger');

/**
 * Award tokens to a user
 */
async function awardTokens(userId, amount, reason) {
  try {
    const result = await db.query(
      `INSERT INTO automation.rewards (user_id, amount, reason, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [userId, amount, reason]
    );
    
    logger.info(`[Rewards] Awarded ${amount} tokens to user ${userId}: ${reason}`);
    return { success: true, data: result.rows[0] };
  } catch (error) {
    logger.error(`[Rewards] Failed to award tokens: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's total tokens
 */
async function getUserTokens(userId) {
  try {
    const result = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM automation.rewards WHERE user_id = $1',
      [userId]
    );
    
    return { success: true, total: parseInt(result.rows[0].total) };
  } catch (error) {
    logger.error(`[Rewards] Failed to get user tokens: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's reward history
 */
async function getRewardHistory(userId, limit = 50) {
  try {
    const result = await db.query(
      'SELECT * FROM automation.rewards WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    
    return { success: true, data: result.rows };
  } catch (error) {
    logger.error(`[Rewards] Failed to get reward history: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  awardTokens,
  getUserTokens,
  getRewardHistory
};

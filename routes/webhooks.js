const express = require('express');
const router = express.Router();
const { awardReward } = require('../services/rewardsService');

// Security: check webhook secret header if set
function checkSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return next();
  const hdr = req.header('x-webhook-secret');
  if (!hdr || hdr !== secret) return res.status(401).json({ error: 'Unauthorized webhook' });
  next();
}

router.post('/share', checkSecret, async (req, res) => {
  try {
    const { user_id, post_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const result = await awardReward({ user_id, reward_type: 'points', amount: 5, metadata: { action: 'share', post_id } });
    res.json({ awarded: result });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

router.post('/referral', checkSecret, async (req, res) => {
  try {
    const { referrer_id, new_user_id, post_id } = req.body;
    if (!referrer_id) return res.status(400).json({ error: 'referrer_id required' });
    const result = await awardReward({ user_id: referrer_id, reward_type: 'points', amount: 20, metadata: { action: 'referral', new_user_id, post_id } });
    // Optionally record partner_users mapping
    res.json({ awarded: result });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

router.post('/comment', checkSecret, async (req, res) => {
  try {
    const { user_id, post_id, comment_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const result = await awardReward({ user_id, reward_type: 'points', amount: 2, metadata: { action: 'comment', post_id, comment_id } });
    res.json({ awarded: result });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

router.post('/login', checkSecret, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const result = await awardReward({ user_id, reward_type: 'points', amount: 1, metadata: { action: 'daily_login' } });
    res.json({ awarded: result });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

module.exports = router;

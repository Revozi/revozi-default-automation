const express = require('express');
const router = express.Router();
const { getRewardsForUser, awardReward } = require('../services/rewardsService');
const db = require('../services/db');

// List rewards for current user (expects req.user via middleware)
router.get('/me', async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Unauthorized' });
    const rewards = await getRewardsForUser(user.id);
    res.json({ rewards });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin/API: award a reward (protected via ADMIN_API_KEY or WEBHOOK_SECRET)
router.post('/award', async (req, res) => {
  try {
    const key = req.header('x-admin-key') || req.header('x-webhook-secret');
    if (process.env.ADMIN_API_KEY && key !== process.env.ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
    if (!process.env.ADMIN_API_KEY && process.env.WEBHOOK_SECRET && key !== process.env.WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

    const { user_id, reward_type, amount, metadata } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const r = await awardReward({ user_id, reward_type, amount, metadata });
    res.json({ reward: r });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

module.exports = router;

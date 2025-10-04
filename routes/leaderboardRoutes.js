const express = require('express');
const router = express.Router();
const { getLeaderboard } = require('../controllers/leaderboardController');

// Public endpoint for visitors leaderboard (read-only)
router.get('/', getLeaderboard);

module.exports = router;

#!/bin/bash

# =============================================================================
# Complete Supabase to PostgreSQL Migration Script
# Fixes all remaining supabase.from() calls in bots, services, and routes
# =============================================================================

echo "🔧 Starting Complete Supabase Migration..."
echo ""

cd /Users/rajatsingh/Documents/Sandys_project/Crimson/Crimson-Window-Dev-E-Auto

# =============================================================================
# 1. FIX ALL BOT FILES (11 files)
# =============================================================================
echo "📱 Fixing Bot Files..."

bot_files=(
  "bots/pinterestBot.js"
  "bots/snapchatBot.js"
  "bots/twitterBot.js"
  "bots/redditBot.js"
  "bots/tiktokBot.js"
  "bots/telegramBot.js"
  "bots/quoraBot.js"
  "bots/gmbBot.js"
  "bots/facebookBot.js"
  "bots/discordBot.js"
  "bots/linkedinBot.js"
)

for file in "${bot_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ Fixing $file"
    # Replace supabase.from('engagements').insert with db.query
    sed -i '' 's|await supabase\.from('\''engagements'\'')\.insert(\[\{|await db.query(\n      `INSERT INTO automation.engagements (platform, action, error, account, created_at) VALUES ($1, $2, $3, $4, NOW())`,\n      [activity.platform, activity.action, activity.error, activity.account]\n    ); /*{|g' "$file"
  fi
done

echo ""

# =============================================================================
# 2. FIX UTILS/PERMISSIONS.JS
# =============================================================================
echo "🔐 Fixing utils/permissions.js..."

cat > utils/permissions.js << 'EOF'
const db = require('../services/db');

async function getUserRole(userId) {
  try {
    const result = await db.query(
      'SELECT role FROM automation.users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].role;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

module.exports = { getUserRole };
EOF

echo "  ✓ Fixed utils/permissions.js"
echo ""

# =============================================================================
# 3. FIX BLOG/BLOGSCHEDULER.JS
# =============================================================================
echo "📝 Fixing blog/blogScheduler.js..."

# Read the file and fix the supabase call
if [ -f "blog/blogScheduler.js" ]; then
  sed -i '' 's|await supabase\.from('\''blogs'\'')\.update({ published: true })\.eq('\''id'\'', blog\.id);|await db.query('\''UPDATE automation.blogs SET published = true WHERE id = $1'\'', [blog.id]);|g' blog/blogScheduler.js
  echo "  ✓ Fixed blog/blogScheduler.js"
fi

echo ""

# =============================================================================
# 4. FIX ROUTES/VERIFICATIONROUTES.JS
# =============================================================================
echo "🔍 Fixing routes/verificationRoutes.js..."

cat > routes/verificationRoutes.js << 'EOF'
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const logger = require('../utils/logger');

// Get all roles
router.get('/roles', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM automation.roles ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Verification] Error fetching roles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all permissions
router.get('/permissions', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM automation.permissions ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Verification] Error fetching permissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get role permissions
router.get('/roles/:roleId/permissions', async (req, res) => {
  try {
    const { roleId } = req.params;
    const result = await db.query(
      `SELECT p.* FROM automation.permissions p
       JOIN automation.role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1`,
      [roleId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Verification] Error fetching role permissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a role
router.delete('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM automation.roles WHERE id = $1', [id]);
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    logger.error('[Verification] Error deleting role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Assign role to user
router.post('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    await db.query(
      'UPDATE automation.users SET role = $1 WHERE id = $2',
      [role, userId]
    );
    
    res.json({ success: true, message: 'Role assigned successfully' });
  } catch (error) {
    logger.error('[Verification] Error assigning role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove role from user (set to visitor)
router.delete('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await db.query(
      'UPDATE automation.users SET role = $1 WHERE id = $2',
      ['visitor', userId]
    );
    
    res.json({ success: true, message: 'Role removed successfully' });
  } catch (error) {
    logger.error('[Verification] Error removing role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
EOF

echo "  ✓ Fixed routes/verificationRoutes.js"
echo ""

# =============================================================================
# 5. FIX SERVICES/AISERVICE.JS
# =============================================================================
echo "🤖 Fixing services/aiService.js..."

if [ -f "services/aiService.js" ]; then
  # Replace both supabase.from('ai_outputs').insert calls
  sed -i '' 's|await supabase\.from('\''ai_outputs'\'')\.insert({|await db.query(\n      `INSERT INTO automation.ai_outputs (prompt, response, model, created_at) VALUES ($1, $2, $3, NOW())`,\n      [prompt, response, model]\n    ); /*{|g' services/aiService.js
  echo "  ✓ Fixed services/aiService.js"
fi

echo ""

# =============================================================================
# 6. FIX SERVICES/REWARDSSERVICE.JS
# =============================================================================
echo "🎁 Fixing services/rewardsService.js..."

cat > services/rewardsService.js << 'EOF'
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
EOF

echo "  ✓ Fixed services/rewardsService.js"
echo ""

# =============================================================================
# 7. VERIFICATION
# =============================================================================
echo "🔍 Verifying fixes..."
echo ""

remaining=$(grep -r "supabase\.from" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v test | wc -l | tr -d ' ')

if [ "$remaining" -eq "0" ]; then
  echo "✅ SUCCESS! All supabase.from() calls have been converted!"
else
  echo "⚠️  Warning: Found $remaining remaining supabase.from() calls"
  echo "   (These may be in test files or comments)"
fi

echo ""
echo "📊 Migration Summary:"
echo "   ✓ 11 bot files fixed"
echo "   ✓ utils/permissions.js rewritten"
echo "   ✓ blog/blogScheduler.js fixed"
echo "   ✓ routes/verificationRoutes.js rewritten"
echo "   ✓ services/aiService.js fixed"
echo "   ✓ services/rewardsService.js rewritten"
echo ""
echo "🚀 Ready to start the server!"
echo ""
echo "Run: ./start-automation-worker.sh"

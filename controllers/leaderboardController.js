const db = require('../services/db');

async function getLeaderboard(req, res) {
  try {
    // Return leaderboard entries only for visitors
    const result = await db.query(
      `SELECT id, user_id, points, position, week_start, week_end 
       FROM automation.leaderboard 
       ORDER BY position ASC 
       LIMIT 100`
    );

    if (!result.rows.length) {
      return res.json({ leaderboard: [] });
    }

    // Optionally enrich with user info
    const userIds = result.rows.map(r => r.user_id).filter(Boolean);
    
    if (userIds.length === 0) {
      return res.json({ leaderboard: result.rows.map(row => ({ ...row, user: null })) });
    }

    const usersResult = await db.query(
      `SELECT id, name, email, badge FROM automation.users WHERE id = ANY($1)`,
      [userIds]
    );
    
    const usersById = (usersResult.rows || []).reduce((acc, u) => { 
      acc[u.id] = u; 
      return acc; 
    }, {});

    const enriched = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      points: row.points,
      position: row.position,
      week_start: row.week_start,
      week_end: row.week_end,
      user: usersById[row.user_id] || null
    }));

    res.json({ leaderboard: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { getLeaderboard };

const { supabase } = require('../services/supabaseClient');

async function getLeaderboard(req, res) {
  try {
    // Return leaderboard entries only for visitors
    const { data, error } = await supabase.from('leaderboard').select('id, user_id, points, position, week_start, week_end').order('position', { ascending: true }).limit(100);
    if (error) return res.status(500).json({ error: error.message });

    // Optionally enrich with user info
    const userIds = data.map(r => r.user_id).filter(Boolean);
    const { data: users } = await supabase.from('users').select('id, name, email, badge').in('id', userIds);
    const usersById = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});

    const enriched = data.map(row => ({
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

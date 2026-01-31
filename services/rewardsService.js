const { supabase } = require('./supabaseClient');

function computeBadge(points) {
  if (points >= 1000) return 'gold';
  if (points >= 500) return 'silver';
  if (points >= 100) return 'bronze';
  return 'none';
}

async function awardReward({ user_id, reward_type = 'points', amount = 0, metadata = {} }) {
  const payload = { user_id, reward_type, amount, metadata };

  // Insert reward row if table exists
  const { data, error } = await supabase.from('rewards').insert([payload]).select('*');

  // Always update user points and badge in application layer to avoid relying on DB trigger
  try {
    const { data: userRow, error: uErr } = await supabase.from('users').select('points').eq('id', user_id).single();
    if (uErr) {
      // If user not found, return inserted reward or error
      if (error) throw error;
      return data ? data[0] : { user_id, reward_type, amount, metadata };
    }

    const currentPoints = (userRow && userRow.points) ? parseInt(userRow.points, 10) : 0;
    const newPoints = currentPoints + (amount || 0);
    const newBadge = computeBadge(newPoints);

    const { error: upErr } = await supabase.from('users').update({ points: newPoints, badge: newBadge }).eq('id', user_id);
    if (upErr) throw upErr;
  } catch (e) {
    // If rewards table insert failed earlier, surface that error
    if (error) throw error;
    throw e;
  }

  return data ? data[0] : { user_id, reward_type, amount, metadata };
}

async function getRewardsForUser(user_id, limit = 50) {
  const { data, error } = await supabase.from('rewards').select('*').eq('user_id', user_id).order('issued_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

module.exports = { awardReward, getRewardsForUser };

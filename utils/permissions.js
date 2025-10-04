const { supabase } = require('../services/supabaseClient');

// Role-only helpers
async function getUserRole(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
  if (error) throw new Error(error.message);
  return data?.role || null;
}

module.exports = { getUserRole };




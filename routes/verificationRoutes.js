const express = require('express');
const router = express.Router();
const { getUserRole } = require('../utils/permissions');
const { supabase } = require('../services/supabaseClient');

// Get all roles
router.get('/roles', async (req, res) => {
  try {
    const { data, error } = await supabase.from('roles').select('*');
    if (error) throw error;
    res.json({ roles: data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch roles', detail: e.message });
  }
});

// Create new role
router.post('/roles', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name required' });

    const { data, error } = await supabase
      .from('roles')
      .insert([{ name }])
      .select()
      .single();

    if (error) throw error;
    res.json({ role: data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create role', detail: e.message });
  }
});

// Update role name
router.put('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name required' });

    const { data, error } = await supabase
      .from('roles')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ role: data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update role', detail: e.message });
  }
});

// Delete role
router.delete('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete role', detail: e.message });
  }
});

// -----------------------------
// 🔹 Role assignments
// -----------------------------

// Get current user's role
router.get('/role', async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Unauthorized' });

    const role = await getUserRole(user.id);
    res.json({ role });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch role', detail: e.message });
  }
});

// Assign role to user
router.post('/roles/:userId/:role', async (req, res) => {
  try {
    const { userId, role } = req.params;

    // Validate role exists
    const { data: roleRow } = await supabase
      .from('roles')
      .select('id')
      .eq('name', role)
      .single();

    if (!roleRow) return res.status(400).json({ error: 'Invalid role' });

    const { error } = await supabase.from('users').update({ role }).eq('id', userId);
    if (error) throw error;

    res.json({ user_id: userId, role });
  } catch (e) {
    res.status(500).json({ error: 'Failed to assign role', detail: e.message });
  }
});

// Remove role (reset to visitor)
router.delete('/roles/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { error } = await supabase.from('users').update({ role: 'visitor' }).eq('id', userId);
    if (error) throw error;

    res.json({ user_id: userId, role: 'visitor' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove role', detail: e.message });
  }
});
const verification = require('../controllers/verificationController');

router.post('/start', verification.startVerification);
router.post('/confirm', verification.confirmVerification);

module.exports = router;

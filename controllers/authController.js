const bcrypt = require('bcrypt');
const generateToken = require('../utils/generateToken');
const { triggerTrap } = require('../traps/magicLoginTrap');
const { supabase } = require('../services/supabaseClient');

exports.signup = async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    // Check if user exists
    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Insert user (remove .single() here)
    const role = req.body.role || 'visitor';
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hash, phone, last_active: new Date(), role }])
      .select('id, name, email, role'); // return role

    if (error) {
      console.error('Signup insert error:', error);
      return res.status(500).json({ error: 'Signup failed', details: error.message });
    }

    res.status(201).json({ message: 'User created', user: data });
  } catch (err) {
    console.error('Signup exception:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    // Update last_active
    await supabase.from('users').update({ last_active: new Date() }).eq('email', email);
  // Attach minimal auth context (simulate session) for downstream middleware
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.sendMagic = async (req, res) => {
  const { email } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    if (!user) return res.status(400).json({ error: 'User not found' });
    const token = generateToken(24);
    const expires = new Date(Date.now() + 1000 * 60 * 15);
    await supabase
      .from('users')
      .update({ magic_token: token, magic_token_expires: expires })
      .eq('email', email);
    res.json({ magicLink: `/auth/magic/${token}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate magic link' });
  }
};

exports.magicLogin = async (req, res) => {
  const { token } = req.params;
  try {
    const now = new Date().toISOString();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('magic_token', token)
      .gt('magic_token_expires', now)
      .single();
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    await supabase
      .from('users')
      .update({
        last_active: new Date(),
        magic_token: null,
        magic_token_expires: null,
      })
      .eq('id', user.id);
    await triggerTrap(user.email, 'magic-login');
    res.json({ message: 'Magic login successful', user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Magic login failed' });
  }
};

exports.deleteInactive = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    const { data, error } = await supabase
      .from('users')
      .delete()
      .lt('last_active', cutoff);
    res.json({ deleted: data ? data.length : 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete inactive users' });
  }
};

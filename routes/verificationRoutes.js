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

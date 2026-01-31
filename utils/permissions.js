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

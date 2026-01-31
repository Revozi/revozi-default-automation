/**
 * PostgreSQL Database Service
 * 
 * Replaces Supabase client with direct PostgreSQL connection.
 * Uses the 'automation' schema to avoid table collisions with Crimson UI-Backend.
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database connection configuration
const config = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
};

// Create connection pool
const pool = new Pool(config);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('[Database] Unexpected error on idle client', err);
});

// Test connection on startup
(async () => {
  try {
    const client = await pool.connect();
    
    // Set search_path to automation schema
    await client.query('SET search_path TO automation, public');
    
    // Test query
    const result = await client.query('SELECT NOW() as now, current_schema() as schema');
    logger.info('[Database] Connection established successfully');
    logger.info(`[Database] Current schema: ${result.rows[0].schema}`);
    logger.info(`[Database] Server time: ${result.rows[0].now}`);
    
    client.release();
  } catch (err) {
    logger.error('[Database] Failed to connect:', err.message);
    logger.error('[Database] Make sure DATABASE_URL is set and PostgreSQL is running on port 5432');
  }
})();

/**
 * Execute a SQL query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters (parameterized queries prevent SQL injection)
 * @returns {Promise<Object>} - Query result with rows array
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[Database Query]', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    logger.error('[Database Query Error]', {
      text: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to call client.release() when done!
 * @returns {Promise<PoolClient>}
 */
async function getClient() {
  const client = await pool.connect();
  // Set search_path for this client
  await client.query('SET search_path TO automation, public');
  return client;
}

/**
 * Execute a function within a transaction
 * Automatically handles commit/rollback and client release
 * @param {Function} callback - Async function that receives the client
 * @returns {Promise<any>} - Result from callback
 */
async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Helper: SELECT query with filters
 * @param {string} table - Table name
 * @param {Object} filters - WHERE conditions (e.g., { email: 'test@example.com' })
 * @param {Object} options - Query options (select, orderBy, limit)
 * @returns {Promise<Array>} - Array of rows
 */
async function select(table, filters = {}, options = {}) {
  const { select: selectFields = '*', orderBy, limit, offset } = options;
  
  let sql = `SELECT ${selectFields} FROM automation.${table}`;
  const params = [];
  const conditions = [];
  
  // Build WHERE clause
  let paramIndex = 1;
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      conditions.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  // ORDER BY
  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }
  
  // LIMIT
  if (limit) {
    sql += ` LIMIT ${parseInt(limit)}`;
  }
  
  // OFFSET
  if (offset) {
    sql += ` OFFSET ${parseInt(offset)}`;
  }
  
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Helper: INSERT query
 * @param {string} table - Table name
 * @param {Object} data - Data to insert
 * @param {string} returning - Columns to return (default: 'id')
 * @returns {Promise<Object>} - Inserted row
 */
async function insert(table, data, returning = 'id') {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  
  const sql = `
    INSERT INTO automation.${table} (${keys.join(', ')})
    VALUES (${placeholders})
    RETURNING ${returning}
  `;
  
  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Helper: UPDATE query
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {Object} filters - WHERE conditions
 * @returns {Promise<number>} - Number of affected rows
 */
async function update(table, data, filters) {
  const dataKeys = Object.keys(data);
  const dataValues = Object.values(data);
  
  const filterKeys = Object.keys(filters);
  const filterValues = Object.values(filters);
  
  let paramIndex = 1;
  const setClause = dataKeys.map(key => `${key} = $${paramIndex++}`).join(', ');
  const whereClause = filterKeys.map(key => `${key} = $${paramIndex++}`).join(' AND ');
  
  const sql = `
    UPDATE automation.${table}
    SET ${setClause}
    WHERE ${whereClause}
  `;
  
  const result = await query(sql, [...dataValues, ...filterValues]);
  return result.rowCount;
}

/**
 * Helper: DELETE query
 * @param {string} table - Table name
 * @param {Object} filters - WHERE conditions
 * @returns {Promise<number>} - Number of deleted rows
 */
async function del(table, filters) {
  const keys = Object.keys(filters);
  const values = Object.values(filters);
  const conditions = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  
  const sql = `DELETE FROM automation.${table} WHERE ${conditions}`;
  const result = await query(sql, values);
  return result.rowCount;
}

/**
 * Helper: UPSERT query (INSERT ... ON CONFLICT DO UPDATE)
 * @param {string} table - Table name
 * @param {Object} data - Data to insert/update
 * @param {Array<string>} conflictColumns - Columns to check for conflicts
 * @param {string} returning - Columns to return
 * @returns {Promise<Object>} - Inserted/updated row
 */
async function upsert(table, data, conflictColumns, returning = '*') {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  
  const updateKeys = keys.filter(k => !conflictColumns.includes(k));
  const updateClause = updateKeys.map(key => `${key} = EXCLUDED.${key}`).join(', ');
  
  const sql = `
    INSERT INTO automation.${table} (${keys.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${conflictColumns.join(', ')})
    DO UPDATE SET ${updateClause}
    RETURNING ${returning}
  `;
  
  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Close all connections in the pool
 * Call this on application shutdown
 */
async function close() {
  await pool.end();
  logger.info('[Database] Connection pool closed');
}

module.exports = {
  query,
  getClient,
  transaction,
  select,
  insert,
  update,
  delete: del,
  upsert,
  close,
  pool // Export pool for advanced use cases
};

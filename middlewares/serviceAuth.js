/**
 * Service Authentication Middleware
 * 
 * Validates requests from Crimson Gateway (Port 4000) to Automation Worker (Port 5100).
 * 
 * Required Headers:
 * - x-service-key: Shared secret between Gateway and Worker
 * - x-user-id: User ID passed from Gateway (authenticated by Gateway's JWT)
 * 
 * Security:
 * - Uses constant-time comparison to prevent timing attacks
 * - Rejects requests without valid service key
 * - Extracts user context from headers
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings match
 */
function timingSafeEqual(a, b) {
  if (!a || !b) return false;
  
  // Convert strings to buffers for comparison
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  // If lengths don't match, still compare to prevent timing attacks
  if (bufA.length !== bufB.length) {
    // Compare against dummy buffer to maintain constant time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    return false;
  }
}

/**
 * Service Authentication Middleware
 * 
 * Validates x-service-key and extracts x-user-id from headers.
 * Sets req.user = { id: userId } for downstream route handlers.
 */
function serviceAuth(req, res, next) {
  const serviceKey = req.headers['x-service-key'];
  const userId = req.headers['x-user-id'];
  
  // Get expected service key from environment
  const expectedKey = process.env.SERVICE_KEY;
  
  if (!expectedKey) {
    logger.error('[ServiceAuth] SERVICE_KEY not configured in .env');
    return res.status(500).json({ 
      error: 'Service authentication not configured' 
    });
  }
  
  // Validate service key with constant-time comparison
  if (!serviceKey || !timingSafeEqual(serviceKey, expectedKey)) {
    logger.warn('[ServiceAuth] Invalid or missing x-service-key header', {
      ip: req.ip,
      path: req.path,
      hasKey: !!serviceKey
    });
    return res.status(401).json({ 
      error: 'Unauthorized: Invalid service credentials' 
    });
  }
  
  // Validate user ID is present
  if (!userId) {
    logger.warn('[ServiceAuth] Missing x-user-id header', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({ 
      error: 'Unauthorized: User context required' 
    });
  }
  
  // Set user context for downstream handlers
  req.user = { 
    id: userId,
    source: 'gateway' // Mark that this came from Gateway, not direct auth
  };
  
  // Log successful authentication (debug only)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('[ServiceAuth] Request authenticated', {
      userId: userId,
      path: req.path,
      method: req.method
    });
  }
  
  next();
}

/**
 * Optional: Public routes middleware
 * For routes that don't require authentication (like /health, /leaderboard)
 */
function publicRoute(req, res, next) {
  // Simply pass through without authentication
  next();
}

module.exports = {
  serviceAuth,
  publicRoute,
  timingSafeEqual // Export for testing
};

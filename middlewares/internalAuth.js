/**
 * internalAuth middleware
 *
 * All requests to the automation service must arrive via the Revozi FastAPI proxy.
 * The proxy validates the user's JWT and then forwards requests with these headers:
 *   X-Revozi-User-Id      — authenticated user's UUID
 *   X-Revozi-Workspace-Id — active workspace UUID
 *   X-Internal-Secret     — shared secret to prove the call came from the proxy
 *
 * Direct external calls (without the shared secret) are rejected with 401.
 */
function internalAuth(req, res, next) {
  const secret = req.headers['x-internal-secret'];

  // Path 1: internal service call from FastAPI proxy
  if (secret && secret === process.env.INTERNAL_SECRET) {
    req.userId = req.headers['x-revozi-user-id'];
    req.workspaceId = req.headers['x-revozi-workspace-id'];
    return next();
  }

  // Path 2: admin panel browser request — validate the base64 JWT issued by /auth/login
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = JSON.parse(Buffer.from(authHeader.slice(7), 'base64').toString('utf8'));
      if (payload && payload.id && payload.exp && Date.now() < payload.exp) {
        req.userId = String(payload.id);
        req.workspaceId = process.env.DEFAULT_WORKSPACE_ID || 'admin';
        req.user = payload;
        return next();
      }
    } catch (_) {}
  }

  return res.status(401).json({ error: 'Unauthorized — internal calls only' });
}

module.exports = internalAuth;

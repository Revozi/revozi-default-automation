const logger = require('./logger');

/**
 * Load credentials for a provider.
 * Supports either:
 * - Single-value env vars (e.g., FACEBOOK_PAGE_ID & FB_ACCESS_TOKEN)
 * - JSON array env var (e.g., FACEBOOK_CREDENTIALS='[{"pageId":"...","accessToken":"..."}]')
 * - Numbered env vars (FACEBOOK_PAGE_ID_1, FACEBOOK_ACCESS_TOKEN_1, FACEBOOK_PAGE_ID_2...)
 *
 * Returns an array of credential objects.
 */
function loadProviderCredentials(prefix, keys = ['pageId', 'accessToken']) {
  const jsonEnv = process.env[`${prefix.toUpperCase()}_CREDENTIALS`];
  if (jsonEnv) {
    try {
      const parsed = JSON.parse(jsonEnv);
      if (Array.isArray(parsed)) return parsed;
      logger.warn(`[credentials] ${prefix}_CREDENTIALS is not an array`);
    } catch (err) {
      logger.error(`[credentials] Failed to parse ${prefix}_CREDENTIALS JSON: ${err.message}`);
    }
  }

  // Try numbered env vars
  const creds = [];
  for (let i = 1; i <= 10; i++) {
    const obj = {};
    let found = false;
    for (const key of keys) {
      const envName = `${prefix.toUpperCase()}_${key.toUpperCase()}_${i}`;
      if (process.env[envName]) {
        obj[key] = process.env[envName];
        found = true;
      }
    }
    if (found) creds.push(obj);
  }

  if (creds.length) return creds;

  // Fallback to single env vars
  const single = {};
  let singleFound = false;
  for (const key of keys) {
    const envName = `${prefix.toUpperCase()}_${key.toUpperCase()}`;
    if (process.env[envName]) {
      single[key] = process.env[envName];
      singleFound = true;
    }
  }
  if (singleFound) return [single];

  return [];
}

module.exports = {
  loadProviderCredentials
};

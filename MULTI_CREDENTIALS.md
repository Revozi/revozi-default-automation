
# Multi-Credentials Guide

Comprehensive, polished guide for configuring and using multi-credential support in this project. It explains the flexible credential formats, how bots consume credentials, rate-limiting, security, recommended practices, and integration patterns for UI and API.

Table of contents
-----------------
- Quick start
- Supported credential formats
- Examples (copy/paste)
- Provider-specific notes
- How bots behave with multiple credentials
- Rate limiting and backoff
- Admin/UI and API integration
- Security and secrets management
- Testing and local development
- Troubleshooting
- Extending and unit tests

Quick start
-----------
1. Choose a credential format (JSON array recommended).
2. Add credentials to your environment or secret manager using the examples below.
3. Tune rate limiting with `MULTI_POST_CONCURRENCY` and `MULTI_POST_DELAY_MS` if needed.
4. Run the built-in smoke tests or start the bots.

Supported credential formats (priority)
------------------------------------
The loader in `utils/credentials.js` supports three patterns (checked in this order):

1) JSON array env var (recommended)

  - Env var: `<PREFIX>_CREDENTIALS`
  - Value: a JSON array of credential objects

  Example (Facebook):

  ```bash
  export FACEBOOK_CREDENTIALS='[{"pageId":"123456","accessToken":"EAA..."},{"pageId":"234567","accessToken":"EAA..."}]'
  ```

2) Numbered env vars (legacy-friendly)

  - Pattern: `<PREFIX>_<KEY>_N` where N is 1..10
  - Example (Facebook):

  ```bash
  export FACEBOOK_PAGE_ID_1=123456
  export FACEBOOK_ACCESS_TOKEN_1=EAA...
  export FACEBOOK_PAGE_ID_2=234567
  export FACEBOOK_ACCESS_TOKEN_2=EAA...
  ```

3) Single legacy env vars (fallback)

  - Example (Facebook):

  ```bash
  export FACEBOOK_PAGE_ID=123456
  export FACEBOOK_PAGE_ACCESS_TOKEN=EAA...
  ```

Provider-specific examples and keys
----------------------------------
The loader accepts a `keys` parameter, so providers can request different key names. The repository uses the following conventions:

- Facebook (Pages): `pageId`, `accessToken`
- Twitter: `user_id`, `bearer_token`
- Telegram: `bot_token`, `chat_id`
- Instagram (IG Business): use Facebook credentials (optionally include an `igBusinessId` key)
- Google My Business (GMB): `locationId`, `accessToken`

Provider examples (copy/paste)
-----------------------------

Facebook (JSON):

```bash
FACEBOOK_CREDENTIALS='[
  {"pageId":"1234567890","accessToken":"EAA..."},
  {"pageId":"2345678901","accessToken":"EAA..."}
]'
```

Twitter (numbered):

```bash
TWITTER_USER_ID_1=111111
TWITTER_BEARER_TOKEN_1=AAAA...
TWITTER_USER_ID_2=222222
TWITTER_BEARER_TOKEN_2=BBBB...
```

Telegram (single):

```bash
TELEGRAM_BOT_TOKEN=123456:ABCDEF
TELEGRAM_CHAT_ID=987654321
```

GMB (JSON):

```bash
GMB_CREDENTIALS='[{"locationId":"accounts/123","accessToken":"ya29..."}]'
```

How bots use credentials
------------------------
- Each bot calls `loadProviderCredentials(prefix, keys)` and receives an array of credential objects.
- Bots iterate that array and perform the publish/notification actions for each credential.
- Bots log per-account actions to Supabase (`engagements`) with account metadata for auditing.

Rate limiting & pacing
----------------------
To avoid API bursts and quota problems, bots use `utils/rateLimiter.js` (`runWithRateLimit`).

Global environment variables (defaults provided in code):

- `MULTI_POST_CONCURRENCY` — number of concurrent workers (default: `1`).
- `MULTI_POST_DELAY_MS` — delay (ms) inserted between work items (default: `500`).

Example usage inside a bot:

```javascript
const { runWithRateLimit } = require('../utils/rateLimiter');
await runWithRateLimit(accounts, async (acc) => {
  await postToAccount(acc);
}, { concurrency: 1, delayMs: 800 });
```



Server pseudocode:

```javascript
const accounts = accountIds?.length ? credentials.filter(c => accountIds.includes(c.pageId)) : credentials;
await runWithRateLimit(accounts, postToAccount, { concurrency, delayMs });
```

Security & secrets management
----------------------------
- Never commit `.env` to version control. Add it to `.gitignore`.
- Prefer secret managers (AWS Secrets Manager, GCP Secret Manager, Vault).
- Use least-privilege tokens and rotate regularly.
- Record all publish and error events to your audit logs (Supabase `engagements` table).

Testing & local development
---------------------------
The repository includes mock-safe modules for development without real credentials.

Quick checks (no network required for mocks):

```bash
# Language smoke test
node scripts/smoke-lang.js

# Dispatcher check
node scripts/run-dispatcher-check.js

# Lightweight tests
node tests/run-multi-lang-node.js
```

To test actual posting, create test accounts/pages and place credentials in a local `.env` (excluded from Git):

```bash
FACEBOOK_CREDENTIALS='[{"pageId":"123-test","accessToken":"EAA-test"}]'
TWITTER_CREDENTIALS='[{"user_id":"test","bearer_token":"AAA-test"}]'
TELEGRAM_CREDENTIALS='[{"bot_token":"111:BBB","chat_id":"999"}]'
MULTI_POST_DELAY_MS=1000
MULTI_POST_CONCURRENCY=1
```

Troubleshooting
---------------
- If all accounts fail: check network, check global rate limits, inspect `engagements` logs in Supabase.
- If some accounts fail: verify tokens, check permission scopes, test those accounts individually.
- If you see many 429s: increase `MULTI_POST_DELAY_MS` and reduce `MULTI_POST_CONCURRENCY`; add exponential backoff for transient errors.

Extending the loader
--------------------
To add new provider-specific keys:

```javascript
const creds = loadProviderCredentials('MYPROVIDER', ['clientId','clientSecret']);
```

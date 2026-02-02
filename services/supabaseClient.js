const { createClient } = require('@supabase/supabase-js');

// Load credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  // Create a real Supabase client when credentials are provided
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Optionally, test connectivity (best-effort)
  (async () => {
    try {
      const { error } = await supabase.from('users').select('*').limit(1);
      if (error) {
        console.error('[Supabase]  Failed test query:', error.message);
      } else {
        console.log('[Supabase]  Test query succeeded.');
      }
    } catch (err) {
      console.error('[Supabase]  Exception during test query:', err.message);
    }
  })();

} else {
  // Export a lightweight mock/stub so requiring this module doesn't throw
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Exporting mock supabase client with in-memory storage.');

  // Pre-hashed password for "admin123" using bcrypt (10 rounds)
  const ADMIN_PASSWORD_HASH = '$2b$10$3ftwasXkUgINlvbLRDBCwe0xe6y0KLvWiLhPnss2GAmBGC4VkjCrm';

  // In-memory storage for testing with hardcoded admin user
  const mockDb = {
    users: [
      {
        id: 'admin-user-001',
        name: 'Admin User',
        email: 'admin@test.com',
        password: ADMIN_PASSWORD_HASH,
        phone: '1234567890',
        role: 'admin',
        active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        last_active: new Date().toISOString(),
        notified: false,
        reminders_sent: 0
      }
    ],
    post_queue: [],
    engagements: [],
    blogs: [],
    rewards: [],
    notifications: [],
    leaderboard: [],
    bot_status: [],
    logs: []
  };

  const chainable = (tableName) => {
    let insertData = null;
    let updateData = null;
    let filters = [];

    const applyFilters = (items) => {
      let result = [...items];
      for (const f of filters) {
        if (f.type === 'eq') {
          result = result.filter(item => item[f.column] === f.value);
        }
      }
      return result;
    };

    const builder = {
      eq: (col, val) => { filters.push({ type: 'eq', column: col, value: val }); return builder; },
      neq: (col, val) => { filters.push({ type: 'neq', column: col, value: val }); return builder; },
      gt: (col, val) => { filters.push({ type: 'gt', column: col, value: val }); return builder; },
      gte: (col, val) => builder,
      lt: (col, val) => builder,
      lte: (col, val) => builder,
      is: (col, val) => builder,
      in: (col, val) => builder,
      like: (col, val) => builder,
      ilike: (col, val) => builder,
      not: () => builder,
      or: () => builder,
      and: () => builder,
      filter: () => builder,
      match: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      single: async () => {
        const table = mockDb[tableName] || [];
        const results = applyFilters(table);
        return { data: results[0] || null, error: null };
      },
      maybeSingle: async () => {
        const table = mockDb[tableName] || [];
        const results = applyFilters(table);
        return { data: results[0] || null, error: null };
      },
      select: (cols) => builder,
      then: (resolve) => {
        const table = mockDb[tableName] || [];
        const results = applyFilters(table);
        resolve({ data: results, error: null });
      }
    };

    return {
      select: (cols) => builder,
      insert: (data) => {
        insertData = Array.isArray(data) ? data : [data];
        return {
          select: (cols) => ({
            then: (resolve) => {
              if (!mockDb[tableName]) mockDb[tableName] = [];
              const inserted = insertData.map(item => ({
                id: 'mock-' + Math.random().toString(36).substr(2, 9),
                ...item,
                created_at: new Date().toISOString()
              }));
              mockDb[tableName].push(...inserted);
              resolve({ data: inserted, error: null });
            },
            single: async () => {
              if (!mockDb[tableName]) mockDb[tableName] = [];
              const item = {
                id: 'mock-' + Math.random().toString(36).substr(2, 9),
                ...insertData[0],
                created_at: new Date().toISOString()
              };
              mockDb[tableName].push(item);
              return { data: item, error: null };
            }
          }),
          then: (resolve) => {
            if (!mockDb[tableName]) mockDb[tableName] = [];
            const inserted = insertData.map(item => ({
              id: 'mock-' + Math.random().toString(36).substr(2, 9),
              ...item,
              created_at: new Date().toISOString()
            }));
            mockDb[tableName].push(...inserted);
            resolve({ data: inserted, error: null });
          }
        };
      },
      update: (data) => {
        updateData = data;
        return builder;
      },
      delete: () => builder,
      upsert: (data) => {
        if (!mockDb[tableName]) mockDb[tableName] = [];
        const items = Array.isArray(data) ? data : [data];
        items.forEach(item => {
          const idx = mockDb[tableName].findIndex(x => x.id === item.id);
          if (idx >= 0) mockDb[tableName][idx] = { ...mockDb[tableName][idx], ...item };
          else mockDb[tableName].push({ id: 'mock-' + Math.random().toString(36).substr(2, 9), ...item });
        });
        return { then: (resolve) => resolve({ data: items, error: null }) };
      }
    };
  };

  supabase = {
    from: (tableName) => chainable(tableName),
    rpc: async () => ({ data: null, error: null }),
    auth: { user: () => null }
  };
}

module.exports = { supabase };

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
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Exporting mock supabase client.');

  const chainable = () => ({
    // A single chainable query builder that supports common methods
    select: (..._args) => queryBuilder(),
    insert: (..._args) => queryBuilder(),
    update: (..._args) => queryBuilder(),
    delete: (..._args) => queryBuilder()
  });

  // Query builder used for select/insert/update/delete chains
  const queryBuilder = () => {
    const builder = {
      eq: () => builder,
      lte: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: null }),
      // Allow awaiting the builder: resolve to { data: [] }
      then: (resolve) => resolve({ data: [] }),
      // Support insert on builder
      insert: () => ({ then: (resolve) => resolve({ data: null }) }),
      // Support .select() being called on builder as well
      select: () => builder
    };
    return builder;
  };

  supabase = {
    from: () => chainable(),
    rpc: async () => ({ data: null, error: null }),
    // basic placeholders to prevent undefined errors in tests
    auth: {
      user: () => null
    }
  };
}

module.exports = { supabase };

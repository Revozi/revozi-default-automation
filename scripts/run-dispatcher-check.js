const dispatcher = require('../cron/dispatcher');
const { supabase } = require('../services/supabaseClient');

(async () => {
  console.log('Running quick dispatcher check...');
  try {
    // mimic the cron callback: call the exported function which schedules the cron, but we need to
    // instead directly run the core logic: simplest is to copy the internal logic here to test behaviour.
    const now = new Date().toISOString();
    const { data: posts } = await supabase
      .from('post_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('priority', { ascending: false });

    console.log('posts value:', posts);
    if (Array.isArray(posts)) {
      console.log('posts is iterable with length', posts.length);
    } else {
      console.error('posts is not iterable', posts);
    }
  } catch (err) {
    console.error('Dispatcher check error:', err);
  }
})();
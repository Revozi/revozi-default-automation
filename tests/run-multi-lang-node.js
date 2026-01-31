const assert = require('assert');
const { generateCaption, generateBlogContent } = require('../services/aiService');
const { translateText } = require('../utils/translate');
const { supabase } = require('../services/supabaseClient');

async function run() {
  console.log('Running lightweight multi-lang tests...');

  // translateText: should translate to Spanish
  const t1 = await translateText('Hello world', 'es');
  assert.strictEqual(t1, 'Hola mundo', 'translateText should return Hola mundo for es');

  // translateText: same language returns original
  const t2 = await translateText('Hello world', 'en', 'en');
  assert.strictEqual(t2, 'Hello world');

  // generateCaption: cache miss path
  // Ensure supabase returns no cached data and supports insert
  supabase.from = () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null })
          })
        })
      })
    }),
    insert: async () => ({ data: null })
  });

  const cap = await generateCaption({ prompt: 'sunset at beach', platform: 'instagram', languages: ['en', 'es', 'hi'], geo: 'IN' });
  assert.ok(cap.captions, 'captions present');
  assert.ok(cap.transcripts, 'transcripts present');
  assert.ok(cap.extras && cap.extras.geoAware, 'geoAware present');
  assert.ok(cap.captions.en, 'en caption present');
  assert.ok(cap.captions.es, 'es caption present');
  assert.ok(cap.captions.hi, 'hi caption present');
  assert.ok(cap.extras.geoAware.en.includes('🇮🇳'));
  assert.ok(cap.extras.geoAware.hi.includes('भारत'));

  // generateCaption: cache hit path
  const mockEnglishCaption = "Amazing sunset view!";
  const mockSpanishCaption = "¡Vista increíble del atardecer!";
  const mockHindiCaption = "आश्चर्यजनक सूर्यास्त का दृश्य!";

  const mockCacheData = { captions: { en: mockEnglishCaption, es: mockSpanishCaption, hi: mockHindiCaption } };

  supabase.from = () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: { output: mockCacheData } })
          })
        })
      })
    })
  });

  // ensure insert available for caching path
  supabase.from = () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: { output: mockCacheData } })
          })
        })
      })
    }),
    insert: async () => ({ data: null })
  });

  const cap2 = await generateCaption({ prompt: 'sunset at beach', platform: 'instagram', languages: ['en', 'es', 'hi'], geo: 'US' });
  assert.strictEqual(cap2.captions.en, mockEnglishCaption);
  assert.strictEqual(cap2.captions.es, mockSpanishCaption);
  assert.strictEqual(cap2.captions.hi, mockHindiCaption);

  // generateBlogContent: basic generation
  supabase.from = () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null })
          })
        })
      })
    })
  });
  // ensure insert available for caching
  supabase.from = () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null })
          })
        })
      })
    }),
    insert: async () => ({ data: null })
  });

  const blog = await generateBlogContent({ title: 'Beautiful Sunset', prompt: 'Write about watching the sunset', languages: ['en', 'es', 'hi'], geo: 'MX', tags: ['nature','sunset'] });
  assert.ok(blog.metadata, 'blog metadata present');
  ['title','description','content_markdown','content_html'].forEach(field => {
    assert.ok(blog.metadata[field] && blog.metadata[field].en, `${field} en present`);
    assert.ok(blog.metadata[field] && blog.metadata[field].es, `${field} es present`);
    assert.ok(blog.metadata[field] && blog.metadata[field].hi, `${field} hi present`);
  });
  assert.ok(blog.extras.geoAware.es.includes('🇲🇽'));

  // generateBlogContent: missing languages defaults
  const blog2 = await generateBlogContent({ title: 'Beautiful Sunset', prompt: 'Write about watching the sunset' });
  assert.ok(blog2.metadata.title.en, 'default en title present');
  assert.ok(blog2.extras.geoAware.en, 'default en geoAware present');

  console.log('All lightweight tests passed.');
}

run().catch(err => {
  console.error('Test runner failed:', err);
  process.exitCode = 1;
});
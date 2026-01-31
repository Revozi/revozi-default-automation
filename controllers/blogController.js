const { supabase } = require('../services/supabaseClient');
const logger = require('../utils/logger');
const { publishPendingBlogs } = require('../blog/blogScheduler');
const {generateImageFromPrompt} = require('../services/replicateService');
const { generateBlogContent, markdownToHtml } = require('../services/aiService');


// Create new blog
exports.createBlog = async (req, res) => {
  let {
    title,
    slug,
    tags,
    content_markdown,
    content_html,
    image_prompts,
    image_urls,
    force_generate
  } = req.body;

  if (!title || !slug) {
    return res.status(400).json({ error: 'Missing required fields: title, slug' });
  }

  try {
    // 🔹 (1) Generate blog content if missing OR force_generate is true
    if (!content_markdown || force_generate) {
      const blogPrompt = `Write a detailed, SEO-optimized blog post titled: "${title}"`;
      content_markdown = await generateBlogContent(blogPrompt);
    }

    // 🔹 (2) Generate HTML if missing OR force_generate is true
    if (!content_html || force_generate) {
      content_html = await markdownToHtml(content_markdown);
    }

    // 🔹 (3) Generate images if image_prompts is provided & image_urls missing or empty
    if (image_prompts && (!image_urls || image_urls.length === 0)) {
      if (Array.isArray(image_prompts)) {
        const generatedImages = [];
        for (const prompt of image_prompts) {
          const image = await generateImageFromPrompt(prompt);
          if (image) generatedImages.push(image);
        }
        image_urls = generatedImages;
      } else if (typeof image_prompts === 'string') {
        const image = await generateImageFromPrompt(image_prompts);
        image_urls = image ? [image] : [];
      }
    }

    // 🔹 (4) Save blog to Supabase
    const { error } = await supabase.from('blogs').insert({
      title,
      slug,
      tags,
      content_markdown,
      content_html,
      image_prompts,
      image_urls,
    });

    if (error) throw error;

    res.status(201).json({
      message: 'Blog created successfully',
      image_urls,
      markdown_length: content_markdown?.length,
      html_length: content_html?.length,
    });

  } catch (err) {
    logger.error(`[CREATE_BLOG] ${err.message}`);
    res.status(500).json({
      error: 'Failed to create blog',
      detail: err.message
    });
  }
};


// Get all blogs
exports.getAllBlogs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error(`[GET_BLOGS] ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
};

// Get a single blog by ID
exports.getBlogById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error(`[GET_BLOG_BY_ID] ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch blog' });
  }
};

// Update blog by ID
exports.updateBlog = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { error } = await supabase.from('blogs').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ message: 'Blog updated successfully' });
  } catch (err) {
    logger.error(`[UPDATE_BLOG] ${err.message}`);
    res.status(500).json({ error: 'Failed to update blog' });
  }
};

// Delete blog by ID
exports.deleteBlog = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('blogs').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Blog deleted successfully' });
  } catch (err) {
    logger.error(`[DELETE_BLOG] ${err.message}`);
    res.status(500).json({ error: 'Failed to delete blog' });
  }
};

// POST /blog/publish-now
exports.publishNow = async (req, res) => {
  try {
    await publishPendingBlogs();
    res.json({ message: 'Blog publishing job triggered manually' });
  } catch (err) {
    logger.error(`[BLOG_MANUAL_TRIGGER] ${err.stack}`);
    res.status(500).json({ error: 'Manual blog publish failed', detail: err.message });
  }
};


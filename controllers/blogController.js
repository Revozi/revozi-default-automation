const db = require('../services/db');
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

    // 🔹 (4) Save blog to database
    await db.insert('blogs', {
      title,
      slug,
      tags,
      content_markdown,
      content_html,
      image_prompts: JSON.stringify(image_prompts),
      image_urls,
    });

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
    const result = await db.query(
      `SELECT * FROM automation.blogs ORDER BY created_at DESC`
    );

    // Parse JSON fields if needed
    const blogs = result.rows.map(blog => ({
      ...blog,
      image_prompts: typeof blog.image_prompts === 'string' 
        ? JSON.parse(blog.image_prompts) 
        : blog.image_prompts
    }));

    res.json(blogs);
  } catch (err) {
    logger.error(`[GET_BLOGS] ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
};

// Get a single blog by ID
exports.getBlogById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM automation.blogs WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const blog = result.rows[0];
    // Parse JSON fields if needed
    if (typeof blog.image_prompts === 'string') {
      blog.image_prompts = JSON.parse(blog.image_prompts);
    }

    res.json(blog);
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
    // Convert arrays/objects to JSON strings if needed
    if (updates.image_prompts && typeof updates.image_prompts !== 'string') {
      updates.image_prompts = JSON.stringify(updates.image_prompts);
    }

    await db.update('blogs', updates, { id });
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
    await db.delete('blogs', { id });
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


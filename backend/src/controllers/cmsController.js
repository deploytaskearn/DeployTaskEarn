const { z } = require('zod');
const pool = require('../db/pool');

// ───────────── BLOG (public) ─────────────

async function listPublishedPosts(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, title, slug, excerpt, "coverImageUrl", "publishedAt"
       FROM "BlogPost" WHERE "isPublished" = true ORDER BY "publishedAt" DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listPublishedPosts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPostBySlug(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM "BlogPost" WHERE slug = $1 AND "isPublished" = true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getPostBySlug error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── BLOG (admin) ─────────────

const postSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, hyphens'),
  excerpt: z.string().optional(),
  content: z.string().min(2),
  coverImageUrl: z.string().optional(),
  isPublished: z.boolean().default(false),
});

async function adminListPosts(req, res) {
  try {
    const result = await pool.query('SELECT * FROM "BlogPost" ORDER BY "createdAt" DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('adminListPosts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createPost(req, res) {
  try {
    const data = postSchema.parse(req.body);
    const publishedAt = data.isPublished ? new Date() : null;
    const result = await pool.query(
      `INSERT INTO "BlogPost" (id, title, slug, excerpt, content, "coverImageUrl", "isPublished", "publishedAt", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING *`,
      [data.title, data.slug, data.excerpt || null, data.content, data.coverImageUrl || null, data.isPublished, publishedAt]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already in use' });
    console.error('createPost error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updatePost(req, res) {
  try {
    const { id } = req.params;
    const data = postSchema.partial().parse(req.body);
    const fields = Object.keys(data);
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const setClauses = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
    const values = fields.map((f) => data[f]);

    const result = await pool.query(
      `UPDATE "BlogPost" SET ${setClauses}, "updatedAt" = now() WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    console.error('updatePost error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deletePost(req, res) {
  try {
    await pool.query('DELETE FROM "BlogPost" WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('deletePost error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── CONTACT ─────────────

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().optional(),
  message: z.string().min(5),
});

async function submitContactMessage(req, res) {
  try {
    const data = contactSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO "ContactMessage" (id, name, email, subject, message, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now()) RETURNING *`,
      [data.name, data.email, data.subject || null, data.message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    console.error('submitContactMessage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adminListContactMessages(req, res) {
  try {
    const result = await pool.query('SELECT * FROM "ContactMessage" ORDER BY "createdAt" DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('adminListContactMessages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adminMarkContactRead(req, res) {
  try {
    await pool.query('UPDATE "ContactMessage" SET "isRead" = true WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('adminMarkContactRead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── SITE SETTINGS ─────────────

async function getSettings(req, res) {
  try {
    const result = await pool.query('SELECT * FROM "SiteSetting"');
    const settings = {};
    result.rows.forEach((row) => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function bulkUpdateSettings(req, res) {
  try {
    const settings = req.body; // { key: value, ... }
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      return res.status(400).json({ error: 'Body must be an object of key:value pairs' });
    }
    const entries = Object.entries(settings);
    if (entries.length === 0) return res.json({ updated: 0 });
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = now()`,
        [key, String(value)]
      );
    }
    res.json({ updated: entries.length });
  } catch (err) {
    console.error('bulkUpdateSettings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateSetting(req, res) {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });
    const result = await pool.query(
      `INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = now() RETURNING *`,
      [key, value]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateSetting error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── HELP VIDEOS ─────────────

async function listHelpVideos(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, title, description, "videoUrl", "sortOrder" FROM "HelpVideo"
       WHERE "isActive" = true ORDER BY "sortOrder" ASC, "createdAt" ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listHelpVideos error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adminListHelpVideos(req, res) {
  try {
    const result = await pool.query('SELECT * FROM "HelpVideo" ORDER BY "sortOrder" ASC, "createdAt" ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('adminListHelpVideos error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const helpVideoSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  videoUrl: z.string().url(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

async function createHelpVideo(req, res) {
  try {
    const data = helpVideoSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO "HelpVideo" (id, title, description, "videoUrl", "isActive", "sortOrder", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now())
       RETURNING *`,
      [data.title, data.description || null, data.videoUrl, data.isActive, data.sortOrder]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    console.error('createHelpVideo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateHelpVideo(req, res) {
  try {
    const { id } = req.params;
    const data = helpVideoSchema.partial().parse(req.body);
    const fields = Object.keys(data);
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const setClauses = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
    const values = fields.map((f) => data[f]);

    const result = await pool.query(
      `UPDATE "HelpVideo" SET ${setClauses}, "updatedAt" = now() WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    console.error('updateHelpVideo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteHelpVideo(req, res) {
  try {
    await pool.query('DELETE FROM "HelpVideo" WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('deleteHelpVideo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── TASK CATEGORIES ─────────────

async function listCategories(req, res) {
  try {
    const result = await pool.query('SELECT * FROM "TaskCategory" ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('listCategories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createCategory(req, res) {
  try {
    const { name, slug, description, iconUrl } = req.body;
    const result = await pool.query(
      `INSERT INTO "TaskCategory" (id, name, slug, description, "iconUrl", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now()) RETURNING *`,
      [name, slug, description || null, iconUrl || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already in use' });
    console.error('createCategory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  bulkUpdateSettings,
  listPublishedPosts,
  getPostBySlug,
  adminListPosts,
  createPost,
  updatePost,
  deletePost,
  submitContactMessage,
  adminListContactMessages,
  adminMarkContactRead,
  getSettings,
  updateSetting,
  listCategories,
  createCategory,
  listHelpVideos,
  adminListHelpVideos,
  createHelpVideo,
  updateHelpVideo,
  deleteHelpVideo,
};

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const depositRoutes = require('./routes/depositRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const adminRoutes = require('./routes/adminRoutes');
const cmsRoutes = require('./routes/cmsRoutes');
const planRoutes = require('./routes/planRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving uploaded images cross-origin
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Basic rate limiting on auth endpoints to slow down brute force / spam
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use('/api/auth', authLimiter);

// Serve uploaded files (logos, deposit screenshots, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/admin/upload', uploadRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 404 handler for unmatched API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

// Generic error handler (e.g. multer file-size errors)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function runMigrations() {
  if (!process.env.DATABASE_URL) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../prisma/manual_migration.sql'), 'utf8');
    await pool.query(sql);
    console.log('Database migration completed');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('Database tables already exist');
    } else {
      console.error('Migration warning:', err.message);
    }
  }

  // Seed admin user if not exists
  try {
    const existing = await pool.query('SELECT id FROM "User" WHERE email = $1', ['admin@taskearn.local']);
    if (existing.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('Admin@12345', 10);
      const code = 'ADMIN' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const r = await pool.query(
        `INSERT INTO "User" (id, name, email, "passwordHash", role, "referralCode", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), 'Site Admin', 'admin@taskearn.local', $1, 'ADMIN', $2, now(), now()) RETURNING id`,
        [hash, code]
      );
      await pool.query(
        `INSERT INTO "Wallet" (id, "userId", balance, currency, "updatedAt") VALUES (gen_random_uuid(), $1, 0, 'PKR', now())`,
        [r.rows[0].id]
      );
      console.log('Admin user created: admin@taskearn.local / Admin@12345');
    }

    // Seed categories
    const cats = [
      ['Surveys', 'surveys'], ['App Installs', 'app-installs'],
      ['Social Media', 'social-media'], ['Sign-up Offers', 'sign-up-offers'],
    ];
    for (const [name, slug] of cats) {
      await pool.query(
        `INSERT INTO "TaskCategory" (id, name, slug, "createdAt") VALUES (gen_random_uuid(), $1, $2, now()) ON CONFLICT (slug) DO NOTHING`,
        [name, slug]
      );
    }

    // Seed payment methods
    for (const m of ['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER']) {
      await pool.query(
        `INSERT INTO "PaymentMethodConfig" (id, method, "isEnabled", "accountName", "accountNumber", instructions, "updatedAt")
         VALUES (gen_random_uuid(), $1, true, 'Admin Panel mein set karen', 'Admin Panel mein set karen', 'Screenshot upload karen.', now())
         ON CONFLICT (method) DO NOTHING`,
        [m]
      );
    }

    // Seed default site settings
    const defaultSettings = [
      ['site_name', 'TaskEarn'],
      ['site_logo', '/uploads/taskearn-logo-dark.svg'],
    ];
    for (const [k, v] of defaultSettings) {
      await pool.query(
        `INSERT INTO "SiteSetting" (id, key, value, "updatedAt") VALUES (gen_random_uuid(), $1, $2, now()) ON CONFLICT (key) DO NOTHING`,
        [k, v]
      );
    }
    console.log('Seed data ready');
  } catch (err) {
    console.error('Seed warning:', err.message);
  } finally {
    await pool.end();
  }
}

const PORT = process.env.PORT || 4000;
runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend API running on http://localhost:${PORT}`);
  });
});

module.exports = app;

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
  // Run base migration
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../prisma/manual_migration.sql'), 'utf8');
    await pool.query(sql);
    console.log('Base migration completed');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('Base tables already exist, skipping');
    } else {
      console.error('Base migration warning:', err.message);
    }
  }

  // Patch migration — each step is independent
  const patches = [
    `ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'REFERRAL_PLAN_BONUS'`,
    `ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'PLAN_PURCHASE'`,
    `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "planTier" INTEGER NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS "Plan" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      "durationDays" INTEGER NOT NULL DEFAULT 30,
      "maxEarnings" DECIMAL(12,2),
      features JSONB NOT NULL DEFAULT '[]',
      "isPopular" BOOLEAN NOT NULL DEFAULT false,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `DO $$ BEGIN
      CREATE TYPE "UserPlanStatus" AS ENUM ('ACTIVE','EXPIRED','CANCELLED');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `CREATE TABLE IF NOT EXISTS "UserPlan" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES "User"(id),
      "planId" UUID NOT NULL REFERENCES "Plan"(id),
      "amountPaid" DECIMAL(10,2) NOT NULL,
      status "UserPlanStatus" NOT NULL DEFAULT 'ACTIVE',
      "startDate" TIMESTAMP NOT NULL DEFAULT now(),
      "endDate" TIMESTAMP NOT NULL,
      "referralBonusPaid" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "UserPlan_userId_idx" ON "UserPlan" ("userId")`,
    `CREATE INDEX IF NOT EXISTS "UserPlan_planId_idx" ON "UserPlan" ("planId")`,
  ];
  for (const stmt of patches) {
    try {
      await pool.query(stmt);
    } catch (e) {
      console.log('Patch skipped:', e.message.split('\n')[0]);
    }
  }
  console.log('Patch migration completed');

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
        `INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ($1, $2, now()) ON CONFLICT (key) DO NOTHING`,
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

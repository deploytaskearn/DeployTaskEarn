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
const spinRoutes = require('./routes/spinRoutes');

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
app.use('/api/spin', spinRoutes);

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
    `ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER`,
    `ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "currentUsers" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "dailyEarning" DECIMAL(10,2)`,
    `ALTER TABLE "Deposit" ALTER COLUMN "transactionId" DROP NOT NULL`,
    `ALTER TABLE "Deposit" ALTER COLUMN amount TYPE DECIMAL(14,2)`,
    `ALTER TABLE "Withdrawal" ALTER COLUMN amount TYPE DECIMAL(14,2)`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBonusRate" DECIMAL(5,2)`,
    `ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT`,
    `ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "dailyTaskLimit" INTEGER`,
    `CREATE TABLE IF NOT EXISTS "PlanTask" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "planId" UUID NOT NULL REFERENCES "Plan"(id) ON DELETE CASCADE,
      "taskId" UUID NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      UNIQUE("planId","taskId")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserPlan_userId_planId_unique" ON "UserPlan"("userId","planId")`,
    `ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'SPIN_REWARD'`,
    `ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'REDEEM_CODE'`,
    `CREATE TABLE IF NOT EXISTS "SpinSegment" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL,
      "rewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
      weight DECIMAL(6,2) NOT NULL DEFAULT 10,
      color TEXT NOT NULL DEFAULT '#0d2a1a',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "UserSpin" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES "User"(id),
      "segmentId" UUID REFERENCES "SpinSegment"(id),
      "rewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "spunAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "RedeemCode" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      "rewardAmount" DECIMAL(10,2) NOT NULL,
      "maxUses" INTEGER NOT NULL DEFAULT 1,
      "usedCount" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "RedeemCodeUse" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "codeId" UUID NOT NULL REFERENCES "RedeemCode"(id),
      "userId" UUID NOT NULL REFERENCES "User"(id),
      "usedAt" TIMESTAMP NOT NULL DEFAULT now(),
      UNIQUE("codeId","userId")
    )`,
    `CREATE INDEX IF NOT EXISTS "UserSpin_userId_idx" ON "UserSpin"("userId")`,
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

    // Seed 2 default tasks per plan
    try {
      const catRes = await pool.query(`SELECT id FROM "TaskCategory" WHERE slug = 'social-media' LIMIT 1`);
      const catId = catRes.rows[0]?.id || null;

      const defaultTasks = [
        {
          title: 'Follow us on Instagram',
          description: 'Follow our official Instagram account and send a screenshot as proof.',
          instructions: '1. Open Instagram\n2. Search for our account\n3. Follow the account\n4. Take a screenshot and submit as proof',
          rewardAmount: 50,
          externalUrl: null,
        },
        {
          title: 'Share on WhatsApp Status',
          description: 'Share your referral link on your WhatsApp Status and send a screenshot as proof.',
          instructions: '1. Copy your referral link from the dashboard\n2. Open WhatsApp\n3. Post the link on your Status\n4. Take a screenshot and submit as proof',
          rewardAmount: 30,
          externalUrl: null,
        },
        {
          title: 'Download Our App from Play Store',
          description: 'Download and install our app from Google Play Store and send a screenshot as proof.',
          instructions: '1. Click "Open Link" to go to Play Store\n2. Download and install the app\n3. Open the app\n4. Take a screenshot showing the app installed\n5. Submit the screenshot as proof',
          rewardAmount: 80,
          externalUrl: 'https://play.google.com/store',
        },
      ];

      const taskIds = [];
      for (const task of defaultTasks) {
        const existing = await pool.query(`SELECT id FROM "Task" WHERE title = $1 LIMIT 1`, [task.title]);
        let taskId;
        if (existing.rows.length > 0) {
          taskId = existing.rows[0].id;
        } else {
          const r = await pool.query(
            `INSERT INTO "Task" (id, title, description, instructions, "categoryId", source, "externalUrl", "rewardAmount", "requiresProof", "planTier", status, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'MANUAL', $5, $6, true, 0, 'ACTIVE', now(), now()) RETURNING id`,
            [task.title, task.description, task.instructions, catId, task.externalUrl, task.rewardAmount]
          );
          taskId = r.rows[0].id;
        }
        taskIds.push(taskId);
      }

      // Assign both tasks to every plan
      const plansRes = await pool.query(`SELECT id FROM "Plan"`);
      for (const plan of plansRes.rows) {
        for (const taskId of taskIds) {
          await pool.query(
            `INSERT INTO "PlanTask" ("planId","taskId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [plan.id, taskId]
          );
        }
      }
      console.log('Default tasks seeded and assigned to all plans');
    } catch (err) {
      console.error('Task seed warning:', err.message);
    }

    // Seed default spin segments (only if none exist)
    try {
      const existing = await pool.query(`SELECT COUNT(*) FROM "SpinSegment"`);
      if (parseInt(existing.rows[0].count) === 0) {
        const defaultSegments = [
          { label: 'Better Luck', rewardAmount: 0, weight: 33, color: '#071b10', sortOrder: 0 },
          { label: 'Rs 10',       rewardAmount: 10, weight: 22, color: '#0d2a1a', sortOrder: 1 },
          { label: 'Try Again',   rewardAmount: 0,  weight: 22, color: '#071b10', sortOrder: 2 },
          { label: 'Rs 25',       rewardAmount: 25, weight: 10, color: '#0d2a1a', sortOrder: 3 },
          { label: 'Sorry!',      rewardAmount: 0,  weight: 6,  color: '#071b10', sortOrder: 4 },
          { label: 'Rs 100',      rewardAmount: 100, weight: 4, color: '#0d2a1a', sortOrder: 5 },
          { label: 'Rs 500',      rewardAmount: 500, weight: 2, color: '#1a1000', sortOrder: 6 },
          { label: 'Rs 5,000',    rewardAmount: 5000, weight: 1, color: '#140800', sortOrder: 7 },
        ];
        for (const s of defaultSegments) {
          await pool.query(
            `INSERT INTO "SpinSegment" (label,"rewardAmount",weight,color,"sortOrder") VALUES ($1,$2,$3,$4,$5)`,
            [s.label, s.rewardAmount, s.weight, s.color, s.sortOrder]
          );
        }
        console.log('Default spin segments seeded');
      }
    } catch (err) {
      console.error('Spin segment seed warning:', err.message);
    }
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

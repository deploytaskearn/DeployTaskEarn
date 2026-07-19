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
const mysteryRoutes = require('./routes/mysteryRoutes');

const app = express();

// Trust Railway's load balancer proxy so rate-limiter reads X-Forwarded-For correctly
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving uploaded images cross-origin

// Allow the Railway-provided frontend URL plus any custom domains the site
// is served from (e.g. after connecting a custom domain in Railway).
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://taskearn.tech',
  'https://www.taskearn.tech',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
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
app.use('/api/mystery', mysteryRoutes);

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
    `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`,
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
    `ALTER TABLE "SpinSegment" ADD COLUMN IF NOT EXISTS "segmentType" TEXT NOT NULL DEFAULT 'PRIZE'`,
    `CREATE TABLE IF NOT EXISTS "UserBonusSpin" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES "User"(id),
      "awardedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "usedAt" TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "UserBonusSpin_userId_idx" ON "UserBonusSpin"("userId")`,
    `ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'MYSTERY_BOX'`,
    `CREATE TABLE IF NOT EXISTS "MysteryBoxPrize" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL,
      "rewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
      weight DECIMAL(6,2) NOT NULL DEFAULT 10,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "UserMysteryBoxPlay" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES "User"(id),
      "prizeId" UUID REFERENCES "MysteryBoxPrize"(id),
      "rewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "playedAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "UserMysteryBoxPlay_userId_idx" ON "UserMysteryBoxPlay"("userId")`,
    `CREATE TABLE IF NOT EXISTS "UserCoin" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES "User"(id) UNIQUE,
      coins INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "UserCoin_userId_idx" ON "UserCoin"("userId")`,
    `CREATE TABLE IF NOT EXISTS "GoldSpinSegment" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL,
      "rewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
      weight DECIMAL(6,2) NOT NULL DEFAULT 10,
      color TEXT NOT NULL DEFAULT '#1a0d00',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "segmentType" TEXT NOT NULL DEFAULT 'PRIZE',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "PremiumMysteryBoxPrize" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL,
      "rewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
      weight DECIMAL(6,2) NOT NULL DEFAULT 10,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "UserGoldSpinPlay" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES "User"(id),
      "rewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "playedAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "UserPremiumBoxPlay" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES "User"(id),
      "rewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "playedAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'GOLD_SPIN_PURCHASE'`,
    `ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'PREMIUM_BOX_PURCHASE'`,
    `ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'PLAN_REFUND'`,
    // Auto-expire UserPlans whose endDate has passed
    `UPDATE "UserPlan" SET status = 'EXPIRED'
     WHERE status = 'ACTIVE' AND "endDate" IS NOT NULL AND "endDate" < now()`,
    // Recalculate currentUsers for all plans based on actual active subscriptions
    `UPDATE "Plan" p SET "currentUsers" = (
       SELECT COUNT(*) FROM "UserPlan" up
       WHERE up."planId" = p.id AND up.status = 'ACTIVE'
     )`,
    // Set premium box price to Rs 500
    `INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ('premium_box_price', '500', now())
     ON CONFLICT (key) DO NOTHING`,
    // Reseed Gold Spin segments — 80% RTP at Rs 500/spin (EV = Rs 400) [v2]
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM "SiteSetting" WHERE key='gold_spin_segments_v2') THEN
         DELETE FROM "GoldSpinSegment";
         INSERT INTO "GoldSpinSegment" (label,"rewardAmount",weight,color,"isActive","sortOrder","segmentType") VALUES
           ('Rs 10,000', 10000, 0.5,  '#1a0800', true, 0, 'PRIZE'),
           ('Rs 5,000',   5000, 1,    '#1a0d00', true, 1, 'PRIZE'),
           ('Rs 2,000',   2000, 4,    '#1a0d00', true, 2, 'PRIZE'),
           ('Rs 1,000',   1000, 9,    '#1a0d00', true, 3, 'PRIZE'),
           ('Rs 500',      500, 18,   '#1a0d00', true, 4, 'PRIZE'),
           ('Rs 200',      200, 20,   '#150900', true, 5, 'PRIZE'),
           ('Try Again',     0, 47.5, '#0f0700', true, 6, 'PRIZE');
         INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ('gold_spin_segments_v2', '1', now())
           ON CONFLICT (key) DO UPDATE SET value='1', "updatedAt"=now();
       END IF;
     END $$`,
    // Reseed Premium Box prizes — 80% RTP at Rs 500/box (EV = Rs 398) [v2]
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM "SiteSetting" WHERE key='premium_box_prizes_v2') THEN
         DELETE FROM "PremiumMysteryBoxPrize";
         INSERT INTO "PremiumMysteryBoxPrize" (label,"rewardAmount",weight,"isActive","sortOrder") VALUES
           ('Rs 5,000', 5000, 1,  true, 0),
           ('Rs 2,000', 2000, 5,  true, 1),
           ('Rs 1,000', 1000, 10, true, 2),
           ('Rs 500',    500, 18, true, 3),
           ('Rs 200',    200, 22, true, 4),
           ('Rs 100',    100, 14, true, 5),
           ('Better Luck Next Time', 0, 30, true, 6);
         INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ('premium_box_prizes_v2', '1', now())
           ON CONFLICT (key) DO UPDATE SET value='1', "updatedAt"=now();
       END IF;
     END $$`,
    `CREATE TABLE IF NOT EXISTS "HelpVideo" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      "videoUrl" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    )`,
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

    // Seed free tasks (visible to ALL users — NOT assigned to any plan)
    try {
      const catRes = await pool.query(`SELECT id FROM "TaskCategory" WHERE slug = 'social-media' LIMIT 1`);
      const catId = catRes.rows[0]?.id || null;

      const freeTasks = [
        {
          title: 'Follow TaskEarn on Instagram',
          description: 'Follow our official Instagram account @taskearn and send a screenshot as proof.',
          instructions: '1. Open Instagram\n2. Search @taskearn\n3. Follow the account\n4. Take a screenshot showing you followed\n5. Submit screenshot as proof',
          rewardAmount: 50,
          externalUrl: null,
        },
        {
          title: 'Subscribe to Our YouTube Channel',
          description: 'Subscribe to the TaskEarn YouTube channel and send a screenshot as proof.',
          instructions: '1. Open YouTube\n2. Search "TaskEarn"\n3. Subscribe to the channel\n4. Take a screenshot showing subscribed\n5. Submit screenshot as proof',
          rewardAmount: 30,
          externalUrl: null,
        },
        {
          title: 'Share TaskEarn on WhatsApp Status',
          description: 'Share your referral link on your WhatsApp Status and earn Rs 40.',
          instructions: '1. Copy your referral link from the dashboard\n2. Open WhatsApp\n3. Post the link on your Status\n4. Take a screenshot of your status\n5. Submit screenshot as proof',
          rewardAmount: 40,
          externalUrl: null,
        },
      ];

      for (const task of freeTasks) {
        const existing = await pool.query(`SELECT id FROM "Task" WHERE title = $1 LIMIT 1`, [task.title]);
        if (existing.rows.length === 0) {
          await pool.query(
            `INSERT INTO "Task" (id, title, description, instructions, "categoryId", source, "externalUrl", "rewardAmount", "requiresProof", "planTier", status, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'MANUAL', $5, $6, true, 0, 'ACTIVE', now(), now())`,
            [task.title, task.description, task.instructions, catId, task.externalUrl, task.rewardAmount]
          );
        }
        // Free tasks are NOT added to PlanTask — they are visible to everyone
      }

      // Seed plan-specific tasks (assigned to all plans)
      const planTasks = [
        {
          title: 'Download Our App from Play Store',
          description: 'Download and install our app from Google Play Store. Plan members earn Rs 80.',
          instructions: '1. Click "Open Link" to go to Play Store\n2. Download and install the app\n3. Open the app\n4. Take a screenshot showing the app installed\n5. Submit screenshot as proof',
          rewardAmount: 80,
          externalUrl: 'https://play.google.com/store',
        },
        {
          title: 'Join Our Telegram Group',
          description: 'Join the TaskEarn official Telegram group and stay updated. Earn Rs 60.',
          instructions: '1. Open Telegram\n2. Search "TaskEarn Official"\n3. Join the group\n4. Take a screenshot showing you joined\n5. Submit screenshot as proof',
          rewardAmount: 60,
          externalUrl: null,
        },
      ];

      const planTaskIds = [];
      for (const task of planTasks) {
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
        planTaskIds.push(taskId);
      }

      // Assign plan tasks to every plan
      const plansRes = await pool.query(`SELECT id FROM "Plan"`);
      for (const plan of plansRes.rows) {
        for (const taskId of planTaskIds) {
          await pool.query(
            `INSERT INTO "PlanTask" ("planId","taskId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [plan.id, taskId]
          );
        }
      }
      console.log('Free tasks + plan tasks seeded');
    } catch (err) {
      console.error('Task seed warning:', err.message);
    }

    // Seed/reseed spin segments (12-segment premium design with One More Spin)
    try {
      const hasNewDesign = await pool.query(`SELECT id FROM "SpinSegment" WHERE label='+1 Spin' LIMIT 1`);
      if (!hasNewDesign.rows.length) {
        // Unlink UserSpin references then clear old segments
        await pool.query(`UPDATE "UserSpin" SET "segmentId"=NULL`);
        await pool.query(`DELETE FROM "SpinSegment"`);
        const segs = [
          // Biggest (0.5 weight) → ~0.15% actual
          { label: 'Rs 5,000',   rewardAmount: 5000, weight: 0.5, color: '#241200', sortOrder: 0,  segmentType: 'PRIZE'      },
          // No prize tier (60 weight each) → ~54% total for 3 segments
          { label: 'Try Again',  rewardAmount: 0,    weight: 60,  color: '#071b10', sortOrder: 1,  segmentType: 'PRIZE'      },
          // Medium (20 weight) → ~6% each
          { label: 'Rs 750',     rewardAmount: 750,  weight: 20,  color: '#133d24', sortOrder: 2,  segmentType: 'PRIZE'      },
          { label: 'Sorry!',     rewardAmount: 0,    weight: 60,  color: '#0a1a0c', sortOrder: 3,  segmentType: 'PRIZE'      },
          // Big (4 weight) → ~1.2% each
          { label: 'Rs 1,500',   rewardAmount: 1500, weight: 4,   color: '#133d24', sortOrder: 4,  segmentType: 'PRIZE'      },
          { label: 'Better Luck',rewardAmount: 0,    weight: 60,  color: '#071b10', sortOrder: 5,  segmentType: 'PRIZE'      },
          // Bonus spin (4 weight) → ~1.2%
          { label: '+1 Spin',    rewardAmount: 0,    weight: 4,   color: '#0d1530', sortOrder: 6,  segmentType: 'BONUS_SPIN' },
          // Small (40 weight) → ~12% each
          { label: 'Rs 100',     rewardAmount: 100,  weight: 40,  color: '#0d2a1a', sortOrder: 7,  segmentType: 'PRIZE'      },
          { label: 'Rs 1,000',   rewardAmount: 1000, weight: 4,   color: '#133d24', sortOrder: 8,  segmentType: 'PRIZE'      },
          { label: 'Rs 50',      rewardAmount: 50,   weight: 40,  color: '#0d2a1a', sortOrder: 9,  segmentType: 'PRIZE'      },
          { label: 'Rs 500',     rewardAmount: 500,  weight: 20,  color: '#133d24', sortOrder: 10, segmentType: 'PRIZE'      },
          { label: 'Rs 300',     rewardAmount: 300,  weight: 20,  color: '#0d2a1a', sortOrder: 11, segmentType: 'PRIZE'      },
        ];
        for (const s of segs) {
          await pool.query(
            `INSERT INTO "SpinSegment" (label,"rewardAmount",weight,color,"sortOrder","segmentType") VALUES ($1,$2,$3,$4,$5,$6)`,
            [s.label, s.rewardAmount, s.weight, s.color, s.sortOrder, s.segmentType]
          );
        }
        console.log('Premium 12-segment spin wheel seeded');
      }
    } catch (err) {
      console.error('Spin segment seed warning:', err.message);
    }

    // Seed default Gold Spin Wheel segments
    try {
      const existingGold = await pool.query(`SELECT COUNT(*) FROM "GoldSpinSegment"`);
      if (parseInt(existingGold.rows[0].count) === 0) {
        const goldSegs = [
          { label: 'Rs 10,000', rewardAmount: 10000, weight: 0.3,  color: '#1a0800', sortOrder: 0,  segmentType: 'PRIZE'      },
          { label: 'Try Again', rewardAmount: 0,     weight: 40,   color: '#0f0700', sortOrder: 1,  segmentType: 'PRIZE'      },
          { label: 'Rs 2,000',  rewardAmount: 2000,  weight: 5,    color: '#1a0d00', sortOrder: 2,  segmentType: 'PRIZE'      },
          { label: 'Sorry!',    rewardAmount: 0,     weight: 40,   color: '#150900', sortOrder: 3,  segmentType: 'PRIZE'      },
          { label: 'Rs 5,000',  rewardAmount: 5000,  weight: 1,    color: '#1a0800', sortOrder: 4,  segmentType: 'PRIZE'      },
          { label: 'Better Luck',rewardAmount: 0,    weight: 40,   color: '#0f0700', sortOrder: 5,  segmentType: 'PRIZE'      },
          { label: '+1 Spin',   rewardAmount: 0,     weight: 8,    color: '#0d1530', sortOrder: 6,  segmentType: 'BONUS_SPIN' },
          { label: 'Rs 500',    rewardAmount: 500,   weight: 25,   color: '#1a0d00', sortOrder: 7,  segmentType: 'PRIZE'      },
          { label: 'Rs 3,000',  rewardAmount: 3000,  weight: 2,    color: '#1a0800', sortOrder: 8,  segmentType: 'PRIZE'      },
          { label: 'Rs 200',    rewardAmount: 200,   weight: 30,   color: '#1a0d00', sortOrder: 9,  segmentType: 'PRIZE'      },
          { label: 'Rs 1,000',  rewardAmount: 1000,  weight: 8,    color: '#1a0d00', sortOrder: 10, segmentType: 'PRIZE'      },
          { label: 'Rs 750',    rewardAmount: 750,   weight: 10,   color: '#1a0d00', sortOrder: 11, segmentType: 'PRIZE'      },
        ];
        for (const s of goldSegs) {
          await pool.query(
            `INSERT INTO "GoldSpinSegment" (label,"rewardAmount",weight,color,"sortOrder","segmentType") VALUES ($1,$2,$3,$4,$5,$6)`,
            [s.label, s.rewardAmount, s.weight, s.color, s.sortOrder, s.segmentType]
          );
        }
        console.log('Gold spin wheel segments seeded');
      }
    } catch (err) {
      console.error('Gold spin segment seed warning:', err.message);
    }

    // Seed default Mystery Box prizes (free users)
    try {
      const existing = await pool.query(`SELECT COUNT(*) FROM "MysteryBoxPrize"`);
      if (parseInt(existing.rows[0].count) === 0) {
        const prizes = [
          { label: 'Rs 10',               rewardAmount: 10,  weight: 40, sortOrder: 0 },
          { label: 'Rs 20',               rewardAmount: 20,  weight: 30, sortOrder: 1 },
          { label: 'Rs 50',               rewardAmount: 50,  weight: 18, sortOrder: 2 },
          { label: 'Rs 100',              rewardAmount: 100, weight: 8,  sortOrder: 3 },
          { label: 'Better Luck Next Time', rewardAmount: 0, weight: 4,  sortOrder: 4 },
        ];
        for (const p of prizes) {
          await pool.query(
            `INSERT INTO "MysteryBoxPrize" (label,"rewardAmount",weight,"sortOrder") VALUES ($1,$2,$3,$4)`,
            [p.label, p.rewardAmount, p.weight, p.sortOrder]
          );
        }
        console.log('Default Mystery Box prizes seeded');
      }
    } catch (err) {
      console.error('Mystery Box seed warning:', err.message);
    }

    // Seed Premium Mystery Box prizes (plan users)
    try {
      const existing = await pool.query(`SELECT COUNT(*) FROM "PremiumMysteryBoxPrize"`);
      if (parseInt(existing.rows[0].count) === 0) {
        const prizes = [
          { label: 'Rs 100',              rewardAmount: 100,  weight: 35, sortOrder: 0 },
          { label: 'Rs 200',              rewardAmount: 200,  weight: 25, sortOrder: 1 },
          { label: 'Rs 500',              rewardAmount: 500,  weight: 18, sortOrder: 2 },
          { label: 'Rs 1,000',            rewardAmount: 1000, weight: 10, sortOrder: 3 },
          { label: 'Rs 2,000',            rewardAmount: 2000, weight: 5,  sortOrder: 4 },
          { label: 'Rs 5,000',            rewardAmount: 5000, weight: 2,  sortOrder: 5 },
          { label: 'Better Luck Next Time', rewardAmount: 0,  weight: 5,  sortOrder: 6 },
        ];
        for (const p of prizes) {
          await pool.query(
            `INSERT INTO "PremiumMysteryBoxPrize" (label,"rewardAmount",weight,"sortOrder") VALUES ($1,$2,$3,$4)`,
            [p.label, p.rewardAmount, p.weight, p.sortOrder]
          );
        }
        console.log('Premium Mystery Box prizes seeded');
      }
    } catch (err) {
      console.error('Premium Mystery Box seed warning:', err.message);
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

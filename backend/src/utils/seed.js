require('dotenv').config();
const pool = require('../db/pool');
const { hashPassword, generateReferralCode } = require('../utils/auth');

async function seed() {
  console.log('Seeding database...');

  // 1. Admin user
  const adminEmail = 'admin@taskearn.local';
  const existingAdmin = await pool.query('SELECT id FROM "User" WHERE email = $1', [adminEmail]);

  let adminId;
  if (existingAdmin.rows.length === 0) {
    const passwordHash = await hashPassword('Admin@12345');
    const referralCode = generateReferralCode('Admin');
    const result = await pool.query(
      `INSERT INTO "User" (id, name, email, "passwordHash", role, "referralCode", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'Site Admin', $1, $2, 'ADMIN', $3, now(), now())
       RETURNING id`,
      [adminEmail, passwordHash, referralCode]
    );
    adminId = result.rows[0].id;
    await pool.query(
      `INSERT INTO "Wallet" (id, "userId", balance, currency, "updatedAt") VALUES (gen_random_uuid(), $1, 0, 'PKR', now())`,
      [adminId]
    );
    console.log(`Created admin: ${adminEmail} / Admin@12345  -- CHANGE THIS PASSWORD AFTER FIRST LOGIN`);
  } else {
    adminId = existingAdmin.rows[0].id;
    console.log('Admin user already exists, skipping.');
  }

  // 2. Task categories
  const categories = [
    { name: 'Surveys', slug: 'surveys', description: 'Quick paid surveys from advertisers' },
    { name: 'App Installs', slug: 'app-installs', description: 'Install and try mobile apps' },
    { name: 'Social Media', slug: 'social-media', description: 'Follow, like, and engagement tasks' },
    { name: 'Sign-up Offers', slug: 'sign-up-offers', description: 'Sign up for a partner service' },
  ];
  for (const c of categories) {
    await pool.query(
      `INSERT INTO "TaskCategory" (id, name, slug, description, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, now())
       ON CONFLICT (slug) DO NOTHING`,
      [c.name, c.slug, c.description]
    );
  }
  console.log('Seeded task categories.');

  // 3. A couple of sample manual tasks
  const surveysCategory = await pool.query('SELECT id FROM "TaskCategory" WHERE slug = $1', ['surveys']);
  if (surveysCategory.rows.length > 0) {
    await pool.query(
      `INSERT INTO "Task" (id, title, description, instructions, "categoryId", source, "rewardAmount", "requiresProof", status, "createdAt", "updatedAt")
       SELECT gen_random_uuid(), 'Complete a 5-minute consumer survey', 'Share your opinion on household products.',
              'Take a screenshot of the survey completion page and upload it as proof.', $1, 'MANUAL', 50.00, true, 'ACTIVE', now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM "Task" WHERE title = 'Complete a 5-minute consumer survey')`,
      [surveysCategory.rows[0].id]
    );
  }
  console.log('Seeded sample task.');

  // 4. Default payment method configs (admin fills in real account numbers via admin panel)
  const methods = ['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER'];
  for (const m of methods) {
    await pool.query(
      `INSERT INTO "PaymentMethodConfig" (id, method, "isEnabled", "accountName", "accountNumber", instructions, "updatedAt")
       VALUES (gen_random_uuid(), $1, true, 'Set account name in admin panel', 'Set account number in admin panel',
               'Send the exact amount and upload your transaction screenshot.', now())
       ON CONFLICT (method) DO NOTHING`,
      [m]
    );
  }
  console.log('Seeded payment method placeholders.');

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

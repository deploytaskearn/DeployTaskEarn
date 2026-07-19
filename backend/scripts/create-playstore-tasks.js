require('dotenv').config();
if (process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}
const pool = require('../src/db/pool.js');

// reward-per-task formula (confirmed against user's example: Bronze Rs1000 -> Rs1700 total -> ~Rs28/day):
//   rewardPerTask = (planPrice * 1.7) / (dailyTaskLimit * durationDays)
const PLANS = [
  { name: 'Bronze', count: 2 },
  { name: 'Silver', count: 4 },
  { name: 'Gold', count: 6 },
  { name: 'Platinum', count: 8 },
];

// Popular free apps in Pakistan used as placeholder Play Store install tasks.
const APPS = [
  { app: 'TikTok', url: 'https://play.google.com/store/apps/details?id=com.zhiliaoapp.musically' },
  { app: 'Temu', url: 'https://play.google.com/store/apps/details?id=com.einnovation.temu' },
  { app: 'Daraz', url: 'https://play.google.com/store/apps/details?id=pk.olx.daraz' },
  { app: 'Careem', url: 'https://play.google.com/store/apps/details?id=com.careem.acma' },
  { app: 'Bykea', url: 'https://play.google.com/store/apps/details?id=pk.bykea.app' },
  { app: 'JazzCash', url: 'https://play.google.com/store/apps/details?id=com.techlogix.mobilinkcustomer' },
  { app: 'Easypaisa', url: 'https://play.google.com/store/apps/details?id=pk.com.telenor.phoenix' },
  { app: 'Foodpanda', url: 'https://play.google.com/store/apps/details?id=com.global.foodpanda.android' },
  { app: 'Zong 4G', url: 'https://play.google.com/store/apps/details?id=pk.com.zong.myzong' },
  { app: 'Ubuy', url: 'https://play.google.com/store/apps/details?id=com.ubuy.shopping' },
  { app: 'Bolt', url: 'https://play.google.com/store/apps/details?id=ee.mtakso.client' },
  { app: 'inDrive', url: 'https://play.google.com/store/apps/details?id=sinet.startup.inDriver' },
  { app: 'Telegram', url: 'https://play.google.com/store/apps/details?id=org.telegram.messenger' },
  { app: 'Snapchat', url: 'https://play.google.com/store/apps/details?id=com.snapchat.android' },
  { app: 'Likee', url: 'https://play.google.com/store/apps/details?id=video.like' },
  { app: 'Meesho', url: 'https://play.google.com/store/apps/details?id=com.meesho.supply' },
  { app: 'PUBG Mobile', url: 'https://play.google.com/store/apps/details?id=com.tencent.ig' },
  { app: 'Ludo King', url: 'https://play.google.com/store/apps/details?id=com.ludo.king' },
  { app: 'CapCut', url: 'https://play.google.com/store/apps/details?id=com.lemon.lvoverseas' },
  { app: 'PhonePe', url: 'https://play.google.com/store/apps/details?id=com.phonepe.app' },
];

async function main() {
  const dry = process.argv.includes('--dry-run');

  const planRes = await pool.query('SELECT id, name, price, "durationDays", "dailyTaskLimit" FROM "Plan"');
  const planByName = Object.fromEntries(planRes.rows.map((p) => [p.name, p]));

  const catRes = await pool.query(`SELECT id FROM "TaskCategory" WHERE slug = 'app-installs' LIMIT 1`);
  let categoryId = catRes.rows[0]?.id;
  if (!categoryId) {
    const created = await pool.query(
      `INSERT INTO "TaskCategory" (id, name, slug, "createdAt") VALUES (gen_random_uuid(), 'App Installs', 'app-installs', now()) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`
    );
    categoryId = created.rows[0].id;
  }

  let appIdx = 0;
  const summary = [];

  for (const tier of PLANS) {
    const plan = planByName[tier.name];
    if (!plan) throw new Error(`Plan not found: ${tier.name}`);
    const price = Number(plan.price);
    const duration = Number(plan.durationDays);
    const dailyLimit = Number(plan.dailyTaskLimit);
    const rewardPerTask = Math.round(((price * 1.7) / (dailyLimit * duration)) * 100) / 100;

    for (let i = 0; i < tier.count; i++) {
      const { app, url } = APPS[appIdx++];
      const title = `Install ${app} from Play Store`;
      const description = `Download and install the ${app} app from the Google Play Store, open it once, and submit a screenshot as proof to earn your reward.`;
      const instructions = `1. Tap the link and install ${app} from the Play Store.\n2. Open the app at least once after installing.\n3. Take a screenshot showing ${app} installed on your device.\n4. Upload the screenshot as proof and submit.`;

      summary.push({ tier: tier.name, app, rewardPerTask, title });

      if (!dry) {
        const taskRes = await pool.query(
          `INSERT INTO "Task"
            (id, title, description, instructions, "categoryId", source, "externalUrl",
             "rewardAmount", "requiresProof", "planTier", status, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'MANUAL', $5, $6, true, 0, 'ACTIVE', now(), now())
           RETURNING id`,
          [title, description, instructions, categoryId, url, rewardPerTask]
        );
        const taskId = taskRes.rows[0].id;
        await pool.query(
          `INSERT INTO "PlanTask" ("planId","taskId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [plan.id, taskId]
        );
      }
    }
  }

  console.table(summary);
  console.log(dry ? '\n(dry run — nothing written)' : `\nCreated ${summary.length} tasks and linked to plans.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

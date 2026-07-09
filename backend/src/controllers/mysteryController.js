const pool = require('../db/pool');
const walletService = require('../services/walletService');

const DAILY_LIMIT = 1;

async function getUserHasPlan(userId) {
  const res = await pool.query(
    `SELECT 1 FROM "UserPlan" WHERE "userId"=$1 AND status='ACTIVE'
     AND ("endDate" IS NULL OR "endDate" > now()) LIMIT 1`,
    [userId]
  );
  return res.rows.length > 0;
}

async function getSecondsUntilNextPlay(userId) {
  const last = await pool.query(
    `SELECT "playedAt" FROM "UserMysteryBoxPlay" WHERE "userId"=$1 ORDER BY "playedAt" DESC LIMIT 1`,
    [userId]
  );
  if (!last.rows.length) return 0;
  const nextAt = new Date(last.rows[0].playedAt).getTime() + 24 * 3600 * 1000;
  return Math.max(0, Math.floor((nextAt - Date.now()) / 1000));
}

async function getPrizes(hasPlan) {
  const table = hasPlan ? '"PremiumMysteryBoxPrize"' : '"MysteryBoxPrize"';
  const res = await pool.query(
    `SELECT id, label, "rewardAmount", "sortOrder" FROM ${table} WHERE "isActive"=true ORDER BY "sortOrder"`
  );
  // Fallback to regular prizes if premium table has no rows yet
  if (hasPlan && res.rows.length === 0) {
    const fallback = await pool.query(
      `SELECT id, label, "rewardAmount", "sortOrder" FROM "MysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`
    );
    return { prizes: fallback.rows, isPremium: false };
  }
  return { prizes: res.rows, isPremium: hasPlan };
}

async function getInfo(req, res) {
  try {
    const userId = req.user.id;
    const hasPlan = await getUserHasPlan(userId);
    const { prizes, isPremium } = await getPrizes(hasPlan);

    let playsUsed;
    if (!hasPlan) {
      // No plan: lifetime limit of 1
      const r = await pool.query(`SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1`, [userId]);
      playsUsed = parseInt(r.rows[0].count);
    } else {
      // Has plan: 24h rolling window
      const r = await pool.query(
        `SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1 AND "playedAt" > now() - interval '24 hours'`,
        [userId]
      );
      playsUsed = parseInt(r.rows[0].count);
    }

    const canPlay = playsUsed < DAILY_LIMIT;
    const secondsUntilReset = (!hasPlan || canPlay) ? 0 : await getSecondsUntilNextPlay(userId);

    res.json({
      prizes,
      isPremium,
      dailyLimit: DAILY_LIMIT,
      playsToday: playsUsed,
      canPlay,
      secondsUntilReset,
      hasPlan,
    });
  } catch (err) {
    console.error('mystery getInfo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function openBox(req, res) {
  try {
    const userId = req.user.id;
    const hasPlan = await getUserHasPlan(userId);

    let playsUsed;
    if (!hasPlan) {
      const r = await pool.query(`SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1`, [userId]);
      playsUsed = parseInt(r.rows[0].count);
    } else {
      const r = await pool.query(
        `SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1 AND "playedAt" > now() - interval '24 hours'`,
        [userId]
      );
      playsUsed = parseInt(r.rows[0].count);
    }

    if (playsUsed >= DAILY_LIMIT) {
      if (!hasPlan) {
        return res.status(422).json({
          error: 'Activate a plan to open premium mystery boxes daily!',
          needsPlan: true,
        });
      }
      const secs = await getSecondsUntilNextPlay(userId);
      const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
      return res.status(422).json({
        error: `Come back in ${h}h ${m}m for your next premium mystery box!`,
        secondsUntilReset: secs,
        hasPlan: true,
      });
    }

    const table = hasPlan ? '"PremiumMysteryBoxPrize"' : '"MysteryBoxPrize"';
    const prizesRes = await pool.query(
      `SELECT * FROM ${table} WHERE "isActive"=true ORDER BY "sortOrder"`
    );
    let allPrizes = prizesRes.rows;

    // Fallback to regular if premium empty
    if (allPrizes.length === 0) {
      const fallback = await pool.query(`SELECT * FROM "MysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`);
      allPrizes = fallback.rows;
    }
    if (!allPrizes.length) return res.status(422).json({ error: 'No prizes configured.' });

    // Weighted random selection
    const totalW = allPrizes.reduce((s, r) => s + parseFloat(r.weight), 0);
    let rand = Math.random() * totalW;
    let winner = allPrizes[0];
    for (const p of allPrizes) {
      rand -= parseFloat(p.weight);
      if (rand <= 0) { winner = p; break; }
    }

    if (parseFloat(winner.rewardAmount) > 0) {
      await walletService.credit(userId, parseFloat(winner.rewardAmount), 'MYSTERY_BOX', winner.id, `Mystery Box: ${winner.label}`);
    }

    await pool.query(
      `INSERT INTO "UserMysteryBoxPlay" ("userId","prizeId","rewardAmount") VALUES ($1,$2,$3)`,
      [userId, winner.id, winner.rewardAmount]
    );

    const secs = hasPlan ? await getSecondsUntilNextPlay(userId) : 0;
    res.json({
      prize: { id: winner.id, label: winner.label, rewardAmount: winner.rewardAmount },
      playsToday: playsUsed + 1,
      playsRemaining: 0,
      secondsUntilReset: secs,
      hasPlan,
      isPremium: hasPlan,
    });
  } catch (err) {
    console.error('mystery openBox:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin prize management (regular)
async function adminGetPrizes(req, res) {
  try { res.json((await pool.query(`SELECT * FROM "MysteryBoxPrize" ORDER BY "sortOrder"`)).rows); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminUpsertPrize(req, res) {
  try {
    const { id, label, rewardAmount, weight, isActive, sortOrder } = req.body;
    const vals = [label, rewardAmount ?? 0, weight ?? 10, isActive !== false, sortOrder ?? 0];
    const r = id
      ? await pool.query(`UPDATE "MysteryBoxPrize" SET label=$1,"rewardAmount"=$2,weight=$3,"isActive"=$4,"sortOrder"=$5 WHERE id=$6 RETURNING *`, [...vals, id])
      : await pool.query(`INSERT INTO "MysteryBoxPrize" (label,"rewardAmount",weight,"isActive","sortOrder") VALUES ($1,$2,$3,$4,$5) RETURNING *`, vals);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminDeletePrize(req, res) {
  try { await pool.query(`DELETE FROM "MysteryBoxPrize" WHERE id=$1`, [req.params.id]); res.status(204).send(); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

// Admin prize management (premium)
async function adminGetPremiumPrizes(req, res) {
  try { res.json((await pool.query(`SELECT * FROM "PremiumMysteryBoxPrize" ORDER BY "sortOrder"`)).rows); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminUpsertPremiumPrize(req, res) {
  try {
    const { id, label, rewardAmount, weight, isActive, sortOrder } = req.body;
    const vals = [label, rewardAmount ?? 0, weight ?? 10, isActive !== false, sortOrder ?? 0];
    const r = id
      ? await pool.query(`UPDATE "PremiumMysteryBoxPrize" SET label=$1,"rewardAmount"=$2,weight=$3,"isActive"=$4,"sortOrder"=$5 WHERE id=$6 RETURNING *`, [...vals, id])
      : await pool.query(`INSERT INTO "PremiumMysteryBoxPrize" (label,"rewardAmount",weight,"isActive","sortOrder") VALUES ($1,$2,$3,$4,$5) RETURNING *`, vals);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminDeletePremiumPrize(req, res) {
  try { await pool.query(`DELETE FROM "PremiumMysteryBoxPrize" WHERE id=$1`, [req.params.id]); res.status(204).send(); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

module.exports = {
  getInfo, openBox,
  adminGetPrizes, adminUpsertPrize, adminDeletePrize,
  adminGetPremiumPrizes, adminUpsertPremiumPrize, adminDeletePremiumPrize,
};

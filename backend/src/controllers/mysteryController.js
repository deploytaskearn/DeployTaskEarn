const pool = require('../db/pool');
const walletService = require('../services/walletService');

const DAILY_LIMIT = 1;

async function getPremiumBoxPrice() {
  try {
    const r = await pool.query(`SELECT value FROM "SiteSetting" WHERE key='premium_box_price' LIMIT 1`);
    if (r.rows.length && r.rows[0].value) return parseFloat(r.rows[0].value);
  } catch {}
  return 300;
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

async function getInfo(req, res) {
  try {
    const userId = req.user.id;

    // ALL users: 1 free box per 24h
    const r = await pool.query(
      `SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1 AND "playedAt" > now() - interval '24 hours'`,
      [userId]
    );
    const playsToday = parseInt(r.rows[0].count);
    const canPlay = playsToday < DAILY_LIMIT;
    const secondsUntilReset = canPlay ? 0 : await getSecondsUntilNextPlay(userId);

    // Free prizes
    const prizes = await pool.query(
      `SELECT id, label, "rewardAmount", "sortOrder" FROM "MysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`
    );

    // Premium prizes
    const premiumPrizes = await pool.query(
      `SELECT id, label, "rewardAmount", "sortOrder" FROM "PremiumMysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`
    );

    // Wallet balance (so frontend knows if user can afford premium)
    const wb = await walletService.getBalance(userId);
    const walletBalance = parseFloat(wb.balance ?? 0);
    const premiumBoxPrice = await getPremiumBoxPrice();

    res.json({
      prizes: prizes.rows,
      canPlay,
      playsToday,
      secondsUntilReset,
      premiumPrizes: premiumPrizes.rows,
      premiumBoxPrice,
      walletBalance,
    });
  } catch (err) {
    console.error('mystery getInfo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function openBox(req, res) {
  try {
    const userId = req.user.id;

    // ALL users: 1 free play per 24h
    const r = await pool.query(
      `SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1 AND "playedAt" > now() - interval '24 hours'`,
      [userId]
    );
    const playsToday = parseInt(r.rows[0].count);

    if (playsToday >= DAILY_LIMIT) {
      const secs = await getSecondsUntilNextPlay(userId);
      const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
      return res.status(422).json({
        error: `Come back in ${h}h ${m}m for your next free mystery box!`,
        secondsUntilReset: secs,
      });
    }

    const prizes = await pool.query(
      `SELECT * FROM "MysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`
    );
    if (!prizes.rows.length) return res.status(422).json({ error: 'No prizes configured.' });

    const totalW = prizes.rows.reduce((s, r) => s + parseFloat(r.weight), 0);
    let rand = Math.random() * totalW;
    let winner = prizes.rows[0];
    for (const p of prizes.rows) {
      rand -= parseFloat(p.weight);
      if (rand <= 0) { winner = p; break; }
    }

    if (parseFloat(winner.rewardAmount) > 0) {
      await walletService.credit(userId, parseFloat(winner.rewardAmount), 'MYSTERY_BOX', winner.id, `Free mystery box: ${winner.label}`);
    }

    await pool.query(
      `INSERT INTO "UserMysteryBoxPlay" ("userId","prizeId","rewardAmount") VALUES ($1,$2,$3)`,
      [userId, winner.id, winner.rewardAmount]
    );

    const secs = await getSecondsUntilNextPlay(userId);
    res.json({
      prize: { id: winner.id, label: winner.label, rewardAmount: winner.rewardAmount },
      playsToday: playsToday + 1,
      playsRemaining: 0,
      secondsUntilReset: secs,
    });
  } catch (err) {
    console.error('mystery openBox:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function buyAndOpenPremium(req, res) {
  try {
    const userId = req.user.id;
    const PREMIUM_BOX_PRICE = await getPremiumBoxPrice();

    // Deduct from wallet
    try {
      await walletService.debit(userId, PREMIUM_BOX_PRICE, 'PREMIUM_BOX_PURCHASE', null, 'Premium mystery box purchase');
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        return res.status(422).json({ error: `You need Rs ${PREMIUM_BOX_PRICE} in your wallet to buy a premium mystery box.` });
      }
      throw err;
    }

    const prizes = await pool.query(
      `SELECT * FROM "PremiumMysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`
    );
    let allPrizes = prizes.rows;

    // Fallback to regular prizes if premium not seeded yet
    if (!allPrizes.length) {
      const fallback = await pool.query(`SELECT * FROM "MysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`);
      allPrizes = fallback.rows;
    }
    if (!allPrizes.length) {
      await walletService.credit(userId, PREMIUM_BOX_PRICE, 'PREMIUM_BOX_PURCHASE', null, 'Refund — no prizes configured');
      return res.status(422).json({ error: 'Premium prizes not configured yet.' });
    }

    const totalW = allPrizes.reduce((s, r) => s + parseFloat(r.weight), 0);
    let rand = Math.random() * totalW;
    let winner = allPrizes[0];
    for (const p of allPrizes) {
      rand -= parseFloat(p.weight);
      if (rand <= 0) { winner = p; break; }
    }

    if (parseFloat(winner.rewardAmount) > 0) {
      await walletService.credit(userId, parseFloat(winner.rewardAmount), 'MYSTERY_BOX', winner.id, `Premium mystery box: ${winner.label}`);
    }

    await pool.query(
      `INSERT INTO "UserPremiumBoxPlay" ("userId","rewardAmount") VALUES ($1,$2)`,
      [userId, winner.rewardAmount]
    );

    const wb = await walletService.getBalance(userId);
    res.json({
      prize: { id: winner.id, label: winner.label, rewardAmount: winner.rewardAmount },
      walletBalance: parseFloat(wb.balance ?? 0),
    });
  } catch (err) {
    console.error('mystery buyAndOpenPremium:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin — free prizes
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

// Admin — premium prizes
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

// Admin — config (premium box price etc.)
async function adminGetConfig(req, res) {
  try {
    const price = await getPremiumBoxPrice();
    res.json({ premiumBoxPrice: price });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminSetConfig(req, res) {
  try {
    const { premiumBoxPrice } = req.body;
    if (premiumBoxPrice === undefined || isNaN(parseFloat(premiumBoxPrice))) {
      return res.status(400).json({ error: 'premiumBoxPrice is required' });
    }
    await pool.query(
      `INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ('premium_box_price', $1, now())
       ON CONFLICT (key) DO UPDATE SET value=$1, "updatedAt"=now()`,
      [String(parseFloat(premiumBoxPrice))]
    );
    res.json({ ok: true, premiumBoxPrice: parseFloat(premiumBoxPrice) });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

module.exports = {
  getInfo, openBox, buyAndOpenPremium,
  adminGetPrizes, adminUpsertPrize, adminDeletePrize,
  adminGetPremiumPrizes, adminUpsertPremiumPrize, adminDeletePremiumPrize,
  adminGetConfig, adminSetConfig,
};

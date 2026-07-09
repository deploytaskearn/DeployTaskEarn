const pool = require('../db/pool');
const walletService = require('../services/walletService');

const DAILY_LIMIT = 1;

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
    const prizes = await pool.query(
      `SELECT id, label, "rewardAmount", "sortOrder" FROM "MysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`
    );
    // 24h rolling window
    const plays = await pool.query(
      `SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1 AND "playedAt" > now() - interval '24 hours'`,
      [userId]
    );
    const playsToday = parseInt(plays.rows[0].count);
    const canPlay = playsToday < DAILY_LIMIT;
    const secondsUntilReset = canPlay ? 0 : await getSecondsUntilNextPlay(userId);

    res.json({
      prizes: prizes.rows,
      dailyLimit: DAILY_LIMIT,
      playsToday,
      canPlay,
      secondsUntilReset,
    });
  } catch (err) {
    console.error('mystery getInfo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function openBox(req, res) {
  try {
    const userId = req.user.id;
    const plays = await pool.query(
      `SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1 AND "playedAt" > now() - interval '24 hours'`,
      [userId]
    );
    const playsToday = parseInt(plays.rows[0].count);
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
      await walletService.credit(userId, parseFloat(winner.rewardAmount), 'MYSTERY_BOX', winner.id, `Mystery Box: ${winner.label}`);
    }

    await pool.query(
      `INSERT INTO "UserMysteryBoxPlay" ("userId","prizeId","rewardAmount") VALUES ($1,$2,$3)`,
      [userId, winner.id, winner.rewardAmount]
    );

    const newPlays = playsToday + 1;
    const secs = await getSecondsUntilNextPlay(userId);
    res.json({
      prize: { id: winner.id, label: winner.label, rewardAmount: winner.rewardAmount },
      playsToday: newPlays,
      playsRemaining: Math.max(0, DAILY_LIMIT - newPlays),
      secondsUntilReset: secs,
    });
  } catch (err) {
    console.error('mystery openBox:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adminGetPrizes(req, res) {
  try {
    const r = await pool.query(`SELECT * FROM "MysteryBoxPrize" ORDER BY "sortOrder"`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminUpsertPrize(req, res) {
  try {
    const { id, label, rewardAmount, weight, isActive, sortOrder } = req.body;
    if (id) {
      const r = await pool.query(
        `UPDATE "MysteryBoxPrize" SET label=$1,"rewardAmount"=$2,weight=$3,"isActive"=$4,"sortOrder"=$5 WHERE id=$6 RETURNING *`,
        [label, rewardAmount ?? 0, weight ?? 10, isActive !== false, sortOrder ?? 0, id]
      );
      res.json(r.rows[0]);
    } else {
      const r = await pool.query(
        `INSERT INTO "MysteryBoxPrize" (label,"rewardAmount",weight,"isActive","sortOrder") VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [label, rewardAmount ?? 0, weight ?? 10, isActive !== false, sortOrder ?? 99]
      );
      res.json(r.rows[0]);
    }
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminDeletePrize(req, res) {
  try {
    await pool.query(`DELETE FROM "MysteryBoxPrize" WHERE id=$1`, [req.params.id]);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

module.exports = { getInfo, openBox, adminGetPrizes, adminUpsertPrize, adminDeletePrize };

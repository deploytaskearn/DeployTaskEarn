const pool = require('../db/pool');
const walletService = require('../services/walletService');

const DAILY_LIMIT = 5;

async function getInfo(req, res) {
  try {
    const userId = req.user.id;
    const prizes = await pool.query(
      `SELECT id, label, "rewardAmount", "sortOrder" FROM "MysteryBoxPrize" WHERE "isActive"=true ORDER BY "sortOrder"`
    );
    const plays = await pool.query(
      `SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1 AND DATE("playedAt")=CURRENT_DATE`,
      [userId]
    );
    const playsToday = parseInt(plays.rows[0].count);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const secondsUntilReset = Math.floor((tomorrow - now) / 1000);

    res.json({
      prizes: prizes.rows,
      dailyLimit: DAILY_LIMIT,
      playsToday,
      canPlay: playsToday < DAILY_LIMIT,
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
      `SELECT COUNT(*) FROM "UserMysteryBoxPlay" WHERE "userId"=$1 AND DATE("playedAt")=CURRENT_DATE`,
      [userId]
    );
    const playsToday = parseInt(plays.rows[0].count);
    if (playsToday >= DAILY_LIMIT) {
      return res.status(422).json({ error: `You've used all ${DAILY_LIMIT} daily chances. Come back tomorrow!` });
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
    res.json({
      prize: { id: winner.id, label: winner.label, rewardAmount: winner.rewardAmount },
      playsToday: newPlays,
      playsRemaining: DAILY_LIMIT - newPlays,
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

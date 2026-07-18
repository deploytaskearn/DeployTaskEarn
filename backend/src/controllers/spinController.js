const pool = require('../db/pool');
const walletService = require('../services/walletService');

async function getGoldSpinPrice() {
  try {
    const r = await pool.query(`SELECT value FROM "SiteSetting" WHERE key='gold_spin_price' LIMIT 1`);
    if (r.rows.length && r.rows[0].value) return parseFloat(r.rows[0].value);
  } catch {}
  return 500;
}

async function getFreeSpinTestMode() {
  try {
    const r = await pool.query(`SELECT value FROM "SiteSetting" WHERE key='free_spin_test_mode' LIMIT 1`);
    return r.rows.length && r.rows[0].value === '1';
  } catch {}
  return false;
}

async function getSecondsUntilNextSpin(userId) {
  const last = await pool.query(
    `SELECT "spunAt" FROM "UserSpin" WHERE "userId"=$1 ORDER BY "spunAt" DESC LIMIT 1`,
    [userId]
  );
  if (!last.rows.length) return 0;
  const nextAt = new Date(last.rows[0].spunAt).getTime() + 24 * 3600 * 1000;
  return Math.max(0, Math.floor((nextAt - Date.now()) / 1000));
}

async function getSpinInfo(req, res) {
  try {
    const userId = req.user.id;
    const testMode = await getFreeSpinTestMode();

    // ALL users: 1 free spin per 24h rolling window (bypassed when test mode is on)
    const r = await pool.query(
      `SELECT COUNT(*) FROM "UserSpin" WHERE "userId"=$1 AND "spunAt" > now() - interval '24 hours'`,
      [userId]
    );
    const spinsToday = parseInt(r.rows[0].count);
    const canSpin = testMode || spinsToday < 1;
    const secondsUntilSpin = canSpin ? 0 : await getSecondsUntilNextSpin(userId);

    // Free wheel segments
    const segs = await pool.query(
      `SELECT id, label, "rewardAmount", color, "sortOrder", "segmentType"
       FROM "SpinSegment" WHERE "isActive"=true ORDER BY "sortOrder"`
    );

    // Gold wheel segments
    const goldSegs = await pool.query(
      `SELECT id, label, "rewardAmount", color, "sortOrder", "segmentType"
       FROM "GoldSpinSegment" WHERE "isActive"=true ORDER BY "sortOrder"`
    );

    // Wallet balance
    const wb = await walletService.getBalance(userId);
    const walletBalance = parseFloat(wb.balance ?? 0);

    const goldSpinPrice = await getGoldSpinPrice();

    res.json({
      segments: segs.rows,
      canSpin,
      spinsToday,
      secondsUntilSpin,
      goldSegments: goldSegs.rows,
      goldSpinPrice,
      walletBalance,
      freeSpinTestMode: testMode,
    });
  } catch (err) {
    console.error('getSpinInfo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function spin(req, res) {
  try {
    const userId = req.user.id;
    const testMode = await getFreeSpinTestMode();

    // 1 free spin per 24h — all users (bypassed when test mode is on)
    const r = await pool.query(
      `SELECT COUNT(*) FROM "UserSpin" WHERE "userId"=$1 AND "spunAt" > now() - interval '24 hours'`,
      [userId]
    );
    const spinsToday = parseInt(r.rows[0].count);
    if (!testMode && spinsToday >= 1) {
      const secs = await getSecondsUntilNextSpin(userId);
      const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
      return res.status(422).json({
        error: `Next free spin in ${h}h ${m}m.`,
        secondsUntilSpin: secs,
      });
    }

    const segs = await pool.query(`SELECT * FROM "SpinSegment" WHERE "isActive"=true ORDER BY "sortOrder"`);
    if (!segs.rows.length) return res.status(422).json({ error: 'Wheel not configured.' });

    const totalW = segs.rows.reduce((s, r) => s + parseFloat(r.weight), 0);
    let rand = Math.random() * totalW;
    let winner = segs.rows[0];
    for (const seg of segs.rows) {
      rand -= parseFloat(seg.weight);
      if (rand <= 0) { winner = seg; break; }
    }
    const winnerIndex = segs.rows.findIndex(s => s.id === winner.id);
    const rewardAmount = parseFloat(winner.rewardAmount);

    if (winner.segmentType === 'BONUS_SPIN') {
      await pool.query(`INSERT INTO "UserBonusSpin" ("userId") VALUES ($1)`, [userId]);
    } else if (rewardAmount > 0) {
      await walletService.credit(userId, rewardAmount, 'SPIN_REWARD', winner.id, `Free spin: ${winner.label}`);
    }

    await pool.query(
      `INSERT INTO "UserSpin" ("userId","segmentId","rewardAmount") VALUES ($1,$2,$3)`,
      [userId, winner.id, rewardAmount]
    );

    const secs = await getSecondsUntilNextSpin(userId);
    res.json({
      winner: { id: winner.id, label: winner.label, rewardAmount: String(rewardAmount), segmentType: winner.segmentType },
      winnerIndex,
      totalSegments: segs.rows.length,
      segments: segs.rows,
      secondsUntilSpin: secs,
    });
  } catch (err) {
    console.error('spin:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function buyAndSpinGold(req, res) {
  try {
    const userId = req.user.id;
    const GOLD_SPIN_PRICE = await getGoldSpinPrice();

    // Deduct from wallet (throws INSUFFICIENT_BALANCE if not enough)
    try {
      await walletService.debit(userId, GOLD_SPIN_PRICE, 'GOLD_SPIN_PURCHASE', null, 'Gold spin purchase');
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        return res.status(422).json({ error: `You need Rs ${GOLD_SPIN_PRICE} in your wallet to buy a gold spin.` });
      }
      throw err;
    }

    const segs = await pool.query(`SELECT * FROM "GoldSpinSegment" WHERE "isActive"=true ORDER BY "sortOrder"`);
    if (!segs.rows.length) {
      // Refund if gold wheel not configured
      await walletService.credit(userId, GOLD_SPIN_PRICE, 'GOLD_SPIN_PURCHASE', null, 'Gold spin refund — wheel not configured');
      return res.status(422).json({ error: 'Gold wheel not configured yet.' });
    }

    const totalW = segs.rows.reduce((s, r) => s + parseFloat(r.weight), 0);
    let rand = Math.random() * totalW;
    let winner = segs.rows[0];
    for (const seg of segs.rows) {
      rand -= parseFloat(seg.weight);
      if (rand <= 0) { winner = seg; break; }
    }
    const winnerIndex = segs.rows.findIndex(s => s.id === winner.id);
    const rewardAmount = parseFloat(winner.rewardAmount);

    if (winner.segmentType === 'BONUS_SPIN') {
      await pool.query(`INSERT INTO "UserBonusSpin" ("userId") VALUES ($1)`, [userId]);
    } else if (rewardAmount > 0) {
      await walletService.credit(userId, rewardAmount, 'SPIN_REWARD', winner.id, `Gold spin: ${winner.label}`);
    }

    await pool.query(
      `INSERT INTO "UserGoldSpinPlay" ("userId","rewardAmount") VALUES ($1,$2)`,
      [userId, rewardAmount]
    );

    const wb = await walletService.getBalance(userId);
    res.json({
      winner: { id: winner.id, label: winner.label, rewardAmount: String(rewardAmount), segmentType: winner.segmentType },
      winnerIndex,
      totalSegments: segs.rows.length,
      segments: segs.rows,
      walletBalance: parseFloat(wb.balance ?? 0),
    });
  } catch (err) {
    console.error('buyAndSpinGold:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function redeemCode(req, res) {
  try {
    const userId = req.user.id;
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'Code is required.' });

    const rc = await pool.query(
      `SELECT * FROM "RedeemCode" WHERE UPPER(TRIM(code))=UPPER(TRIM($1)) AND "isActive"=true`, [code]
    );
    if (!rc.rows.length) return res.status(404).json({ error: 'Invalid or expired code.' });
    const r = rc.rows[0];

    if (r.expiresAt && new Date(r.expiresAt) < new Date()) return res.status(422).json({ error: 'Code has expired.' });
    if (r.usedCount >= r.maxUses) return res.status(422).json({ error: 'Code has reached its maximum uses.' });

    const used = await pool.query(
      `SELECT id FROM "RedeemCodeUse" WHERE "codeId"=$1 AND "userId"=$2`, [r.id, userId]
    );
    if (used.rows.length) return res.status(422).json({ error: 'You have already used this code.' });

    await walletService.credit(userId, parseFloat(r.rewardAmount), 'REDEEM_CODE', r.id, `Redeem code: ${r.code}`);
    await pool.query(`INSERT INTO "RedeemCodeUse" ("codeId","userId") VALUES ($1,$2)`, [r.id, userId]);
    await pool.query(`UPDATE "RedeemCode" SET "usedCount"="usedCount"+1 WHERE id=$1`, [r.id]);

    res.json({ reward: parseFloat(r.rewardAmount), message: `Congratulations! Rs${parseFloat(r.rewardAmount).toLocaleString()} added to your wallet!` });
  } catch (err) {
    console.error('redeemCode:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin endpoints
async function adminGetSegments(req, res) {
  try { res.json((await pool.query(`SELECT * FROM "SpinSegment" ORDER BY "sortOrder"`)).rows); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminUpsertSegment(req, res) {
  try {
    const { id, label, rewardAmount, weight, color, isActive, sortOrder, segmentType } = req.body;
    const vals = [label, rewardAmount ?? 0, weight ?? 10, color ?? '#0d2a1a', isActive !== false, sortOrder ?? 0, segmentType || 'PRIZE'];
    const r = id
      ? await pool.query(`UPDATE "SpinSegment" SET label=$1,"rewardAmount"=$2,weight=$3,color=$4,"isActive"=$5,"sortOrder"=$6,"segmentType"=$7 WHERE id=$8 RETURNING *`, [...vals, id])
      : await pool.query(`INSERT INTO "SpinSegment" (label,"rewardAmount",weight,color,"isActive","sortOrder","segmentType") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, vals);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminDeleteSegment(req, res) {
  try { await pool.query(`DELETE FROM "SpinSegment" WHERE id=$1`, [req.params.id]); res.status(204).send(); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminGetGoldSegments(req, res) {
  try { res.json((await pool.query(`SELECT * FROM "GoldSpinSegment" ORDER BY "sortOrder"`)).rows); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminUpsertGoldSegment(req, res) {
  try {
    const { id, label, rewardAmount, weight, color, isActive, sortOrder, segmentType } = req.body;
    const vals = [label, rewardAmount ?? 0, weight ?? 10, color ?? '#1a0d00', isActive !== false, sortOrder ?? 0, segmentType || 'PRIZE'];
    const r = id
      ? await pool.query(`UPDATE "GoldSpinSegment" SET label=$1,"rewardAmount"=$2,weight=$3,color=$4,"isActive"=$5,"sortOrder"=$6,"segmentType"=$7 WHERE id=$8 RETURNING *`, [...vals, id])
      : await pool.query(`INSERT INTO "GoldSpinSegment" (label,"rewardAmount",weight,color,"isActive","sortOrder","segmentType") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, vals);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminDeleteGoldSegment(req, res) {
  try { await pool.query(`DELETE FROM "GoldSpinSegment" WHERE id=$1`, [req.params.id]); res.status(204).send(); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminGetCodes(req, res) {
  try { res.json((await pool.query(`SELECT * FROM "RedeemCode" ORDER BY "createdAt" DESC`)).rows); }
  catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminCreateCode(req, res) {
  try {
    const { code, rewardAmount, maxUses, expiresAt } = req.body;
    if (!code || !rewardAmount) return res.status(400).json({ error: 'code and rewardAmount are required.' });
    const r = await pool.query(
      `INSERT INTO "RedeemCode" (code,"rewardAmount","maxUses","expiresAt") VALUES (UPPER(TRIM($1)),$2,$3,$4) RETURNING *`,
      [code, rewardAmount, maxUses || 1, expiresAt || null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(422).json({ error: 'Code already exists.' });
    res.status(500).json({ error: 'Internal server error' });
  }
}
async function adminToggleCode(req, res) {
  try {
    const r = await pool.query(`UPDATE "RedeemCode" SET "isActive"=NOT "isActive" WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}
async function adminDeleteCode(req, res) {
  try {
    await pool.query(`DELETE FROM "RedeemCodeUse" WHERE "codeId"=$1`, [req.params.id]);
    await pool.query(`DELETE FROM "RedeemCode" WHERE id=$1`, [req.params.id]);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

// Admin — spin config (gold spin price, free spin test mode)
async function adminGetSpinConfig(req, res) {
  try {
    const price = await getGoldSpinPrice();
    const freeSpinTestMode = await getFreeSpinTestMode();
    res.json({ goldSpinPrice: price, freeSpinTestMode });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminSetSpinConfig(req, res) {
  try {
    const { goldSpinPrice, freeSpinTestMode } = req.body;

    if (goldSpinPrice !== undefined) {
      if (isNaN(parseFloat(goldSpinPrice))) {
        return res.status(400).json({ error: 'goldSpinPrice must be a number' });
      }
      await pool.query(
        `INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ('gold_spin_price', $1, now())
         ON CONFLICT (key) DO UPDATE SET value=$1, "updatedAt"=now()`,
        [String(parseFloat(goldSpinPrice))]
      );
    }

    if (freeSpinTestMode !== undefined) {
      await pool.query(
        `INSERT INTO "SiteSetting" (key, value, "updatedAt") VALUES ('free_spin_test_mode', $1, now())
         ON CONFLICT (key) DO UPDATE SET value=$1, "updatedAt"=now()`,
        [freeSpinTestMode ? '1' : '0']
      );
    }

    const price = await getGoldSpinPrice();
    const testMode = await getFreeSpinTestMode();
    res.json({ ok: true, goldSpinPrice: price, freeSpinTestMode: testMode });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

module.exports = {
  getSpinInfo, spin, buyAndSpinGold, redeemCode,
  adminGetSegments, adminUpsertSegment, adminDeleteSegment,
  adminGetGoldSegments, adminUpsertGoldSegment, adminDeleteGoldSegment,
  adminGetCodes, adminCreateCode, adminToggleCode, adminDeleteCode,
  adminGetSpinConfig, adminSetSpinConfig,
};

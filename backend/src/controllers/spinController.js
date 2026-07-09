const pool = require('../db/pool');
const walletService = require('../services/walletService');

async function getUserTier(userId) {
  try {
    const res = await pool.query(
      `SELECT p.price::numeric AS price FROM "UserPlan" up
       JOIN "Plan" p ON p.id = up."planId"
       WHERE up."userId"=$1 AND up.status='ACTIVE'
         AND (up."endDate" IS NULL OR up."endDate" > now())
       ORDER BY p.price::numeric DESC LIMIT 1`,
      [userId]
    );
    if (!res.rows.length) return { tier: 'normal', dailyLimit: 1, multiplier: 1, hasPlan: false };
    const price = parseFloat(res.rows[0].price);
    if (price >= 500) return { tier: 'gold',   dailyLimit: 5, multiplier: 2.0, hasPlan: true };
    if (price >= 300) return { tier: 'silver', dailyLimit: 3, multiplier: 1.5, hasPlan: true };
    return { tier: 'normal', dailyLimit: 1, multiplier: 1, hasPlan: true };
  } catch {
    return { tier: 'normal', dailyLimit: 1, multiplier: 1, hasPlan: false };
  }
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
    const { tier, dailyLimit, multiplier, hasPlan } = await getUserTier(userId);

    const segTable = tier === 'gold' ? '"GoldSpinSegment"' : '"SpinSegment"';
    const segs = await pool.query(
      `SELECT id, label, "rewardAmount", color, "sortOrder", "segmentType"
       FROM ${segTable} WHERE "isActive" = true ORDER BY "sortOrder"`
    );

    // No plan → lifetime limit of 1 spin. With plan → 24h rolling window.
    let spinsUsed;
    if (!hasPlan) {
      const r = await pool.query(`SELECT COUNT(*) FROM "UserSpin" WHERE "userId"=$1`, [userId]);
      spinsUsed = parseInt(r.rows[0].count);
    } else {
      const r = await pool.query(
        `SELECT COUNT(*) FROM "UserSpin" WHERE "userId"=$1 AND "spunAt" > now() - interval '24 hours'`,
        [userId]
      );
      spinsUsed = parseInt(r.rows[0].count);
    }

    const bonus = await pool.query(
      `SELECT COUNT(*) FROM "UserBonusSpin" WHERE "userId"=$1 AND "usedAt" IS NULL`,
      [userId]
    );
    const extraSpins = parseInt(bonus.rows[0].count);
    const spinsRemaining = Math.max(0, dailyLimit - spinsUsed);
    const canSpin = spinsRemaining > 0 || extraSpins > 0;

    // Only show countdown timer for plan users (no-plan users see "get a plan" message instead)
    const secondsUntilSpin = (canSpin || !hasPlan) ? 0 : await getSecondsUntilNextSpin(userId);

    res.json({
      segments: segs.rows, canSpin, extraSpins, tier,
      dailyLimit, spinsToday: spinsUsed, spinsRemaining, multiplier,
      secondsUntilSpin, hasPlan,
    });
  } catch (err) {
    console.error('getSpinInfo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function spin(req, res) {
  try {
    const userId = req.user.id;
    const { tier, dailyLimit, multiplier, hasPlan } = await getUserTier(userId);

    let spinsUsed;
    if (!hasPlan) {
      const r = await pool.query(`SELECT COUNT(*) FROM "UserSpin" WHERE "userId"=$1`, [userId]);
      spinsUsed = parseInt(r.rows[0].count);
    } else {
      const r = await pool.query(
        `SELECT COUNT(*) FROM "UserSpin" WHERE "userId"=$1 AND "spunAt" > now() - interval '24 hours'`,
        [userId]
      );
      spinsUsed = parseInt(r.rows[0].count);
    }

    let usedBonusSpin = false;
    if (spinsUsed >= dailyLimit) {
      const bonus = await pool.query(
        `SELECT id FROM "UserBonusSpin" WHERE "userId"=$1 AND "usedAt" IS NULL ORDER BY "awardedAt" LIMIT 1`,
        [userId]
      );
      if (!bonus.rows.length) {
        if (!hasPlan) {
          return res.status(422).json({
            error: 'Activate a plan to get daily free spins!',
            needsPlan: true,
          });
        }
        const secs = await getSecondsUntilNextSpin(userId);
        const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
        return res.status(422).json({
          error: `Next free spin in ${h}h ${m}m.`,
          secondsUntilSpin: secs,
        });
      }
      await pool.query(`UPDATE "UserBonusSpin" SET "usedAt"=now() WHERE id=$1`, [bonus.rows[0].id]);
      usedBonusSpin = true;
    }

    const segTable = tier === 'gold' ? '"GoldSpinSegment"' : '"SpinSegment"';
    const segs = await pool.query(`SELECT * FROM ${segTable} WHERE "isActive"=true ORDER BY "sortOrder"`);
    if (!segs.rows.length) return res.status(422).json({ error: 'Wheel not configured.' });

    const totalW = segs.rows.reduce((s, r) => s + parseFloat(r.weight), 0);
    let rand = Math.random() * totalW;
    let winner = segs.rows[0];
    for (const seg of segs.rows) {
      rand -= parseFloat(seg.weight);
      if (rand <= 0) { winner = seg; break; }
    }
    const winnerIndex = segs.rows.findIndex(s => s.id === winner.id);
    const baseAmount = parseFloat(winner.rewardAmount);
    const finalAmount = (winner.segmentType === 'PRIZE' && baseAmount > 0)
      ? Math.round(baseAmount * multiplier) : baseAmount;

    if (winner.segmentType === 'BONUS_SPIN') {
      await pool.query(`INSERT INTO "UserBonusSpin" ("userId") VALUES ($1)`, [userId]);
    } else if (finalAmount > 0) {
      await walletService.credit(userId, finalAmount, 'SPIN_REWARD', winner.id, `Spin wheel: ${winner.label}`);
    }

    await pool.query(
      `INSERT INTO "UserSpin" ("userId","segmentId","rewardAmount") VALUES ($1,$2,$3)`,
      [userId, winner.id, finalAmount]
    );

    const bonusLeft = await pool.query(
      `SELECT COUNT(*) FROM "UserBonusSpin" WHERE "userId"=$1 AND "usedAt" IS NULL`, [userId]
    );
    const extraSpinsRemaining = parseInt(bonusLeft.rows[0].count);
    const newSpinsUsed = usedBonusSpin ? spinsUsed : spinsUsed + 1;
    const spinsRemaining = Math.max(0, dailyLimit - newSpinsUsed);
    const canSpinAgain = spinsRemaining > 0 || extraSpinsRemaining > 0;
    const secondsUntilSpin = (canSpinAgain || !hasPlan) ? 0 : await getSecondsUntilNextSpin(userId);

    res.json({
      winner: { id: winner.id, label: winner.label, rewardAmount: String(finalAmount), segmentType: winner.segmentType },
      winnerIndex, totalSegments: segs.rows.length,
      usedBonusSpin, extraSpinsRemaining, tier, dailyLimit,
      spinsRemaining, secondsUntilSpin, hasPlan,
    });
  } catch (err) {
    console.error('spin:', err);
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

module.exports = {
  getSpinInfo, spin, redeemCode,
  adminGetSegments, adminUpsertSegment, adminDeleteSegment,
  adminGetGoldSegments, adminUpsertGoldSegment, adminDeleteGoldSegment,
  adminGetCodes, adminCreateCode, adminToggleCode, adminDeleteCode,
};

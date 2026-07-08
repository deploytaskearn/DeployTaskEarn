const pool = require('../db/pool');
const walletService = require('../services/walletService');

async function getSpinInfo(req, res) {
  try {
    const userId = req.user.id;
    const segs = await pool.query(
      `SELECT id, label, "rewardAmount", color, "sortOrder", "segmentType"
       FROM "SpinSegment" WHERE "isActive" = true ORDER BY "sortOrder"`
    );
    const today = await pool.query(
      `SELECT id FROM "UserSpin" WHERE "userId"=$1 AND DATE("spunAt")=CURRENT_DATE`,
      [userId]
    );
    const bonus = await pool.query(
      `SELECT COUNT(*) FROM "UserBonusSpin" WHERE "userId"=$1 AND "usedAt" IS NULL`,
      [userId]
    );
    const extraSpins = parseInt(bonus.rows[0].count);
    const canSpin = today.rows.length === 0 || extraSpins > 0;
    res.json({ segments: segs.rows, canSpin, extraSpins });
  } catch (err) {
    console.error('getSpinInfo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function spin(req, res) {
  try {
    const userId = req.user.id;
    const today = await pool.query(
      `SELECT id FROM "UserSpin" WHERE "userId"=$1 AND DATE("spunAt")=CURRENT_DATE`,
      [userId]
    );

    let usedBonusSpin = false;
    if (today.rows.length > 0) {
      // Check for available bonus spins
      const bonus = await pool.query(
        `SELECT id FROM "UserBonusSpin" WHERE "userId"=$1 AND "usedAt" IS NULL ORDER BY "awardedAt" LIMIT 1`,
        [userId]
      );
      if (!bonus.rows.length) {
        return res.status(422).json({ error: 'Already spun today. Come back tomorrow!' });
      }
      // Mark bonus spin as used
      await pool.query(`UPDATE "UserBonusSpin" SET "usedAt"=now() WHERE id=$1`, [bonus.rows[0].id]);
      usedBonusSpin = true;
    }

    const segs = await pool.query(
      `SELECT * FROM "SpinSegment" WHERE "isActive"=true ORDER BY "sortOrder"`
    );
    if (!segs.rows.length) return res.status(422).json({ error: 'Wheel not configured.' });

    const totalW = segs.rows.reduce((s, r) => s + parseFloat(r.weight), 0);
    let rand = Math.random() * totalW;
    let winner = segs.rows[0];
    for (const seg of segs.rows) {
      rand -= parseFloat(seg.weight);
      if (rand <= 0) { winner = seg; break; }
    }
    const winnerIndex = segs.rows.findIndex(s => s.id === winner.id);

    // Credit prize or award bonus spin
    if (winner.segmentType === 'BONUS_SPIN') {
      await pool.query(
        `INSERT INTO "UserBonusSpin" ("userId") VALUES ($1)`,
        [userId]
      );
    } else if (parseFloat(winner.rewardAmount) > 0) {
      await walletService.credit(
        userId, parseFloat(winner.rewardAmount), 'SPIN_REWARD',
        winner.id, `Spin wheel: ${winner.label}`
      );
    }

    await pool.query(
      `INSERT INTO "UserSpin" ("userId","segmentId","rewardAmount") VALUES ($1,$2,$3)`,
      [userId, winner.id, winner.rewardAmount]
    );

    // Return updated extra spins count
    const bonusLeft = await pool.query(
      `SELECT COUNT(*) FROM "UserBonusSpin" WHERE "userId"=$1 AND "usedAt" IS NULL`,
      [userId]
    );

    res.json({
      winner: { id: winner.id, label: winner.label, rewardAmount: winner.rewardAmount, segmentType: winner.segmentType },
      winnerIndex,
      totalSegments: segs.rows.length,
      usedBonusSpin,
      extraSpinsRemaining: parseInt(bonusLeft.rows[0].count),
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
      `SELECT * FROM "RedeemCode" WHERE UPPER(TRIM(code))=UPPER(TRIM($1)) AND "isActive"=true`,
      [code]
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

// Admin
async function adminGetSegments(req, res) {
  try {
    const r = await pool.query(`SELECT * FROM "SpinSegment" ORDER BY "sortOrder"`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminUpsertSegment(req, res) {
  try {
    const { id, label, rewardAmount, weight, color, isActive, sortOrder, segmentType } = req.body;
    if (id) {
      const r = await pool.query(
        `UPDATE "SpinSegment" SET label=$1,"rewardAmount"=$2,weight=$3,color=$4,"isActive"=$5,"sortOrder"=$6,"segmentType"=$7
         WHERE id=$8 RETURNING *`,
        [label, rewardAmount ?? 0, weight ?? 10, color ?? '#0d2a1a', isActive !== false, sortOrder ?? 0, segmentType || 'PRIZE', id]
      );
      res.json(r.rows[0]);
    } else {
      const r = await pool.query(
        `INSERT INTO "SpinSegment" (label,"rewardAmount",weight,color,"isActive","sortOrder","segmentType")
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [label, rewardAmount ?? 0, weight ?? 10, color ?? '#0d2a1a', isActive !== false, sortOrder ?? 99, segmentType || 'PRIZE']
      );
      res.json(r.rows[0]);
    }
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminDeleteSegment(req, res) {
  try {
    await pool.query(`DELETE FROM "SpinSegment" WHERE id=$1`, [req.params.id]);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
}

async function adminGetCodes(req, res) {
  try {
    const r = await pool.query(`SELECT * FROM "RedeemCode" ORDER BY "createdAt" DESC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
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
  adminGetCodes, adminCreateCode, adminToggleCode, adminDeleteCode,
};

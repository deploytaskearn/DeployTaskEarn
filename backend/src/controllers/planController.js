const pool = require('../db/pool');
const { z } = require('zod');
const walletService = require('../services/walletService');

const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().min(0), // Custom Plan has no fixed price (0) — the user picks their own amount at purchase time
  durationDays: z.number().int().positive().default(30),
  maxEarnings: z.number().positive().optional().nullable(),
  dailyEarning: z.number().positive().optional().nullable(),
  maxUsers: z.number().int().positive().optional().nullable(),
  features: z.array(z.string()).default([]),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  logoUrl: z.string().optional().nullable(),
  dailyTaskLimit: z.number().int().positive().optional().nullable(),
  isCustom: z.boolean().optional().default(false),
  customMinAmount: z.number().positive().optional().nullable(),
  customMaxAmount: z.number().positive().optional().nullable(),
  customReturnPercentage: z.number().positive().optional().nullable(),
});

// Public: list active fixed-price plans (the Custom Plan has its own endpoint
// below since it needs slider/calculator treatment, not a plain price card).
async function listPlans(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM "Plan" WHERE "isActive" = true AND "isCustom" = false ORDER BY "sortOrder" ASC, price ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listPlans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Public: the single active Custom Plan config (amount range + return % +
// duration + daily task limit), or null if none is configured/active.
async function getCustomPlan(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM "Plan" WHERE "isCustom" = true AND "isActive" = true LIMIT 1`
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('getCustomPlan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: list all plans
async function adminListPlans(req, res) {
  try {
    const result = await pool.query(`SELECT * FROM "Plan" ORDER BY "sortOrder" ASC, price ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error('adminListPlans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: create plan
async function createPlan(req, res) {
  try {
    const data = planSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO "Plan" (name, description, price, "durationDays", "maxEarnings", "dailyEarning", "maxUsers", features, "isPopular", "isActive", "sortOrder", "logoUrl", "dailyTaskLimit", "isCustom", "customMinAmount", "customMaxAmount", "customReturnPercentage", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now()) RETURNING *`,
      [data.name, data.description || null, data.price, data.durationDays,
       data.maxEarnings || null, data.dailyEarning || null, data.maxUsers || null,
       JSON.stringify(data.features), data.isPopular, data.isActive, data.sortOrder,
       data.logoUrl || null, data.dailyTaskLimit || null, data.isCustom || false,
       data.customMinAmount || null, data.customMaxAmount || null, data.customReturnPercentage || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    console.error('createPlan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: update plan
async function updatePlan(req, res) {
  try {
    const data = planSchema.partial().parse(req.body);
    const fields = Object.keys(data);
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const setClauses = fields.map((f, i) => {
      if (f === 'features') return `features = $${i + 1}::jsonb`;
      return `"${f}" = $${i + 1}`;
    }).join(', ');
    const values = fields.map((f) => f === 'features' ? JSON.stringify(data[f]) : data[f]);

    const result = await pool.query(
      `UPDATE "Plan" SET ${setClauses}, "updatedAt" = now() WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.errors });
    console.error('updatePlan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: delete plan (force — removes UserPlan records first)
async function deletePlan(req, res) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM "UserPlan" WHERE "planId" = $1', [id]);
    const result = await pool.query('DELETE FROM "Plan" WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Plan not found' });
    res.status(204).send();
  } catch (err) {
    console.error('deletePlan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// User: purchase a plan (deducted from wallet balance)
async function purchasePlan(req, res) {
  const userId = req.user.id;
  const { planId } = req.body;

  if (!planId) return res.status(400).json({ error: 'planId is required' });

  try {
    const planRes = await pool.query(`SELECT * FROM "Plan" WHERE id = $1 AND "isActive" = true`, [planId]);
    if (planRes.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = planRes.rows[0];

    // Check maxUsers limit
    if (plan.maxUsers && plan.currentUsers >= plan.maxUsers) {
      return res.status(422).json({ error: 'This plan is sold out. No more slots available.' });
    }

    // Once a plan is purchased it cannot be bought again (any status)
    const alreadyBought = await pool.query(
      `SELECT up.id FROM "UserPlan" up WHERE up."userId" = $1 AND up."planId" = $2 LIMIT 1`,
      [userId, planId]
    );
    if (alreadyBought.rows.length > 0) {
      return res.status(422).json({ error: 'You have already purchased this plan.' });
    }

    // Debit wallet
    await walletService.debit(userId, plan.price, 'PLAN_PURCHASE', planId, `Subscribed to ${plan.name}`);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const upResult = await pool.query(
      `INSERT INTO "UserPlan" ("userId","planId","amountPaid",status,"startDate","endDate","createdAt")
       VALUES ($1,$2,$3,'ACTIVE',now(),$4,now()) RETURNING *`,
      [userId, planId, plan.price, endDate]
    );
    const userPlan = upResult.rows[0];

    // Increment currentUsers
    await pool.query(`UPDATE "Plan" SET "currentUsers" = "currentUsers" + 1 WHERE id = $1`, [planId]);

    // Pay referral bonus if user was referred
    const userRes = await pool.query(`SELECT "referredById" FROM "User" WHERE id = $1`, [userId]);
    const referredById = userRes.rows[0]?.referredById;
    if (referredById) {
      const referrerRes = await pool.query(`SELECT "referralBonusRate" FROM "User" WHERE id = $1`, [referredById]);
      const customRate = referrerRes.rows[0]?.referralBonusRate;
      const rate = customRate !== null && customRate !== undefined ? parseFloat(customRate) / 100 : 0.05;
      const pct = Math.round(rate * 100);
      const bonus = parseFloat(plan.price) * rate;
      await walletService.credit(
        referredById, bonus, 'REFERRAL_PLAN_BONUS', userPlan.id,
        `${pct}% referral bonus from ${plan.name} purchase`
      );
      await pool.query(
        `UPDATE "UserPlan" SET "referralBonusPaid" = true WHERE id = $1`,
        [userPlan.id]
      );
    }

    res.status(201).json({ userPlan, message: 'Plan activated successfully' });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_BALANCE') {
      return res.status(422).json({ error: 'Insufficient wallet balance. Please deposit first.' });
    }
    console.error('purchasePlan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// User: activate the Custom Plan with a self-chosen amount. Unlike fixed
// plans, this is a percentage-return investment: the user gets their amount
// back PLUS customReturnPercentage/100 profit on top (total payout = amount
// * (1 + pct/100)), spread evenly across durationDays and then across
// dailyTaskLimit tasks/day. The per-task rate is locked in at purchase time
// so a later admin rate change never affects a plan already bought.
// Repurchasing is allowed once the previous custom plan expires.
async function purchaseCustomPlan(req, res) {
  const userId = req.user.id;
  const amount = parseFloat(req.body?.amount);

  if (!amount || amount <= 0) return res.status(400).json({ error: 'A valid amount is required' });

  try {
    const planRes = await pool.query(`SELECT * FROM "Plan" WHERE "isCustom" = true AND "isActive" = true LIMIT 1`);
    if (planRes.rows.length === 0) return res.status(404).json({ error: 'Custom Plan is not available right now.' });
    const plan = planRes.rows[0];

    const minAmount = parseFloat(plan.customMinAmount || 0);
    const maxAmount = parseFloat(plan.customMaxAmount || 0);
    if (amount < minAmount || amount > maxAmount) {
      return res.status(400).json({ error: `Amount must be between Rs ${minAmount.toLocaleString()} and Rs ${maxAmount.toLocaleString()}.` });
    }

    // Only one active Custom Plan subscription at a time — repurchase is fine
    // once the current one expires.
    const activeExisting = await pool.query(
      `SELECT id FROM "UserPlan" WHERE "userId" = $1 AND "planId" = $2
       AND status = 'ACTIVE' AND ("endDate" IS NULL OR "endDate" > now()) LIMIT 1`,
      [userId, plan.id]
    );
    if (activeExisting.rows.length > 0) {
      return res.status(422).json({ error: 'You already have an active Custom Plan.' });
    }

    const durationDays = plan.durationDays || 30;
    const dailyTaskLimit = plan.dailyTaskLimit || 1;
    const returnPct = parseFloat(plan.customReturnPercentage || 0) / 100;
    const profit = amount * returnPct;
    const totalPayout = amount + profit; // principal back + profit, not profit alone
    const perDayEarning = totalPayout / durationDays;
    const perTaskEarning = perDayEarning / dailyTaskLimit;

    await walletService.debit(userId, amount, 'PLAN_PURCHASE', plan.id, `Subscribed to ${plan.name} (Rs ${amount.toLocaleString()})`);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    const upResult = await pool.query(
      `INSERT INTO "UserPlan" ("userId","planId","amountPaid",status,"startDate","endDate","customAmount","customPerTaskEarning","createdAt")
       VALUES ($1,$2,$3,'ACTIVE',now(),$4,$5,$6,now()) RETURNING *`,
      [userId, plan.id, amount, endDate, amount, perTaskEarning]
    );
    const userPlan = upResult.rows[0];

    await pool.query(`UPDATE "Plan" SET "currentUsers" = "currentUsers" + 1 WHERE id = $1`, [plan.id]);

    // Pay referral bonus based on the amount actually paid (same rate/logic as fixed plans)
    const userRes = await pool.query(`SELECT "referredById" FROM "User" WHERE id = $1`, [userId]);
    const referredById = userRes.rows[0]?.referredById;
    if (referredById) {
      const referrerRes = await pool.query(`SELECT "referralBonusRate" FROM "User" WHERE id = $1`, [referredById]);
      const customRate = referrerRes.rows[0]?.referralBonusRate;
      const rate = customRate !== null && customRate !== undefined ? parseFloat(customRate) / 100 : 0.05;
      const pct = Math.round(rate * 100);
      const bonus = amount * rate;
      await walletService.credit(
        referredById, bonus, 'REFERRAL_PLAN_BONUS', userPlan.id,
        `${pct}% referral bonus from ${plan.name} purchase`
      );
      await pool.query(`UPDATE "UserPlan" SET "referralBonusPaid" = true WHERE id = $1`, [userPlan.id]);
    }

    res.status(201).json({
      userPlan,
      profit,
      totalPayout,
      perDayEarning,
      perTaskEarning,
      message: 'Custom Plan activated successfully',
    });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_BALANCE') {
      return res.status(422).json({ error: 'Insufficient wallet balance. Please deposit first.' });
    }
    console.error('purchaseCustomPlan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// User: get my active plan
async function getMyPlan(req, res) {
  try {
    const result = await pool.query(
      `SELECT up.*, p.name as "planName", p.features, p."maxEarnings", p."durationDays"
       FROM "UserPlan" up
       JOIN "Plan" p ON p.id = up."planId"
       WHERE up."userId" = $1 AND up.status = 'ACTIVE'
       ORDER BY up."createdAt" DESC LIMIT 1`,
      [req.user.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('getMyPlan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// User: get all my active plan IDs
async function getMyPlans(req, res) {
  try {
    const result = await pool.query(
      `SELECT up."planId" FROM "UserPlan" up WHERE up."userId" = $1 AND up.status = 'ACTIVE'`,
      [req.user.id]
    );
    res.json(result.rows.map((r) => r.planId));
  } catch (err) {
    console.error('getMyPlans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// User: get all ever-purchased plan IDs (any status)
async function getMyPurchasedPlanIds(req, res) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT "planId" FROM "UserPlan" WHERE "userId" = $1`,
      [req.user.id]
    );
    res.json(result.rows.map((r) => r.planId));
  } catch (err) {
    console.error('getMyPurchasedPlanIds error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// User: referral stats
async function getReferralStats(req, res) {
  try {
    const userId = req.user.id;
    const userRes = await pool.query(`SELECT "referralCode", "referralBonusRate" FROM "User" WHERE id = $1`, [userId]);
    const referralCode = userRes.rows[0]?.referralCode;
    const rawRate = userRes.rows[0]?.referralBonusRate;
    const bonusRate = rawRate !== null && rawRate !== undefined ? parseFloat(rawRate) : 5;

    const referralsRes = await pool.query(
      `SELECT COUNT(*) as count FROM "User" WHERE "referredById" = $1`, [userId]
    );
    const bonusRes = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM "LedgerEntry"
       WHERE "userId" = $1 AND type = 'REFERRAL_PLAN_BONUS'`, [userId]
    );

    res.json({
      referralCode,
      bonusRate,
      totalReferrals: parseInt(referralsRes.rows[0].count),
      totalBonusEarned: parseFloat(bonusRes.rows[0].total),
    });
  } catch (err) {
    console.error('getReferralStats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// User: detailed referral breakdown — referred users + bonus earnings
async function getReferralDetails(req, res) {
  try {
    const userId = req.user.id;

    // People who registered with this user's referral code
    const usersRes = await pool.query(
      `SELECT u.id, u.name, u."createdAt" as "joinedAt",
              COALESCE((SELECT COUNT(*) FROM "UserPlan" up WHERE up."userId" = u.id), 0) as "plansBought"
       FROM "User" u
       WHERE u."referredById" = $1
       ORDER BY u."createdAt" DESC`,
      [userId]
    );

    // Referral bonus credits from ledger
    const bonusRes = await pool.query(
      `SELECT le.id, le.amount, le."createdAt", le.note,
              u.name as "referredUserName",
              p.name as "planName"
       FROM "LedgerEntry" le
       JOIN "UserPlan" up ON up.id::text = le."referenceId"
       JOIN "User" u ON u.id = up."userId"
       JOIN "Plan" p ON p.id = up."planId"
       WHERE le."userId" = $1 AND le.type = 'REFERRAL_PLAN_BONUS'
       ORDER BY le."createdAt" DESC`,
      [userId]
    );

    res.json({
      referredUsers: usersRes.rows,
      bonuses: bonusRes.rows,
    });
  } catch (err) {
    console.error('getReferralDetails error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: full referral overview — commissions paid + unlinked referrals
async function adminGetReferrals(req, res) {
  try {
    // All referral bonus credits already paid
    const paidRes = await pool.query(
      `SELECT
         le.id, le.amount as "commissionAmount", le."createdAt",
         referrer.name as "referrerName", referrer.email as "referrerEmail",
         referrer."referralBonusRate" as "referrerRate",
         referred.name as "referredName", referred.email as "referredEmail",
         p.name as "planName", p.price as "planPrice"
       FROM "LedgerEntry" le
       JOIN "User" referrer ON referrer.id = le."userId"
       JOIN "UserPlan" up ON up.id::text = le."referenceId"
       JOIN "User" referred ON referred.id = up."userId"
       JOIN "Plan" p ON p.id = up."planId"
       WHERE le.type = 'REFERRAL_PLAN_BONUS'
       ORDER BY le."createdAt" DESC`
    );

    // Users registered via referral but commission not yet paid (no plan bought)
    const pendingRes = await pool.query(
      `SELECT
         referred.id as "referredId", referred.name as "referredName", referred.email as "referredEmail",
         referred."createdAt" as "joinedAt",
         referrer.id as "referrerId", referrer.name as "referrerName", referrer.email as "referrerEmail",
         referrer."referralCode", referrer."referralBonusRate" as "referrerRate",
         COALESCE((SELECT COUNT(*) FROM "UserPlan" up WHERE up."userId" = referred.id), 0) as "plansBought"
       FROM "User" referred
       JOIN "User" referrer ON referrer.id = referred."referredById"
       ORDER BY referred."createdAt" DESC`
    );

    res.json({
      paid: paidRes.rows,
      registered: pendingRes.rows,
    });
  } catch (err) {
    console.error('adminGetReferrals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// User: their own progress against the "3 referrals in 20 days" hold rule,
// for a dashboard reminder banner/ticker. Cheap enough to call on every
// dashboard load — single-row lookup, no admin-only data exposed.
async function getMyReferralHoldStatus(req, res) {
  try {
    const { isEnabled, HOLD_RULE_START_DATE, HOLD_WINDOW_DAYS, REQUIRED_ACTIVATED_REFERRALS } = require('../jobs/referralHoldJob');

    const [enabled, userRes] = await Promise.all([
      isEnabled(),
      pool.query(
        `SELECT u.status, u."createdAt",
                (SELECT COUNT(DISTINCT r.id) FROM "User" r WHERE r."referredById" = u.id
                   AND EXISTS (SELECT 1 FROM "UserPlan" up WHERE up."userId" = r.id)) as "activatedReferrals"
         FROM "User" u WHERE u.id = $1`,
        [req.user.id]
      ),
    ]);

    const row = userRes.rows[0];
    const createdAt = new Date(row.createdAt);
    const ruleApplies = enabled && createdAt >= new Date(HOLD_RULE_START_DATE);
    const activatedReferrals = parseInt(row.activatedReferrals, 10);
    const deadline = new Date(createdAt.getTime() + HOLD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

    res.json({
      ruleApplies,
      isOnHold: row.status === 'HOLD',
      activatedReferrals,
      requiredReferrals: REQUIRED_ACTIVATED_REFERRALS,
      windowDays: HOLD_WINDOW_DAYS,
      daysRemaining,
      met: activatedReferrals >= REQUIRED_ACTIVATED_REFERRALS,
    });
  } catch (err) {
    console.error('getMyReferralHoldStatus error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: overview of the "3 referrals in 20 days" hold rule — whether it's
// enabled, and every user's progress against it.
async function adminGetReferralHoldOverview(req, res) {
  try {
    const { isEnabled, HOLD_RULE_START_DATE, HOLD_WINDOW_DAYS, REQUIRED_ACTIVATED_REFERRALS } = require('../jobs/referralHoldJob');

    const [enabled, usersRes] = await Promise.all([
      isEnabled(),
      pool.query(
        `SELECT u.id, u.name, u.email, u.status, u."createdAt",
                (SELECT COUNT(*) FROM "User" r WHERE r."referredById" = u.id) as "totalReferrals",
                (SELECT COUNT(DISTINCT r.id) FROM "User" r WHERE r."referredById" = u.id
                   AND EXISTS (SELECT 1 FROM "UserPlan" up WHERE up."userId" = r.id)) as "activatedReferrals"
         FROM "User" u
         WHERE u.role = 'USER'
         ORDER BY u."createdAt" DESC`
      ),
    ]);

    res.json({
      enabled,
      ruleStartDate: HOLD_RULE_START_DATE,
      windowDays: HOLD_WINDOW_DAYS,
      requiredReferrals: REQUIRED_ACTIVATED_REFERRALS,
      users: usersRes.rows,
    });
  } catch (err) {
    console.error('adminGetReferralHoldOverview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: manually link referredById + credit missed bonus for all existing plans
async function adminLinkReferral(req, res) {
  try {
    const { referredUserId, referrerId, creditBonus } = req.body;
    if (!referredUserId || !referrerId) {
      return res.status(400).json({ error: 'referredUserId and referrerId are required' });
    }

    // Set referredById
    const updateRes = await pool.query(
      `UPDATE "User" SET "referredById" = $1 WHERE id = $2 AND ("referredById" IS NULL OR "referredById" != $1) RETURNING id`,
      [referrerId, referredUserId]
    );

    let credited = 0;
    if (creditBonus) {
      // Find all plans this user bought that don't already have a bonus paid
      const plansRes = await pool.query(
        `SELECT up.id, up."planId", p.price, p.name as "planName"
         FROM "UserPlan" up
         JOIN "Plan" p ON p.id = up."planId"
         WHERE up."userId" = $1
         AND NOT EXISTS (
           SELECT 1 FROM "LedgerEntry" le
           WHERE le."referenceId" = up.id::text AND le.type = 'REFERRAL_PLAN_BONUS' AND le."userId" = $2
         )`,
        [referredUserId, referrerId]
      );

      const referrerRes = await pool.query(
        `SELECT "referralBonusRate" FROM "User" WHERE id = $1`, [referrerId]
      );
      const rawRate = referrerRes.rows[0]?.referralBonusRate;
      const rate = rawRate !== null && rawRate !== undefined ? parseFloat(rawRate) / 100 : 0.05;
      const pct = Math.round(rate * 100);

      for (const plan of plansRes.rows) {
        const bonus = parseFloat(plan.price) * rate;
        if (bonus > 0) {
          await walletService.credit(
            referrerId, bonus, 'REFERRAL_PLAN_BONUS', plan.id,
            `${pct}% referral bonus from ${plan.planName} purchase (manual)`
          );
          await pool.query(
            `UPDATE "UserPlan" SET "referralBonusPaid" = true WHERE id = $1`, [plan.id]
          );
          credited += bonus;
        }
      }
    }

    res.json({ ok: true, linked: updateRes.rowCount > 0, credited });
  } catch (err) {
    console.error('adminLinkReferral error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: link referral by email and optionally credit missed bonus
async function adminLinkReferralByEmail(req, res) {
  try {
    const { referredEmail, referrerEmail, creditBonus } = req.body;
    if (!referredEmail || !referrerEmail) {
      return res.status(400).json({ error: 'referredEmail and referrerEmail are required' });
    }

    const referredRes = await pool.query(
      `SELECT id, name FROM "User" WHERE LOWER(email) = LOWER($1)`, [referredEmail]
    );
    if (referredRes.rows.length === 0) return res.status(404).json({ error: `User not found: ${referredEmail}` });

    const referrerRes2 = await pool.query(
      `SELECT id, name, "referralBonusRate" FROM "User" WHERE LOWER(email) = LOWER($1)`, [referrerEmail]
    );
    if (referrerRes2.rows.length === 0) return res.status(404).json({ error: `Referrer not found: ${referrerEmail}` });

    const referredUserId = referredRes.rows[0].id;
    const referrerId = referrerRes2.rows[0].id;

    await pool.query(
      `UPDATE "User" SET "referredById" = $1 WHERE id = $2`, [referrerId, referredUserId]
    );

    let credited = 0;
    if (creditBonus) {
      const rawRate = referrerRes2.rows[0].referralBonusRate;
      const rate = rawRate !== null && rawRate !== undefined ? parseFloat(rawRate) / 100 : 0.05;
      const pct = Math.round(rate * 100);

      const plansRes = await pool.query(
        `SELECT up.id, up."planId", p.price, p.name as "planName"
         FROM "UserPlan" up JOIN "Plan" p ON p.id = up."planId"
         WHERE up."userId" = $1
         AND NOT EXISTS (
           SELECT 1 FROM "LedgerEntry" le
           WHERE le."referenceId" = up.id::text AND le.type = 'REFERRAL_PLAN_BONUS' AND le."userId" = $2
         )`,
        [referredUserId, referrerId]
      );

      for (const plan of plansRes.rows) {
        const bonus = parseFloat(plan.price) * rate;
        if (bonus > 0) {
          await walletService.credit(
            referrerId, bonus, 'REFERRAL_PLAN_BONUS', plan.id,
            `${pct}% referral bonus from ${plan.planName} purchase (manual)`
          );
          await pool.query(`UPDATE "UserPlan" SET "referralBonusPaid" = true WHERE id = $1`, [plan.id]);
          credited += bonus;
        }
      }
    }

    res.json({
      ok: true,
      referredUser: referredRes.rows[0].name,
      referrer: referrerRes2.rows[0].name,
      credited,
    });
  } catch (err) {
    console.error('adminLinkReferralByEmail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: get tasks assigned to a plan
async function getPlanTasks(req, res) {
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t."rewardAmount", t."planTier", tc.name as "categoryName"
       FROM "PlanTask" pt
       JOIN "Task" t ON t.id = pt."taskId"
       LEFT JOIN "TaskCategory" tc ON tc.id = t."categoryId"
       WHERE pt."planId" = $1
       ORDER BY t.title`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getPlanTasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: assign a task to a plan
async function addPlanTask(req, res) {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });
    await pool.query(
      `INSERT INTO "PlanTask" ("planId","taskId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.params.id, taskId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('addPlanTask error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: remove a task from a plan
async function removePlanTask(req, res) {
  try {
    await pool.query(
      `DELETE FROM "PlanTask" WHERE "planId"=$1 AND "taskId"=$2`,
      [req.params.id, req.params.taskId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('removePlanTask error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listPlans, getCustomPlan, adminListPlans, createPlan, updatePlan, deletePlan, purchasePlan, purchaseCustomPlan, getMyPlan, getMyPlans, getMyPurchasedPlanIds, getReferralStats, getReferralDetails, getMyReferralHoldStatus, adminGetReferrals, adminGetReferralHoldOverview, adminLinkReferral, adminLinkReferralByEmail, getPlanTasks, addPlanTask, removePlanTask };

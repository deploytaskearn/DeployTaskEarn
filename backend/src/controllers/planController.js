const pool = require('../db/pool');
const { z } = require('zod');
const walletService = require('../services/walletService');

const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
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
});

// Public: list active plans
async function listPlans(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM "Plan" WHERE "isActive" = true ORDER BY "sortOrder" ASC, price ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listPlans error:', err);
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
      `INSERT INTO "Plan" (name, description, price, "durationDays", "maxEarnings", "dailyEarning", "maxUsers", features, "isPopular", "isActive", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now()) RETURNING *`,
      [data.name, data.description || null, data.price, data.durationDays,
       data.maxEarnings || null, data.dailyEarning || null, data.maxUsers || null,
       JSON.stringify(data.features), data.isPopular, data.isActive, data.sortOrder]
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

    // Only 1 active plan allowed at a time
    const anyActive = await pool.query(
      `SELECT up.id, p.name FROM "UserPlan" up JOIN "Plan" p ON p.id = up."planId"
       WHERE up."userId" = $1 AND up.status = 'ACTIVE' LIMIT 1`,
      [userId]
    );
    if (anyActive.rows.length > 0) {
      return res.status(422).json({
        error: `You already have the "${anyActive.rows[0].name}" plan active. It must expire before you can buy a new one.`,
      });
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

// User: referral stats
async function getReferralStats(req, res) {
  try {
    const userId = req.user.id;
    const userRes = await pool.query(`SELECT "referralCode" FROM "User" WHERE id = $1`, [userId]);
    const referralCode = userRes.rows[0]?.referralCode;

    const referralsRes = await pool.query(
      `SELECT COUNT(*) as count FROM "User" WHERE "referredById" = $1`, [userId]
    );
    const bonusRes = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM "LedgerEntry"
       WHERE "userId" = $1 AND type = 'REFERRAL_PLAN_BONUS'`, [userId]
    );

    res.json({
      referralCode,
      totalReferrals: parseInt(referralsRes.rows[0].count),
      totalBonusEarned: parseFloat(bonusRes.rows[0].total),
    });
  } catch (err) {
    console.error('getReferralStats error:', err);
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

module.exports = { listPlans, adminListPlans, createPlan, updatePlan, deletePlan, purchasePlan, getMyPlan, getMyPlans, getReferralStats, getPlanTasks, addPlanTask, removePlanTask };

const { z } = require('zod');
const pool = require('../db/pool');
const walletService = require('../services/walletService');

// ───────────── DASHBOARD STATS ─────────────

async function dashboardStats(req, res) {
  try {
    const [users, deposits, withdrawals, tasks, pendingSubmissions, pendingDeposits, pendingWithdrawals] =
      await Promise.all([
        pool.query('SELECT COUNT(*) FROM "User" WHERE role = \'USER\''),
        pool.query('SELECT COALESCE(SUM(amount),0) as total FROM "Deposit" WHERE status = \'APPROVED\''),
        pool.query('SELECT COALESCE(SUM(amount),0) as total FROM "Withdrawal" WHERE status = \'PAID\''),
        pool.query('SELECT COUNT(*) FROM "Task" WHERE status = \'ACTIVE\''),
        pool.query('SELECT COUNT(*) FROM "TaskSubmission" WHERE status = \'PENDING\''),
        pool.query('SELECT COUNT(*) FROM "Deposit" WHERE status = \'PENDING\''),
        pool.query('SELECT COUNT(*) FROM "Withdrawal" WHERE status = \'PENDING\''),
      ]);

    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalDeposited: parseFloat(deposits.rows[0].total),
      totalWithdrawn: parseFloat(withdrawals.rows[0].total),
      activeTasks: parseInt(tasks.rows[0].count),
      pendingTaskSubmissions: parseInt(pendingSubmissions.rows[0].count),
      pendingDeposits: parseInt(pendingDeposits.rows[0].count),
      pendingWithdrawals: parseInt(pendingWithdrawals.rows[0].count),
    });
  } catch (err) {
    console.error('dashboardStats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── USER MANAGEMENT ─────────────

async function listUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u."referralBonusRate", u."createdAt",
              w.balance, w.currency
       FROM "User" u LEFT JOIN "Wallet" w ON w."userId" = u.id
       ORDER BY u."createdAt" DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body; // ACTIVE | SUSPENDED | BANNED
    if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await pool.query(
      'UPDATE "User" SET status = $1, "updatedAt" = now() WHERE id = $2 RETURNING id, name, email, status',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateUserStatus error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function setReferralRate(req, res) {
  try {
    const { id } = req.params;
    const { rate } = req.body; // number 0-100 or null to reset
    if (rate !== null && rate !== undefined) {
      const r = parseFloat(rate);
      if (isNaN(r) || r < 0 || r > 100) {
        return res.status(400).json({ error: 'Rate must be between 0 and 100' });
      }
    }
    const result = await pool.query(
      'UPDATE "User" SET "referralBonusRate" = $1, "updatedAt" = now() WHERE id = $2 RETURNING id, name, "referralBonusRate"',
      [rate === null || rate === undefined ? null : parseFloat(rate), id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('setReferralRate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const userRes = await pool.query('SELECT id, role FROM "User" WHERE id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (userRes.rows[0].role === 'ADMIN') return res.status(403).json({ error: 'Cannot delete admin users' });

    await pool.query('DELETE FROM "LedgerEntry" WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM "TaskSubmission" WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM "Deposit" WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM "Withdrawal" WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM "UserPlan" WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM "Wallet" WHERE "userId" = $1', [id]);
    await pool.query('UPDATE "User" SET "referredById" = NULL WHERE "referredById" = $1', [id]);
    await pool.query('DELETE FROM "User" WHERE id = $1', [id]);

    res.status(204).send();
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adjustUserBalance(req, res) {
  try {
    const { id } = req.params;
    const { amount, direction, note } = req.body; // direction: 'CREDIT' | 'DEBIT'

    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

    if (direction === 'CREDIT') {
      await walletService.credit(id, amount, 'ADMIN_ADJUSTMENT', null, note || 'Manual admin adjustment');
    } else if (direction === 'DEBIT') {
      await walletService.debit(id, amount, 'ADMIN_ADJUSTMENT', null, note || 'Manual admin adjustment');
    } else {
      return res.status(400).json({ error: 'direction must be CREDIT or DEBIT' });
    }

    const balance = await walletService.getBalance(id);
    res.json(balance);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient balance for debit' });
    }
    console.error('adjustUserBalance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── TASK MANAGEMENT ─────────────

const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  instructions: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  categoryName: z.string().optional(),
  source: z.enum(['MANUAL', 'CPA_NETWORK']).default('MANUAL'),
  cpaNetworkName: z.string().optional(),
  cpaOfferId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  rewardAmount: z.coerce.number().positive(),
  requiresProof: z.boolean().default(true),
  maxCompletions: z.coerce.number().int().positive().optional(),
  expiresAt: z.string().optional(),
  planTier: z.coerce.number().int().min(0).default(0),
});

async function createTask(req, res) {
  try {
    const data = taskSchema.parse(req.body);

    // Resolve categoryId from name if provided
    let categoryId = data.categoryId || null;
    if (!categoryId && data.categoryName?.trim()) {
      const name = data.categoryName.trim();
      const existing = await pool.query('SELECT id FROM "TaskCategory" WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
      if (existing.rows.length > 0) {
        categoryId = existing.rows[0].id;
      } else {
        const created = await pool.query(
          'INSERT INTO "TaskCategory" (id, name, slug, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, now(), now()) RETURNING id',
          [name, name.toLowerCase().replace(/\s+/g, '-')]
        );
        categoryId = created.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO "Task"
        (id, title, description, instructions, "categoryId", source, "cpaNetworkName", "cpaOfferId",
         "externalUrl", "rewardAmount", "requiresProof", "maxCompletions", "expiresAt", "planTier", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVE', now(), now())
       RETURNING *`,
      [
        data.title, data.description, data.instructions || null, categoryId,
        data.source, data.cpaNetworkName || null, data.cpaOfferId || null, data.externalUrl || null,
        data.rewardAmount, data.requiresProof, data.maxCompletions || null, data.expiresAt || null,
        data.planTier,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('createTask error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function bulkCreateTasks(req, res) {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Send an array of tasks' });
  if (items.length > 100)
    return res.status(400).json({ error: 'Max 100 tasks per bulk request' });

  const results = { created: 0, failed: [] };

  for (let i = 0; i < items.length; i++) {
    try {
      const data = taskSchema.parse(items[i]);
      let categoryId = data.categoryId || null;
      if (!categoryId && data.categoryName?.trim()) {
        const name = data.categoryName.trim();
        const existing = await pool.query('SELECT id FROM "TaskCategory" WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
        if (existing.rows.length > 0) {
          categoryId = existing.rows[0].id;
        } else {
          const created = await pool.query(
            'INSERT INTO "TaskCategory" (id, name, slug, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, now(), now()) RETURNING id',
            [name, name.toLowerCase().replace(/\s+/g, '-')]
          );
          categoryId = created.rows[0].id;
        }
      }
      await pool.query(
        `INSERT INTO "Task"
          (id, title, description, instructions, "categoryId", source, "cpaNetworkName", "cpaOfferId",
           "externalUrl", "rewardAmount", "requiresProof", "maxCompletions", "expiresAt", "planTier", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVE', now(), now())`,
        [
          data.title, data.description, data.instructions || null, categoryId,
          data.source, data.cpaNetworkName || null, data.cpaOfferId || null, data.externalUrl || null,
          data.rewardAmount, data.requiresProof, data.maxCompletions || null, data.expiresAt || null,
          data.planTier,
        ]
      );
      results.created++;
    } catch (err) {
      results.failed.push({ index: i, error: err.name === 'ZodError' ? 'Validation failed' : err.message });
    }
  }

  res.status(201).json(results);
}

async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const data = taskSchema.partial().parse(req.body);

    const fields = Object.keys(data);
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const setClauses = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
    const values = fields.map((f) => data[f]);

    const result = await pool.query(
      `UPDATE "Task" SET ${setClauses}, "updatedAt" = now() WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('updateTask error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    // Remove related records first to avoid FK constraint errors
    await pool.query('DELETE FROM "TaskSubmission" WHERE "taskId" = $1', [id]);
    await pool.query('DELETE FROM "PlanTask" WHERE "taskId" = $1', [id]);
    const result = await pool.query('DELETE FROM "Task" WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    res.status(204).send();
  } catch (err) {
    console.error('deleteTask error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listAllTasksAdmin(req, res) {
  try {
    const result = await pool.query(
      `SELECT t.*, tc.name as "categoryName" FROM "Task" t
       LEFT JOIN "TaskCategory" tc ON tc.id = t."categoryId"
       ORDER BY t."createdAt" DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listAllTasksAdmin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── TASK SUBMISSION REVIEW ─────────────

async function listSubmissions(req, res) {
  try {
    const { status } = req.query;
    let query = `
      SELECT ts.*, t.title as "taskTitle", t."rewardAmount", u.name as "userName", u.email as "userEmail"
      FROM "TaskSubmission" ts
      JOIN "Task" t ON t.id = ts."taskId"
      JOIN "User" u ON u.id = ts."userId"
    `;
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE ts.status = $${params.length}`;
    }
    query += ' ORDER BY ts."createdAt" DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('listSubmissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function reviewSubmission(req, res) {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // 'APPROVE' | 'REJECT'

    const subResult = await pool.query(
      `SELECT ts.*, t."rewardAmount" FROM "TaskSubmission" ts
       JOIN "Task" t ON t.id = ts."taskId" WHERE ts.id = $1`,
      [id]
    );
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const submission = subResult.rows[0];

    if (submission.status !== 'PENDING') {
      return res.status(400).json({ error: 'Submission already reviewed' });
    }

    if (action === 'APPROVE') {
      await walletService.credit(
        submission.userId,
        parseFloat(submission.rewardAmount),
        'TASK_EARNING',
        submission.id,
        'Task submission approved'
      );
      await pool.query(
        `UPDATE "TaskSubmission" SET status = 'APPROVED', "reviewedById" = $1, "reviewNote" = $2,
         "rewardPaid" = $3, "reviewedAt" = now() WHERE id = $4`,
        [req.user.id, note || null, submission.rewardAmount, id]
      );
      await pool.query('UPDATE "Task" SET "completedCount" = "completedCount" + 1 WHERE id = $1', [submission.taskId]);

      // Award 10 coins per task; every 500 coins = 3 bonus spins
      const COINS_PER_TASK = 10;
      const COIN_MILESTONE = 500;
      const SPINS_PER_MILESTONE = 3;
      const coinRow = await pool.query(`SELECT coins FROM "UserCoin" WHERE "userId"=$1`, [submission.userId]);
      const oldCoins = coinRow.rows.length ? coinRow.rows[0].coins : 0;
      const newCoins = oldCoins + COINS_PER_TASK;
      await pool.query(
        `INSERT INTO "UserCoin" ("userId", coins) VALUES ($1, $2)
         ON CONFLICT ("userId") DO UPDATE SET coins=$2, "updatedAt"=now()`,
        [submission.userId, newCoins]
      );
      const milestonesEarned = Math.floor(newCoins / COIN_MILESTONE) - Math.floor(oldCoins / COIN_MILESTONE);
      for (let i = 0; i < milestonesEarned * SPINS_PER_MILESTONE; i++) {
        await pool.query(`INSERT INTO "UserBonusSpin" ("userId") VALUES ($1)`, [submission.userId]);
      }
    } else if (action === 'REJECT') {
      await pool.query(
        `UPDATE "TaskSubmission" SET status = 'REJECTED', "reviewedById" = $1, "reviewNote" = $2, "reviewedAt" = now() WHERE id = $3`,
        [req.user.id, note || null, id]
      );
    } else {
      return res.status(400).json({ error: 'action must be APPROVE or REJECT' });
    }

    const updated = await pool.query('SELECT * FROM "TaskSubmission" WHERE id = $1', [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('reviewSubmission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  dashboardStats,
  listUsers,
  updateUserStatus,
  deleteUser,
  setReferralRate,
  adjustUserBalance,
  createTask,
  bulkCreateTasks,
  updateTask,
  deleteTask,
  listAllTasksAdmin,
  listSubmissions,
  reviewSubmission,
};

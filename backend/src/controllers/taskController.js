const { z } = require('zod');
const pool = require('../db/pool');
const walletService = require('../services/walletService');
const { approveSubmission } = require('../services/taskApprovalService');
const { notifyAdmin } = require('../utils/adminNotify');

async function listTasks(req, res) {
  try {
    const { categoryId } = req.query;
    const userId = req.user.id;

    // Get user's active plan IDs
    const planRes = await pool.query(
      `SELECT "planId" FROM "UserPlan" WHERE "userId" = $1 AND status = 'ACTIVE'
       AND ("endDate" IS NULL OR "endDate" > now())`,
      [userId]
    );
    const userPlanIds = planRes.rows.map((r) => r.planId);

    // Show:
    //   - Free tasks (not assigned to any plan) → visible to everyone
    //   - Plan tasks → only visible if user has that plan
    let query = `
      WITH plan_info AS (
        SELECT pt."taskId",
          bool_or(pt."planId" = ANY($2::uuid[])) as "userHasPlan",
          MIN(p.name) as "planName",
          MIN(p.id::text) as "taskPlanId"
        FROM "PlanTask" pt
        JOIN "Plan" p ON p.id = pt."planId"
        GROUP BY pt."taskId"
      )
      SELECT t.*, tc.name as "categoryName",
        pi."userHasPlan",
        pi."planName",
        pi."taskPlanId",
        (pi."taskId" IS NULL) as "isFreeTask",
        (
          SELECT ts.status FROM "TaskSubmission" ts
          WHERE ts."taskId" = t.id AND ts."userId" = $1
          LIMIT 1
        ) as "submissionStatus",
        EXISTS(
          SELECT 1 FROM "TaskSubmission" ts
          WHERE ts."taskId" = t.id AND ts."userId" = $1
        ) as "alreadySubmitted"
      FROM "Task" t
      LEFT JOIN "TaskCategory" tc ON tc.id = t."categoryId"
      LEFT JOIN plan_info pi ON pi."taskId" = t.id
      WHERE t.status = 'ACTIVE'
        AND (t."expiresAt" IS NULL OR t."expiresAt" > now())
        AND (
          pi."taskId" IS NULL
          OR pi."userHasPlan" = true
        )
    `;
    const params = [userId, userPlanIds];

    if (categoryId) {
      params.push(categoryId);
      query += ` AND t."categoryId" = $${params.length}`;
    }

    // Free tasks first, then plan tasks ordered by plan name
    query += ` ORDER BY (pi."taskId" IS NULL) DESC, pi."planName" ASC, t."createdAt" DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('listTasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getTask(req, res) {
  try {
    const result = await pool.query('SELECT * FROM "Task" WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getTask error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function submitTask(req, res) {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;

    const taskResult = await pool.query('SELECT * FROM "Task" WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const task = taskResult.rows[0];

    if (task.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Task is not currently active' });
    }

    const existing = await pool.query(
      'SELECT 1 FROM "TaskSubmission" WHERE "taskId" = $1 AND "userId" = $2',
      [taskId, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'You already completed this task' });
    }

    // Validate proof if task requires it
    const proofText = req.body?.proofText?.trim() || null;
    const proofFileUrl = req.file ? `/uploads/proofs/${req.file.filename}` : null;
    if (task.requiresProof && !proofText && !proofFileUrl) {
      return res.status(400).json({ error: 'Proof is required for this task (screenshot or description).' });
    }

    // A task with PlanTask rows belongs to one or more plans — only members of
    // one of those plans may submit it, and their submission auto-approves.
    // Free tasks (no PlanTask rows) still require manual admin review.
    const planLinks = await pool.query('SELECT "planId" FROM "PlanTask" WHERE "taskId" = $1', [taskId]);
    const isPlanTask = planLinks.rows.length > 0;

    if (isPlanTask) {
      const planIds = planLinks.rows.map((r) => r.planId);
      const ownsPlan = await pool.query(
        `SELECT 1 FROM "UserPlan" WHERE "userId" = $1 AND "planId" = ANY($2::uuid[])
         AND status = 'ACTIVE' AND ("endDate" IS NULL OR "endDate" > now()) LIMIT 1`,
        [userId, planIds]
      );
      if (ownsPlan.rows.length === 0) {
        return res.status(403).json({ error: 'You need an active plan to submit this task.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO "TaskSubmission"
         (id, "taskId", "userId", status, "proofText", "proofFileUrl", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'PENDING', $3, $4, now())
       RETURNING *`,
      [taskId, userId, proofText, proofFileUrl]
    );

    if (isPlanTask) {
      await approveSubmission({ ...result.rows[0], rewardAmount: task.rewardAmount }, {});
      const updated = await pool.query('SELECT * FROM "TaskSubmission" WHERE id = $1', [result.rows[0].id]);
      return res.status(201).json({
        submission: updated.rows[0],
        pending: false,
        message: 'Approved automatically! The reward has been added to your wallet.',
      });
    }

    notifyAdmin(
      `New task submission — ${task.title}`,
      `<p>A new task submission needs review.</p>
       <p><b>Task:</b> ${task.title}<br/>
       <b>Reward:</b> Rs ${task.rewardAmount}<br/>
       <b>User:</b> ${req.user.email}</p>
       <p>Review it in the admin panel under Submissions.</p>`
    );

    res.status(201).json({
      submission: result.rows[0],
      pending: true,
      message: 'Submitted! Your proof is under review — the reward will be added once an admin approves it.',
    });
  } catch (err) {
    console.error('submitTask error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function myTaskSubmissions(req, res) {
  try {
    const result = await pool.query(
      `SELECT ts.*, t.title, t."rewardAmount", t.currency
       FROM "TaskSubmission" ts
       JOIN "Task" t ON t.id = ts."taskId"
       WHERE ts."userId" = $1
       ORDER BY ts."createdAt" DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('myTaskSubmissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * CPA NETWORK POSTBACK HANDLER
 * ------------------------------------------------------------------
 * This is the "auto" completion path: when a real CPA/offerwall
 * network (e.g. OGAds, AdGate — once you're approved by them) confirms
 * a user completed an offer, it calls this URL server-to-server with
 * the network's own offer/click ID and a shared secret.
 *
 * Expected query params (adjust field names to match whichever
 * network you integrate — this is a common pattern):
 *   ?subid=<your internal userId or click-tracking id>
 *   &offer_id=<the network's offer id>
 *   &payout=<amount the network is paying, optional override>
 *   &secret=<CPA_POSTBACK_SECRET from your .env, for verification>
 *
 * NOTE: You must actually be accepted by a CPA network and configure
 * their postback URL to point here. I cannot fabricate that approval —
 * it's a real business relationship between you and the network, and
 * most networks explicitly prohibit "get paid cash for completing
 * offers" sites, so read their terms carefully before integrating.
 */
async function cpaPostback(req, res) {
  try {
    const { subid, offer_id, payout, secret } = req.query;

    if (!secret || secret !== process.env.CPA_POSTBACK_SECRET) {
      return res.status(403).send('Forbidden: invalid secret');
    }
    if (!subid || !offer_id) {
      return res.status(400).send('Missing subid or offer_id');
    }

    const userResult = await pool.query('SELECT id FROM "User" WHERE id = $1', [subid]);
    if (userResult.rows.length === 0) {
      return res.status(404).send('Unknown user (subid)');
    }

    const taskResult = await pool.query(
      `SELECT * FROM "Task" WHERE source = 'CPA_NETWORK' AND "cpaOfferId" = $1 AND status = 'ACTIVE'`,
      [offer_id]
    );
    if (taskResult.rows.length === 0) {
      return res.status(404).send('Unknown or inactive offer');
    }
    const task = taskResult.rows[0];

    const existing = await pool.query(
      'SELECT 1 FROM "TaskSubmission" WHERE "taskId" = $1 AND "userId" = $2',
      [task.id, subid]
    );
    if (existing.rows.length > 0) {
      return res.status(200).send('OK (already credited)'); // idempotent
    }

    const rewardAmount = payout ? parseFloat(payout) : parseFloat(task.rewardAmount);

    const submission = await pool.query(
      `INSERT INTO "TaskSubmission"
        (id, "taskId", "userId", status, "autoApproved", "rewardPaid", "createdAt", "reviewedAt")
       VALUES (gen_random_uuid(), $1, $2, 'APPROVED', true, $3, now(), now())
       RETURNING *`,
      [task.id, subid, rewardAmount]
    );

    await walletService.credit(
      subid,
      rewardAmount,
      'TASK_EARNING',
      submission.rows[0].id,
      `Auto-credited via ${task.cpaNetworkName || 'CPA network'} postback`
    );

    await pool.query('UPDATE "Task" SET "completedCount" = "completedCount" + 1 WHERE id = $1', [task.id]);

    res.status(200).send('OK');
  } catch (err) {
    console.error('cpaPostback error:', err);
    res.status(500).send('Internal server error');
  }
}

module.exports = { listTasks, getTask, submitTask, myTaskSubmissions, cpaPostback };

const pool = require('../db/pool');
const walletService = require('./walletService');
const { grantBonusSpin } = require('../controllers/spinController');

const COINS_PER_TASK = 10;
const COIN_MILESTONE = 500;
const SPINS_PER_MILESTONE = 3;

// Approves a PENDING submission: credits the wallet, marks it APPROVED, bumps
// the task's completedCount, and awards coins (+ bonus spins at milestones).
// Shared by admin manual review and the plan-task auto-approve path in submitTask.
async function approveSubmission(submission, { reviewedById = null, note = null } = {}) {
  await walletService.credit(
    submission.userId,
    parseFloat(submission.rewardAmount),
    'TASK_EARNING',
    submission.id,
    reviewedById ? 'Task submission approved' : 'Task auto-approved (plan task)'
  );
  await pool.query(
    `UPDATE "TaskSubmission" SET status = 'APPROVED', "reviewedById" = $1, "reviewNote" = $2,
     "rewardPaid" = $3, "reviewedAt" = now(), "autoApproved" = $4 WHERE id = $5`,
    [reviewedById, note, submission.rewardAmount, !reviewedById, submission.id]
  );
  await pool.query('UPDATE "Task" SET "completedCount" = "completedCount" + 1 WHERE id = $1', [submission.taskId]);

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
    await grantBonusSpin(submission.userId);
  }
}

module.exports = { approveSubmission };

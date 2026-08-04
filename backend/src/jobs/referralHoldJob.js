const pool = require('../db/pool');

// Only applies to users who signed up on/after this date — existing accounts
// are grandfathered in and never auto-held by this rule.
const HOLD_RULE_START_DATE = '2026-08-04T00:00:00Z';
const HOLD_WINDOW_DAYS = 20;
const REQUIRED_ACTIVATED_REFERRALS = 3;

// A referral counts as "activated" once the referred user has ever bought
// any plan (any UserPlan row, regardless of its current status).
const ACTIVATED_REFERRAL_COUNT_SQL = `(
  SELECT COUNT(DISTINCT r.id) FROM "User" r
  WHERE r."referredById" = u.id
    AND EXISTS (SELECT 1 FROM "UserPlan" up WHERE up."userId" = r.id)
)`;

async function isEnabled() {
  try {
    const r = await pool.query(`SELECT value FROM "SiteSetting" WHERE key='referral_hold_enabled' LIMIT 1`);
    return r.rows.length ? r.rows[0].value !== 'false' : true; // default on
  } catch {
    return true;
  }
}

/**
 * Daily check: users past their first 20 days without 3 referrals who
 * activated a plan get put on HOLD (restricted, but can still log in).
 * Also releases anyone on HOLD who has since caught up. Admin can flip this
 * off entirely via the 'referral_hold_enabled' site setting.
 */
async function runReferralHoldCheck() {
  try {
    if (!(await isEnabled())) return;

    const held = await pool.query(
      `UPDATE "User" u SET status = 'HOLD', "updatedAt" = now()
       WHERE u.status = 'ACTIVE'
         AND u."createdAt" >= $1
         AND u."createdAt" <= now() - interval '${HOLD_WINDOW_DAYS} days'
         AND ${ACTIVATED_REFERRAL_COUNT_SQL} < $2
       RETURNING u.id`,
      [HOLD_RULE_START_DATE, REQUIRED_ACTIVATED_REFERRALS]
    );
    if (held.rows.length) {
      console.log(`referralHoldJob: put ${held.rows.length} user(s) on HOLD (missed 3-referral target)`);
    }

    const released = await pool.query(
      `UPDATE "User" u SET status = 'ACTIVE', "updatedAt" = now()
       WHERE u.status = 'HOLD'
         AND ${ACTIVATED_REFERRAL_COUNT_SQL} >= $1
       RETURNING u.id`,
      [REQUIRED_ACTIVATED_REFERRALS]
    );
    if (released.rows.length) {
      console.log(`referralHoldJob: released ${released.rows.length} user(s) from HOLD`);
    }
  } catch (err) {
    console.error('referralHoldJob error:', err.message);
  }
}

module.exports = { runReferralHoldCheck, isEnabled, HOLD_RULE_START_DATE, HOLD_WINDOW_DAYS, REQUIRED_ACTIVATED_REFERRALS };

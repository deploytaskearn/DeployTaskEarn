const pool = require('../db/pool');

// Only applies to users who signed up on/after this date — existing accounts
// are grandfathered in and never auto-held by this rule.
const HOLD_RULE_START_DATE = '2026-08-04T00:00:00Z';
const HOLD_WINDOW_DAYS = 20;
const DEFAULT_REQUIRED_ACTIVATED_REFERRALS = 3;

// A referral counts as "activated" once the referred user has ever bought
// any plan (any UserPlan row, regardless of its current status). The
// designated test user's fake plan purchases never count toward this for
// whoever "referred" them.
const ACTIVATED_REFERRAL_COUNT_SQL = `(
  SELECT COUNT(DISTINCT r.id) FROM "User" r
  WHERE r."referredById" = u.id
    AND NOT r."isTestUser"
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

// Admin-configurable via the 'referral_hold_required_count' site setting.
async function getRequiredReferrals() {
  try {
    const r = await pool.query(`SELECT value FROM "SiteSetting" WHERE key='referral_hold_required_count' LIMIT 1`);
    const n = r.rows.length ? parseInt(r.rows[0].value, 10) : NaN;
    return Number.isInteger(n) && n > 0 ? n : DEFAULT_REQUIRED_ACTIVATED_REFERRALS;
  } catch {
    return DEFAULT_REQUIRED_ACTIVATED_REFERRALS;
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
    const requiredReferrals = await getRequiredReferrals();

    const held = await pool.query(
      `UPDATE "User" u SET status = 'HOLD', "updatedAt" = now()
       WHERE u.status = 'ACTIVE'
         AND NOT u."isTestUser"
         AND u."createdAt" >= $1
         AND u."createdAt" <= now() - interval '${HOLD_WINDOW_DAYS} days'
         AND ${ACTIVATED_REFERRAL_COUNT_SQL} < $2
       RETURNING u.id`,
      [HOLD_RULE_START_DATE, requiredReferrals]
    );
    if (held.rows.length) {
      console.log(`referralHoldJob: put ${held.rows.length} user(s) on HOLD (missed ${requiredReferrals}-referral target)`);
    }

    const released = await pool.query(
      `UPDATE "User" u SET status = 'ACTIVE', "updatedAt" = now()
       WHERE u.status = 'HOLD'
         AND ${ACTIVATED_REFERRAL_COUNT_SQL} >= $1
       RETURNING u.id`,
      [requiredReferrals]
    );
    if (released.rows.length) {
      console.log(`referralHoldJob: released ${released.rows.length} user(s) from HOLD`);
    }
  } catch (err) {
    console.error('referralHoldJob error:', err.message);
  }
}

module.exports = { runReferralHoldCheck, isEnabled, getRequiredReferrals, HOLD_RULE_START_DATE, HOLD_WINDOW_DAYS, DEFAULT_REQUIRED_ACTIVATED_REFERRALS };

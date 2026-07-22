const pool = require('../db/pool');
const { sendEmail } = require('./email');

const DEFAULT_ADMIN_EMAIL = 'help.taskearn@gmail.com';

async function getAdminNotifyEmail() {
  try {
    const r = await pool.query(`SELECT value FROM "SiteSetting" WHERE key='admin_notification_email' LIMIT 1`);
    if (r.rows.length && r.rows[0].value) return r.rows[0].value;
  } catch {}
  return DEFAULT_ADMIN_EMAIL;
}

// Fire-and-forget — a failed alert email must never break the user-facing
// deposit/withdrawal/submission request that triggered it.
function notifyAdmin(subject, html) {
  getAdminNotifyEmail()
    .then((to) => sendEmail({ to, subject, html }))
    .catch((err) => console.error('notifyAdmin: failed to send:', err.message));
}

module.exports = { notifyAdmin, getAdminNotifyEmail, DEFAULT_ADMIN_EMAIL };

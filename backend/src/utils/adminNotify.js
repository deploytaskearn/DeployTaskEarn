const pool = require('../db/pool');

// Fire-and-forget — a failed notification insert must never break the
// user-facing deposit/withdrawal/submission request that triggered it.
function notifyAdmin(type, title, message, link) {
  pool
    .query(
      `INSERT INTO "AdminNotification" (id, type, title, message, link, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
      [type, title, message || null, link || null]
    )
    .catch((err) => console.error('notifyAdmin: failed to insert:', err.message));
}

module.exports = { notifyAdmin };

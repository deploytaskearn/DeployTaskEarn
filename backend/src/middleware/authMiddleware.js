const { verifyToken } = require('../utils/auth');
const pool = require('../db/pool');

/**
 * Verifies the JWT in the Authorization header and attaches
 * the authenticated user's row to req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);

    const result = await pool.query(
      'SELECT id, name, email, role, status, "isTestUser" FROM "User" WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (user.status === 'BANNED') {
      return res.status(403).json({ error: 'Account banned' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Must be used AFTER requireAuth. Blocks non-admins.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Must be used AFTER requireAuth. Blocks withdrawals/plan purchases/task
 * submissions for accounts on HOLD, while still allowing login/dashboard
 * viewing (see src/jobs/referralHoldJob.js for how HOLD is set).
 */
function blockIfOnHold(req, res, next) {
  if (req.user && req.user.status === 'HOLD') {
    return res.status(403).json({
      error: 'Your account is on hold. Get 3 referrals who activate a plan within your first 20 days to unlock this.',
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, blockIfOnHold };

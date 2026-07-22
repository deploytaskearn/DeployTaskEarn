const { z } = require('zod');
const pool = require('../db/pool');
const walletService = require('../services/walletService');
const { notifyAdmin } = require('../utils/adminNotify');

const createWithdrawalSchema = z.object({
  method: z.enum(['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER']),
  amount: z.coerce.number().positive(),
  accountName: z.string().min(2),
  accountNumber: z.string().min(3),
});

const MIN_WITHDRAWAL = 500; // adjust to your business rules

/**
 * User requests a withdrawal. We debit the wallet immediately
 * (reserving the funds) so the same balance can't be withdrawn
 * twice while a request is pending. If admin rejects, we refund.
 */
async function createWithdrawal(req, res) {
  try {
    const data = createWithdrawalSchema.parse(req.body);

    if (data.amount < MIN_WITHDRAWAL) {
      return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL}` });
    }

    const withdrawal = await pool.query(
      `INSERT INTO "Withdrawal" (id, "userId", method, amount, "accountName", "accountNumber", status, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'PENDING', now())
       RETURNING *`,
      [req.user.id, data.method, data.amount, data.accountName, data.accountNumber]
    );

    try {
      await walletService.debit(
        req.user.id,
        data.amount,
        'WITHDRAWAL',
        withdrawal.rows[0].id,
        `Withdrawal request via ${data.method} (reserved pending admin approval)`
      );
    } catch (debitErr) {
      // Roll back the withdrawal record if the debit fails (insufficient funds)
      await pool.query('DELETE FROM "Withdrawal" WHERE id = $1', [withdrawal.rows[0].id]);
      if (debitErr.code === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'Insufficient wallet balance' });
      }
      throw debitErr;
    }

    notifyAdmin(
      'WITHDRAWAL',
      `New withdrawal request — Rs ${data.amount}`,
      `${req.user.email} via ${data.method} — ${data.accountName} (${data.accountNumber})`,
      '/withdrawals'
    );

    res.status(201).json(withdrawal.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('createWithdrawal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function myWithdrawals(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM "Withdrawal" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('myWithdrawals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── ADMIN ─────────────

async function adminListWithdrawals(req, res) {
  try {
    const { status } = req.query;
    let query = `
      SELECT w.*, u.name as "userName", u.email as "userEmail"
      FROM "Withdrawal" w JOIN "User" u ON u.id = w."userId"
    `;
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE w.status = $${params.length}`;
    }
    query += ' ORDER BY w."createdAt" DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('adminListWithdrawals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Admin actions:
 *  - APPROVE: marks approved, admin still needs to actually send the money
 *             manually via EasyPaisa/JazzCash/bank app, then call PAID.
 *  - REJECT: refunds the reserved amount back to the user's wallet.
 *  - PAID: marks as completed after admin has sent the real payment.
 */
async function adminReviewWithdrawal(req, res) {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // 'APPROVE' | 'REJECT' | 'PAID'

    const wResult = await pool.query('SELECT * FROM "Withdrawal" WHERE id = $1', [id]);
    if (wResult.rows.length === 0) return res.status(404).json({ error: 'Withdrawal not found' });
    const withdrawal = wResult.rows[0];

    if (action === 'REJECT') {
      if (withdrawal.status !== 'PENDING') {
        return res.status(400).json({ error: 'Only pending withdrawals can be rejected' });
      }
      await walletService.credit(
        withdrawal.userId,
        parseFloat(withdrawal.amount),
        'ADMIN_ADJUSTMENT',
        withdrawal.id,
        'Withdrawal rejected — funds returned to wallet'
      );
      await pool.query(
        `UPDATE "Withdrawal" SET status = 'REJECTED', "reviewedById" = $1, "reviewNote" = $2, "reviewedAt" = now() WHERE id = $3`,
        [req.user.id, note || null, id]
      );
    } else if (action === 'APPROVE') {
      if (withdrawal.status !== 'PENDING') {
        return res.status(400).json({ error: 'Only pending withdrawals can be approved' });
      }
      await pool.query(
        `UPDATE "Withdrawal" SET status = 'APPROVED', "reviewedById" = $1, "reviewNote" = $2, "reviewedAt" = now() WHERE id = $3`,
        [req.user.id, note || null, id]
      );
    } else if (action === 'PAID') {
      if (withdrawal.status !== 'APPROVED') {
        return res.status(400).json({ error: 'Only approved withdrawals can be marked paid' });
      }
      await pool.query(
        `UPDATE "Withdrawal" SET status = 'PAID', "paidAt" = now() WHERE id = $1`,
        [id]
      );
    } else {
      return res.status(400).json({ error: 'action must be APPROVE, REJECT, or PAID' });
    }

    const updated = await pool.query('SELECT * FROM "Withdrawal" WHERE id = $1', [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('adminReviewWithdrawal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createWithdrawal,
  myWithdrawals,
  adminListWithdrawals,
  adminReviewWithdrawal,
};

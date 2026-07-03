const { z } = require('zod');
const pool = require('../db/pool');
const walletService = require('../services/walletService');

const createDepositSchema = z.object({
  method: z.enum(['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER']),
  amount: z.coerce.number().positive(),
  senderAccountNo: z.string().optional(),
  transactionId: z.string().optional(),
});

async function getPaymentMethods(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM "PaymentMethodConfig" WHERE "isEnabled" = true'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getPaymentMethods error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * User submits a manual deposit claim: amount, method, their TrxID,
 * and optionally a screenshot. Status starts PENDING — admin must
 * approve before the wallet is credited. This is intentionally
 * NOT auto-credited, since there's no live gateway verification yet.
 */
async function createDeposit(req, res) {
  try {
    const data = createDepositSchema.parse(req.body);
    const screenshotUrl = req.file ? `/uploads/deposits/${req.file.filename}` : null;

    const result = await pool.query(
      `INSERT INTO "Deposit"
        (id, "userId", method, amount, "senderAccountNo", "transactionId", "screenshotUrl", status, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'PENDING', now())
       RETURNING *`,
      [req.user.id, data.method, data.amount, data.senderAccountNo || null, data.transactionId || null, screenshotUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('createDeposit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function myDeposits(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM "Deposit" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('myDeposits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── ADMIN ─────────────

async function adminListDeposits(req, res) {
  try {
    const { status } = req.query;
    let query = `
      SELECT d.*, u.name as "userName", u.email as "userEmail"
      FROM "Deposit" d JOIN "User" u ON u.id = d."userId"
    `;
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE d.status = $${params.length}`;
    }
    query += ' ORDER BY d."createdAt" DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('adminListDeposits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adminReviewDeposit(req, res) {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // action: 'APPROVE' | 'REJECT'

    const depositResult = await pool.query('SELECT * FROM "Deposit" WHERE id = $1', [id]);
    if (depositResult.rows.length === 0) return res.status(404).json({ error: 'Deposit not found' });
    const deposit = depositResult.rows[0];

    if (deposit.status !== 'PENDING') {
      return res.status(400).json({ error: 'Deposit already reviewed' });
    }

    if (action === 'APPROVE') {
      await walletService.credit(
        deposit.userId,
        parseFloat(deposit.amount),
        'DEPOSIT',
        deposit.id,
        `Manual ${deposit.method} deposit approved`
      );
      await pool.query(
        `UPDATE "Deposit" SET status = 'APPROVED', "reviewedById" = $1, "reviewNote" = $2, "reviewedAt" = now() WHERE id = $3`,
        [req.user.id, note || null, id]
      );
    } else if (action === 'REJECT') {
      await pool.query(
        `UPDATE "Deposit" SET status = 'REJECTED', "reviewedById" = $1, "reviewNote" = $2, "reviewedAt" = now() WHERE id = $3`,
        [req.user.id, note || null, id]
      );
    } else {
      return res.status(400).json({ error: 'action must be APPROVE or REJECT' });
    }

    const updated = await pool.query('SELECT * FROM "Deposit" WHERE id = $1', [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('adminReviewDeposit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adminUpsertPaymentMethod(req, res) {
  try {
    const { method, isEnabled, accountName, accountNumber, instructions } = req.body;

    const result = await pool.query(
      `INSERT INTO "PaymentMethodConfig" (id, method, "isEnabled", "accountName", "accountNumber", instructions, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())
       ON CONFLICT (method) DO UPDATE SET
         "isEnabled" = $2, "accountName" = $3, "accountNumber" = $4, instructions = $5, "updatedAt" = now()
       RETURNING *`,
      [method, isEnabled, accountName, accountNumber, instructions]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('adminUpsertPaymentMethod error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getPaymentMethods,
  createDeposit,
  myDeposits,
  adminListDeposits,
  adminReviewDeposit,
  adminUpsertPaymentMethod,
};

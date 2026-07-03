const pool = require('../db/pool');

/**
 * All wallet balance changes MUST go through this service.
 * It writes an append-only ledger entry and updates the cached
 * Wallet.balance atomically inside a DB transaction, using
 * `SELECT ... FOR UPDATE` to lock the wallet row and prevent
 * race conditions (e.g. two concurrent withdrawals overdrawing).
 */

async function getOrCreateWallet(client, userId) {
  const existing = await client.query(
    'SELECT * FROM "Wallet" WHERE "userId" = $1 FOR UPDATE',
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const created = await client.query(
    `INSERT INTO "Wallet" (id, "userId", balance, currency, "updatedAt")
     VALUES (gen_random_uuid(), $1, 0, 'PKR', now())
     RETURNING *`,
    [userId]
  );
  return created.rows[0];
}

/**
 * Credit (add money to) a user's wallet.
 * @param {string} userId
 * @param {number} amount - positive number
 * @param {string} type - LedgerType enum value
 * @param {string|null} referenceId
 * @param {string|null} note
 */
async function credit(userId, amount, type, referenceId = null, note = null) {
  if (amount <= 0) throw new Error('Credit amount must be positive');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wallet = await getOrCreateWallet(client, userId);
    const newBalance = parseFloat(wallet.balance) + parseFloat(amount);

    await client.query(
      'UPDATE "Wallet" SET balance = $1, "updatedAt" = now() WHERE "userId" = $2',
      [newBalance, userId]
    );

    const ledger = await client.query(
      `INSERT INTO "LedgerEntry"
        (id, "userId", type, direction, amount, "balanceAfter", "referenceId", note, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'CREDIT', $3, $4, $5, $6, now())
       RETURNING *`,
      [userId, type, amount, newBalance, referenceId, note]
    );

    await client.query('COMMIT');
    return { balance: newBalance, ledgerEntry: ledger.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Debit (subtract money from) a user's wallet.
 * Throws if the wallet has insufficient balance.
 */
async function debit(userId, amount, type, referenceId = null, note = null) {
  if (amount <= 0) throw new Error('Debit amount must be positive');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wallet = await getOrCreateWallet(client, userId);
    const currentBalance = parseFloat(wallet.balance);

    if (currentBalance < amount) {
      await client.query('ROLLBACK');
      const err = new Error('Insufficient wallet balance');
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    const newBalance = currentBalance - parseFloat(amount);

    await client.query(
      'UPDATE "Wallet" SET balance = $1, "updatedAt" = now() WHERE "userId" = $2',
      [newBalance, userId]
    );

    const ledger = await client.query(
      `INSERT INTO "LedgerEntry"
        (id, "userId", type, direction, amount, "balanceAfter", "referenceId", note, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'DEBIT', $3, $4, $5, $6, now())
       RETURNING *`,
      [userId, type, amount, newBalance, referenceId, note]
    );

    await client.query('COMMIT');
    return { balance: newBalance, ledgerEntry: ledger.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getBalance(userId) {
  const result = await pool.query(
    'SELECT balance, currency FROM "Wallet" WHERE "userId" = $1',
    [userId]
  );
  if (result.rows.length === 0) return { balance: 0, currency: 'PKR' };
  return result.rows[0];
}

async function getLedgerHistory(userId, limit = 50, offset = 0) {
  const result = await pool.query(
    `SELECT * FROM "LedgerEntry" WHERE "userId" = $1
     ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

module.exports = { credit, debit, getBalance, getLedgerHistory, getOrCreateWallet };

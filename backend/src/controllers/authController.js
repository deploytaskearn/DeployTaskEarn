const { z } = require('zod');
const pool = require('../db/pool');
const {
  hashPassword,
  comparePassword,
  signToken,
  generateReferralCode,
} = require('../utils/auth');

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6).max(100),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function register(req, res) {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM "User" WHERE LOWER(email) = LOWER($1)', [data.email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    let referredById = null;
    if (data.referralCode) {
      const referrer = await pool.query(
        'SELECT id FROM "User" WHERE "referralCode" = $1',
        [data.referralCode]
      );
      if (referrer.rows.length > 0) {
        referredById = referrer.rows[0].id;
      }
    }

    const passwordHash = await hashPassword(data.password);

    // Generate referral code from first name, add number suffix if taken (ALI, ALI1, ALI2 …)
    const base = generateReferralCode(data.name);
    let referralCode = base;
    let attempt = 1;
    while (true) {
      const taken = await pool.query('SELECT 1 FROM "User" WHERE "referralCode" = $1', [referralCode]);
      if (taken.rows.length === 0) break;
      referralCode = `${base}${attempt}`;
      attempt++;
    }

    const result = await pool.query(
      `INSERT INTO "User" (id, name, email, phone, "passwordHash", "referralCode", "referredById", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now())
       RETURNING id, name, email, role, "referralCode", "createdAt"`,
      [data.name, data.email, data.phone || null, passwordHash, referralCode, referredById]
    );

    const user = result.rows[0];

    // Create empty wallet for the new user
    await pool.query(
      `INSERT INTO "Wallet" (id, "userId", balance, currency, "updatedAt")
       VALUES (gen_random_uuid(), $1, 0, 'PKR', now())`,
      [user.id]
    );

    const token = signToken({ userId: user.id, role: user.role });

    res.status(201).json({ user, token });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const data = loginSchema.parse(req.body);

    const result = await pool.query('SELECT * FROM "User" WHERE LOWER(email) = LOWER($1)', [data.email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (user.status === 'BANNED') {
      return res.status(403).json({ error: 'Account banned' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const valid = await comparePassword(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({ userId: user.id, role: user.role });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode,
      },
      token,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u."referralCode", u."createdAt",
              w.balance, w.currency,
              COALESCE(uc.coins, 0) AS coins
       FROM "User" u
       LEFT JOIN "Wallet" w ON w."userId" = u.id
       LEFT JOIN "UserCoin" uc ON uc."userId" = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register, login, getMe };

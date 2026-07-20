const { z } = require('zod');
const crypto = require('crypto');
const pool = require('../db/pool');
const {
  hashPassword,
  comparePassword,
  signToken,
  generateReferralCode,
} = require('../utils/auth');
const { sendEmail } = require('../utils/email');

const RESET_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VERIFY_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// 6-digit numeric OTP (always starts 1-9, so it's always exactly 6 digits).
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function otpEmailHtml({ heading, name, intro, otp, minutes }) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#0E1C15">${heading}</h2>
      <p>Hi ${name || ''},</p>
      <p>${intro}</p>
      <p style="margin:28px 0;text-align:center">
        <span style="display:inline-block;background:#0E1C15;color:#00C875;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 24px;border-radius:12px">${otp}</span>
      </p>
      <p style="color:#666;font-size:13px">This code expires in ${minutes} minutes.</p>
    </div>
  `;
}

async function sendVerificationEmail(user) {
  const otp = generateOtp();
  const tokenHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + VERIFY_OTP_TTL_MS);

  await pool.query('DELETE FROM "EmailVerificationToken" WHERE "userId" = $1 AND "usedAt" IS NULL', [user.id]);
  await pool.query(
    `INSERT INTO "EmailVerificationToken" (id, "userId", "tokenHash", "expiresAt", "createdAt")
     VALUES (gen_random_uuid(), $1, $2, $3, now())`,
    [user.id, tokenHash, expiresAt]
  );

  await sendEmail({
    to: user.email,
    subject: 'Verify your TaskEarn account',
    html: otpEmailHtml({
      heading: 'Verify your email',
      name: user.name,
      intro: 'Thanks for joining TaskEarn! Enter this code to verify your email and get a verified badge on your account.',
      otp,
      minutes: 10,
    }),
  });
}

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
        'SELECT id FROM "User" WHERE UPPER("referralCode") = UPPER($1)',
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

    // Best-effort — a failed verification email should never block registration.
    sendVerificationEmail(user).catch((err) => {
      console.error('register: failed to send verification email:', err.message);
    });

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

    // Admin accounts must use /api/auth/admin-login — never the user portal
    if (user.role === 'ADMIN') {
      return res.status(403).json({ error: 'Admin accounts cannot access the user portal.' });
    }

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

// Separate login endpoint exclusively for admin panel — stores in a different token key on frontend
async function adminLogin(req, res) {
  try {
    const data = loginSchema.parse(req.body);

    const result = await pool.query('SELECT * FROM "User" WHERE LOWER(email) = LOWER($1)', [data.email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const valid = await comparePassword(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id, role: user.role });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error('adminLogin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateProfile(req, res) {
  try {
    const { name, phone } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }
    await pool.query(
      `UPDATE "User" SET name=$1, phone=$2, "updatedAt"=now() WHERE id=$3`,
      [name.trim(), phone?.trim() || null, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMe(req, res) {
  try {
    // Admin accounts must never appear in the user portal
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ error: 'Admin accounts cannot access the user portal.' });
    }
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u."referralCode", u."createdAt", u."emailVerifiedAt",
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

async function adminMe(req, res) {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const result = await pool.query(
      `SELECT id, name, email, role FROM "User" WHERE id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('adminMe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const forgotPasswordSchema = z.object({ email: z.string().email() });

async function forgotPassword(req, res) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Always respond the same way whether or not the email exists, so this
    // endpoint can't be used to enumerate registered accounts.
    const GENERIC_RESPONSE = { message: 'If that email is registered, a reset code has been sent.' };

    const userResult = await pool.query('SELECT id, name FROM "User" WHERE LOWER(email) = LOWER($1)', [email]);
    if (userResult.rows.length === 0) {
      return res.json(GENERIC_RESPONSE);
    }
    const user = userResult.rows[0];

    const otp = generateOtp();
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + RESET_OTP_TTL_MS);

    // Invalidate any previous unused reset codes for this user first.
    await pool.query('DELETE FROM "PasswordResetToken" WHERE "userId" = $1 AND "usedAt" IS NULL', [user.id]);
    await pool.query(
      `INSERT INTO "PasswordResetToken" (id, "userId", "tokenHash", "expiresAt", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, now())`,
      [user.id, tokenHash, expiresAt]
    );

    try {
      await sendEmail({
        to: email,
        subject: 'Your TaskEarn password reset code',
        html: otpEmailHtml({
          heading: 'Reset your password',
          name: user.name,
          intro: 'We received a request to reset your TaskEarn password. Enter this code to continue. If you didn\'t request this, you can safely ignore this email.',
          otp,
          minutes: 10,
        }),
      });
    } catch (emailErr) {
      console.error('forgotPassword: failed to send email:', emailErr.message);
      // Still respond generically — don't leak whether the send succeeded.
    }

    res.json(GENERIC_RESPONSE);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'A valid email is required.' });
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function findValidResetToken(email, otp) {
  const userResult = await pool.query('SELECT id FROM "User" WHERE LOWER(email) = LOWER($1)', [email]);
  if (userResult.rows.length === 0) return null;
  const userId = userResult.rows[0].id;

  const tokenHash = hashToken(otp);
  const tokenResult = await pool.query(
    `SELECT * FROM "PasswordResetToken"
     WHERE "userId" = $1 AND "tokenHash" = $2 AND "usedAt" IS NULL AND "expiresAt" > now()`,
    [userId, tokenHash]
  );
  return tokenResult.rows[0] || null;
}

const verifyResetOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
});

async function verifyResetOtp(req, res) {
  try {
    const { email, otp } = verifyResetOtpSchema.parse(req.body);
    const resetToken = await findValidResetToken(email, otp);
    if (!resetToken) {
      return res.status(400).json({ error: 'This code is invalid or has expired. Please request a new one.' });
    }
    res.json({ ok: true });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'A valid email and 6-digit code are required.' });
    console.error('verifyResetOtp error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
  password: z.string().min(6).max(100),
});

async function resetPassword(req, res) {
  try {
    const { email, otp, password } = resetPasswordSchema.parse(req.body);
    const resetToken = await findValidResetToken(email, otp);
    if (!resetToken) {
      return res.status(400).json({ error: 'This code is invalid or has expired. Please request a new one.' });
    }

    const passwordHash = await hashPassword(password);
    await pool.query('UPDATE "User" SET "passwordHash" = $1, "updatedAt" = now() WHERE id = $2', [passwordHash, resetToken.userId]);
    await pool.query('UPDATE "PasswordResetToken" SET "usedAt" = now() WHERE id = $1', [resetToken.id]);

    res.json({ message: 'Password updated. You can now log in with your new password.' });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'A valid email, code, and password (min 6 characters) are required.' });
    console.error('resetPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const verifyEmailSchema = z.object({ otp: z.string().min(6).max(6) });

async function verifyEmail(req, res) {
  try {
    const { otp } = verifyEmailSchema.parse(req.body);
    const tokenHash = hashToken(otp);

    const tokenResult = await pool.query(
      `SELECT * FROM "EmailVerificationToken"
       WHERE "userId" = $1 AND "tokenHash" = $2 AND "usedAt" IS NULL AND "expiresAt" > now()`,
      [req.user.id, tokenHash]
    );
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'This code is invalid or has expired. Please request a new one.' });
    }
    const verifyToken = tokenResult.rows[0];

    await pool.query('UPDATE "User" SET "emailVerifiedAt" = now(), "updatedAt" = now() WHERE id = $1', [verifyToken.userId]);
    await pool.query('UPDATE "EmailVerificationToken" SET "usedAt" = now() WHERE id = $1', [verifyToken.id]);

    res.json({ message: 'Email verified! Your account now has a verified badge.' });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'A valid 6-digit code is required.' });
    console.error('verifyEmail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resendVerification(req, res) {
  try {
    const result = await pool.query('SELECT id, name, email, "emailVerifiedAt" FROM "User" WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerifiedAt) return res.status(400).json({ error: 'Your email is already verified.' });

    await sendVerificationEmail(user);
    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    console.error('resendVerification error:', err);
    res.status(500).json({ error: 'Failed to send verification email. Please try again shortly.' });
  }
}

module.exports = { register, login, adminLogin, getMe, adminMe, updateProfile, forgotPassword, verifyResetOtp, resetPassword, verifyEmail, resendVerification };

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Excludes visually-confusable characters (0/O, 1/I) so a code is easy to
// read aloud/type correctly. Deliberately NOT derived from the user's name —
// codes must not reveal who a code belongs to.
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode() {
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
  }
  return code;
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  generateReferralCode,
};

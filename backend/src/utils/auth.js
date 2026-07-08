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

function generateReferralCode(name) {
  // Extract first name (first word) and uppercase it
  const firstName = (name || '').trim().split(/\s+/)[0];
  return firstName.replace(/[^a-zA-Z]/g, '').toUpperCase() || 'USER';
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  generateReferralCode,
};

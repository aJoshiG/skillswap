const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Short-lived access token (JWT), kept in memory by the client.
function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

// Long-lived refresh token: an opaque random string sent in an httpOnly cookie.
// Only its SHA-256 hash is stored, so a database leak does not leak usable tokens.
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { signAccessToken, verifyAccessToken, generateRefreshToken, hashToken };

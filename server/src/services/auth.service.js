const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { signAccessToken, generateRefreshToken, hashToken } = require('../utils/tokens');

async function issueTokens(userId) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user: userId, tokenHash: hashToken(refreshToken), expiresAt });
  return { accessToken: signAccessToken(userId), refreshToken, refreshExpiresAt: expiresAt };
}

async function register({ name, email, password }) {
  const exists = await User.exists({ email });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name, email, password });
  return { user, ...(await issueTokens(user._id)) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  // Same message for unknown email and wrong password, so emails can't be enumerated.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  user.lastActiveAt = new Date();
  await user.save();
  return { user, ...(await issueTokens(user._id)) };
}

/**
 * Rotates the refresh token: the old one is revoked and a new pair is issued.
 * If a token that was already revoked is presented again, it has probably been
 * stolen, so every session for that user is revoked.
 */
async function refresh(refreshToken) {
  if (!refreshToken) throw ApiError.unauthorized('No refresh token');

  const stored = await RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
  if (!stored || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  if (stored.revokedAt) {
    await RefreshToken.updateMany(
      { user: stored.user, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw ApiError.unauthorized('Session is no longer valid, please log in again');
  }

  // Conditional update so two concurrent refreshes cannot both succeed.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: stored._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (!claimed) throw ApiError.unauthorized('Session is no longer valid, please log in again');

  const user = await User.findById(stored.user);
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  return { user, ...(await issueTokens(user._id)) };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

module.exports = { register, login, refresh, logout };

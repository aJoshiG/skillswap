const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const { recordWelcome } = require('./credit.service');
const env = require('../config/env');
const { signAccessToken, generateRefreshToken, hashToken } = require('../utils/tokens');

// How long a just-rotated refresh token may still be presented. Covers a browser that sent a
// refresh but never stored the response's new cookie (page reloaded or closed mid-request) and
// two tabs refreshing at once. Reuse after this window is treated as theft.
const ROTATION_GRACE_MS = 30 * 1000;

async function createRefreshToken(userId) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000);
  const doc = await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });
  return { doc, refreshToken, expiresAt };
}

async function issueTokens(userId) {
  const { refreshToken, expiresAt } = await createRefreshToken(userId);
  return { accessToken: signAccessToken(userId), refreshToken, refreshExpiresAt: expiresAt };
}

async function register({ name, email, password }) {
  const exists = await User.exists({ email });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name, email, password });
  await recordWelcome(user);
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

const withinGrace = (token) =>
  Boolean(token.replacedBy) && Date.now() - token.revokedAt.getTime() <= ROTATION_GRACE_MS;

/**
 * Rotates the refresh token: the old one is marked as replaced and a new pair is issued.
 * Presenting a token again shortly after it was rotated is a duplicate request from the same
 * browser and gets a fresh session. Presenting a revoked token any other way means it has
 * probably been stolen, so every session for that user is revoked.
 */
async function refresh(refreshToken) {
  if (!refreshToken) throw ApiError.unauthorized('No refresh token');

  const stored = await RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
  if (!stored || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const user = await User.findById(stored.user);
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  if (stored.revokedAt) {
    if (withinGrace(stored)) return { user, ...(await issueTokens(user._id)) };
    await RefreshToken.updateMany(
      { user: stored.user, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw ApiError.unauthorized('Session is no longer valid, please log in again');
  }

  // Create the successor first, then mark the old token as replaced in one conditional update,
  // so a concurrent refresh never sees it revoked without knowing it was a rotation.
  const next = await createRefreshToken(user._id);
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: stored._id, revokedAt: null },
    { $set: { revokedAt: new Date(), replacedBy: next.doc._id } },
  );
  if (!claimed) {
    // Another request rotated it a moment ago: drop our successor and take the grace path.
    await RefreshToken.deleteOne({ _id: next.doc._id });
    const rotated = await RefreshToken.findById(stored._id);
    if (rotated && withinGrace(rotated)) return { user, ...(await issueTokens(user._id)) };
    throw ApiError.unauthorized('Session is no longer valid, please log in again');
  }

  return {
    user,
    accessToken: signAccessToken(user._id),
    refreshToken: next.refreshToken,
    refreshExpiresAt: next.expiresAt,
  };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

module.exports = { register, login, refresh, logout };

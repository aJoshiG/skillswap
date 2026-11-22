const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const env = require('../config/env');
const { ok, created } = require('../utils/response');

const REFRESH_COOKIE = 'ss_refresh';

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  path: '/api/auth',
});

function sendSession(res, { user, accessToken, refreshToken, refreshExpiresAt }, status = 200) {
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions(), expires: refreshExpiresAt });
  const body = { user, accessToken };
  return status === 201 ? created(res, body) : ok(res, body);
}

async function register(req, res) {
  sendSession(res, await authService.register(req.valid.body), 201);
}

async function login(req, res) {
  sendSession(res, await authService.login(req.valid.body));
}

async function refresh(req, res) {
  try {
    sendSession(res, await authService.refresh(req.cookies?.[REFRESH_COOKIE]));
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw err;
  }
}

async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  ok(res, { loggedOut: true });
}

async function me(req, res) {
  ok(res, await userService.getMe(req.userId));
}

module.exports = { register, login, refresh, logout, me, REFRESH_COOKIE };

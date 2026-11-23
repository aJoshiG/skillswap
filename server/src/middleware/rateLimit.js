const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');

const limitedResponse = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
};

// Login/register: brute-force protection, so only failed attempts count. Successful logins
// never lock a real user out.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 10_000 : 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitedResponse,
});

// Refresh runs on every page load (silent session restore), and the token is unguessable,
// so it gets its own, more generous budget instead of sharing the login one.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 10_000 : 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitedResponse,
});

// Per IP. Configurable because end-to-end tests run many simulated users from one IP.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 10_000 : env.apiRateLimitPerMinute,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitedResponse,
});

module.exports = { authLimiter, refreshLimiter, apiLimiter };

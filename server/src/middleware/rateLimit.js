const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');

const limitedResponse = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 10_000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitedResponse,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 10_000 : 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitedResponse,
});

module.exports = { authLimiter, apiLimiter };

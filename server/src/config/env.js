const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const isTest = process.env.NODE_ENV === 'test';

function required(name, testFallback) {
  const value = process.env[name] || (isTest ? testFallback : undefined);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest,
  port: Number(process.env.PORT) || 4000,
  mongoUri: required('MONGO_URI', 'set-by-test-setup'),
  // Render sets RENDER_EXTERNAL_URL (e.g. https://skillswap.onrender.com) automatically.
  clientUrl: process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4200',
  // Built Angular app to serve from this server (production / single-service deploys).
  clientDist:
    process.env.CLIENT_DIST ||
    (process.env.NODE_ENV === 'production'
      ? path.resolve(__dirname, '../../../client/dist/client/browser')
      : null),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'test-access-secret'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS) || 7,
  },
  // Cross-site deployments (e.g. Vercel client + Render API) need SameSite=None + Secure.
  cookie: {
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
  },
};

module.exports = env;

const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.set('trust proxy', 1); // correct client IPs for rate limiting behind Render/Railway proxies
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Google Fonts stylesheet + font files; avatars can be any https image URL.
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'https:'],
          // Same-origin REST + WebSocket (socket.io). Older browsers need wss: listed explicitly.
          'connect-src': ["'self'", 'wss:'],
        },
      },
    }),
  );
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use('/api', apiLimiter, routes);

  // In production, this same server also serves the built Angular app, so the client, API and
  // WebSocket share one origin: no cross-site cookies or CORS setup needed.
  if (env.clientDist && fs.existsSync(env.clientDist)) {
    // Hashed bundles never change, so cache them for a year; index.html is never cached.
    app.use(express.static(env.clientDist, { index: false, maxAge: '1y', immutable: true }));
    // SPA fallback: deep links like /explore or /messages/123 load index.html and Angular routes them.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || !req.accepts('html'))
        return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile('index.html', { root: env.clientDist });
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

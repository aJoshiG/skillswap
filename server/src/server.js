const http = require('http');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');
const { initSockets } = require('./sockets');
const { startSessionSweeper } = require('./jobs/sessionSweeper');

async function start() {
  await connectDB(env.mongoUri);
  console.log('MongoDB connected');

  const server = http.createServer(createApp());
  initSockets(server);

  server.listen(env.port, () => {
    console.log(`SkillSwap API listening on http://localhost:${env.port}`);
  });

  // Auto-resolves sessions nobody confirmed (and stale proposals), so credits never stay held.
  const stopSweeper =
    env.sessionSweepMinutes > 0
      ? startSessionSweeper({ minutes: env.sessionSweepMinutes })
      : () => {};

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    stopSweeper();
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

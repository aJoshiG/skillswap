const http = require('http');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');
const { initSockets } = require('./sockets');

async function start() {
  await connectDB(env.mongoUri);
  console.log('MongoDB connected');

  const server = http.createServer(createApp());
  initSockets(server);

  server.listen(env.port, () => {
    console.log(`SkillSwap API listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
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

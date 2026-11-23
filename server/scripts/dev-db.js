/* Starts a local single-node MongoDB replica set for development, so features that use
 * transactions (sessions and time credits) work locally, like on Atlas.
 *
 * Usage: npm run db   then use MONGO_URI=mongodb://127.0.0.1:27018/skillswap?replicaSet=rs0
 *
 * It reuses the mongod binary that mongodb-memory-server downloads for the tests, keeps data in
 * server/.data/db (git-ignored) and initiates the replica set on first run. No admin rights or
 * changes to a system MongoDB service are needed. Stop it with Ctrl+C.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { MongoClient } = require('mongodb');
const { MongoBinary } = require('mongodb-memory-server');

const PORT = Number(process.env.DEV_DB_PORT) || 27018;
const REPL_SET = 'rs0';
const dbPath = path.resolve(__dirname, '../.data/db');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function initiate() {
  const url = `mongodb://127.0.0.1:${PORT}/?directConnection=true`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    let client;
    try {
      client = await MongoClient.connect(url, { serverSelectionTimeoutMS: 1000 });
      const admin = client.db('admin');
      try {
        await admin.command({ replSetGetStatus: 1 });
      } catch (err) {
        if (err.codeName !== 'NotYetInitialized') throw err;
        await admin.command({
          replSetInitiate: { _id: REPL_SET, members: [{ _id: 0, host: `127.0.0.1:${PORT}` }] },
        });
      }
      // Wait until this node is primary, so writes and transactions work straight away.
      for (let i = 0; i < 40; i += 1) {
        const hello = await admin.command({ hello: 1 });
        if (hello.isWritablePrimary) return;
        await sleep(250);
      }
      throw new Error('Replica set did not elect a primary');
    } catch (err) {
      if (attempt === 59) throw err;
      await sleep(500);
    } finally {
      await client?.close();
    }
  }
}

async function main() {
  fs.mkdirSync(dbPath, { recursive: true });
  const binary = await MongoBinary.getPath();
  const mongod = spawn(
    binary,
    ['--replSet', REPL_SET, '--port', String(PORT), '--bind_ip', '127.0.0.1', '--dbpath', dbPath],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  mongod.on('exit', (code) => process.exit(code ?? 0));
  const stop = () => mongod.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await initiate();
  console.log(
    `Dev MongoDB replica set ready on port ${PORT}.\n` +
      `  MONGO_URI=mongodb://127.0.0.1:${PORT}/skillswap?replicaSet=${REPL_SET}\n` +
      `  Data: ${dbPath}   (Ctrl+C to stop)`,
  );
}

main().catch((err) => {
  console.error('Could not start the dev database:', err.message);
  process.exit(1);
});

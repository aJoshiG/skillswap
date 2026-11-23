/* End-to-end test runner. Starts everything the tests need, from scratch:
 *   1. an in-memory MongoDB replica set (transactions work, nothing touches your real data)
 *   2. the demo seed
 *   3. the real server in production mode, serving the built Angular app on one port
 * then runs Playwright and shuts it all down.
 *
 * Prerequisites: `npm ci` in server/ and client/, and `npm run build` in client/.
 * Usage: npm test [-- <playwright args>]   ·   npm run test:headed   ·   npm run screenshots
 * Locally without Chrome: PW_CHANNEL=msedge npm test
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');
const clientDist = path.join(root, 'client', 'dist', 'client', 'browser');
// Reuse the server's mongodb-memory-server (and its downloaded mongod binary).
const requireFromServer = createRequire(path.join(serverDir, 'package.json'));
const { MongoMemoryReplSet } = requireFromServer('mongodb-memory-server');

const PORT = Number(process.env.E2E_PORT) || 4300;
const BASE_URL = `http://localhost:${PORT}`;
const args = process.argv.slice(2);
const screenshots = args.includes('--screenshots');
const pwArgs = args.filter((a) => a !== '--screenshots');

if (!existsSync(path.join(clientDist, 'index.html'))) {
  console.error(`Built client not found at ${clientDist}. Run "npm run build" in client/ first.`);
  process.exit(1);
}

const run = (cmd, cmdArgs, opts) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });

async function waitForHealth(url, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not become healthy at ${url}`);
}

let replSet;
let server;
let exitCode = 0;
try {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const mongoUri = replSet.getUri('skillswap');
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    MONGO_URI: mongoUri,
    CLIENT_URL: BASE_URL,
    CLIENT_DIST: clientDist,
    JWT_ACCESS_SECRET: 'e2e-only-secret-not-for-production',
    COOKIE_SECURE: 'false',
    COOKIE_SAMESITE: 'lax',
    // Every simulated user shares one IP here, so lift the per-IP API limit (production keeps 300).
    API_RATE_LIMIT_PER_MINUTE: '5000',
  };

  console.log('▶ Seeding demo data');
  await run('node', ['scripts/seed.js'], { cwd: serverDir, env, stdio: ['ignore', 'ignore', 'inherit'] });

  console.log(`▶ Starting server on ${BASE_URL}`);
  // The server's request log goes to e2e/server.log (useful when a test fails, also in CI).
  const log = createWriteStream(path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.log'));
  server = spawn('node', ['src/server.js'], { cwd: serverDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  await waitForHealth(`${BASE_URL}/api/health`);

  console.log('▶ Running Playwright');
  const testEnv = { ...process.env, E2E_BASE_URL: BASE_URL, E2E_MONGO_URI: mongoUri, E2E_SERVER_DIR: serverDir };
  const target = screenshots ? ['--config', 'screenshots.config.ts'] : [];
  await run('npx', ['playwright', 'test', ...target, ...pwArgs], { cwd: path.dirname(fileURLToPath(import.meta.url)), env: testEnv });
} catch (err) {
  console.error(err.message);
  exitCode = 1;
} finally {
  server?.kill();
  await replSet?.stop();
}
process.exit(exitCode);

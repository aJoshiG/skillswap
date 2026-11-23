import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Browser, Page, expect } from '@playwright/test';

const serverDir = process.env.E2E_SERVER_DIR ?? path.resolve(__dirname, '../../server');
const mongoUri = process.env.E2E_MONGO_URI!;
// The MongoDB driver comes from the server's dependencies (same version the app uses).
const { MongoClient } = createRequire(path.join(serverDir, 'package.json'))('mongodb');

export const PASSWORD = 'password123';

/** Restores the demo data, so a test file starts from a known state. */
export function reseed(): void {
  execFileSync('node', ['scripts/seed.js'], {
    cwd: serverDir,
    env: { ...process.env, MONGO_URI: mongoUri, JWT_ACCESS_SECRET: 'e2e-only-secret-not-for-production' },
    stdio: 'ignore',
  });
}

/** Runs `fn` against the test database (for setup a browser can't do, like time travel). */
export async function withDb<T>(fn: (db: any) => Promise<T>): Promise<T> {
  const client = await MongoClient.connect(mongoUri);
  try {
    return await fn(client.db());
  } finally {
    await client.close();
  }
}

/** Logs in through the real login form. */
export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A separate browser session (own cookies), logged in as `email`. */
export async function userPage(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await login(page, email);
  return page;
}

/** The latest toast message on the page. */
export const toast = (page: Page) => page.locator('app-toast-container p').last();

/** The navbar credits pill. */
export const creditsPill = (page: Page) => page.getByTitle('Your time credits');

import { expect, test } from '@playwright/test';
import { PASSWORD, login, reseed } from './helpers';

test.beforeAll(reseed);

test('demo account: one click in, lands on matches, survives a reload, logs out', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /try the demo account/i }).click();
  await expect(page).toHaveURL(/\/matches/);
  await expect(page.getByRole('heading', { name: 'Your best matches' })).toBeVisible();

  // The access token lives only in memory; a reload restores the session from the httpOnly cookie.
  await page.reload();
  await expect(page).toHaveURL(/\/matches/);
  await expect(page.getByRole('heading', { name: 'Your best matches' })).toBeVisible();

  await page.locator('[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  // Protected pages now redirect to login, even after a reload.
  await page.goto('/sessions');
  await expect(page).toHaveURL(/\/login/);
});

test('wrong password shows an error and stays on login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@skillswap.dev');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: /^log in$/i }).click();
  // Shown inline as an alert (announced by screen readers), not as a toast.
  await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
  await expect(page).toHaveURL(/\/login/);
});

test('sign up → add skills → see matches straight away', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Playwright Tester');
  await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/profile\/edit\?welcome=1/);

  const section = (title: string) =>
    page.locator('section, fieldset, div.card').filter({ has: page.getByRole('heading', { name: title }) }).last();
  for (const [title, skillName] of [
    ['Skills I can teach', 'python'], // lower case on purpose: matching ignores case
    ['Skills I want to learn', 'Guitar'],
  ]) {
    const s = section(title);
    if (!(await s.getByLabel('Skill name').count())) await s.getByRole('button', { name: '+ Add' }).click();
    await s.getByLabel('Skill name').last().fill(skillName);
  }
  await page.getByRole('button', { name: /save/i }).click();

  await expect(page).toHaveURL(/\/matches/);
  // Riya teaches Guitar and wants Python: a two-way swap, ranked first.
  const first = page.locator('ol > li').first();
  await expect(first).toContainText('Riya Sharma');
  await expect(first).toContainText('Two-way swap');
});

test('a logged-in user visiting /login is sent to matches', async ({ page }) => {
  await login(page, 'riya@skillswap.dev');
  await page.goto('/login');
  await expect(page).toHaveURL(/\/matches/);
});

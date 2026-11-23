import { expect, test } from '@playwright/test';
import { login, reseed } from './helpers';

test.beforeAll(reseed);
test.beforeEach(({ page }) => login(page, 'demo@skillswap.dev'));

test('matches: two-way swaps first, with reasons and ratings', async ({ page }) => {
  await page.goto('/matches');
  const cards = page.locator('ol > li');
  await expect(cards).toHaveCount(7);
  await expect(cards.nth(0)).toContainText('Riya Sharma');
  await expect(cards.nth(1)).toContainText('Carlos Mendez');
  for (const i of [0, 1]) await expect(cards.nth(i)).toContainText('Two-way swap');
  await expect(cards.nth(0)).toContainText('Also in Pune, can meet in person');
  await expect(cards.nth(0).getByRole('img', { name: /rated 5\.0 out of 5/i })).toBeVisible();
  await expect(cards.nth(2)).toContainText('Wants to learn from you');

  await cards.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/users\//);
  await expect(page.getByRole('heading', { name: 'Riya Sharma' })).toBeVisible();
  await expect(page.getByText('1 session taught')).toBeVisible();
  await expect(page.locator('#reviews')).toContainText('So patient!');
});

test('explore: search, filters and an empty state', async ({ page }) => {
  await page.goto('/explore');
  await page.getByPlaceholder(/search skills/i).fill('guitar');
  await expect(page.locator('a.card')).toHaveCount(1);
  await expect(page.locator('a.card')).toContainText('Riya Sharma');

  await page.getByRole('radio', { name: 'They want' }).click();
  await expect(page.locator('a.card').first()).toBeVisible();
  await expect(page.locator('a.card')).not.toHaveCount(0);

  await page.getByPlaceholder(/search skills/i).fill('underwater basket weaving');
  await expect(page.getByText(/no one matches those filters/i)).toBeVisible();
  await page.getByRole('button', { name: /clear filters/i }).click();
  await expect(page.locator('a.card').first()).toBeVisible();
});

test('deep links work on a fresh load (server-side SPA fallback)', async ({ page }) => {
  await page.goto('/sessions');
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  const res = await page.goto('/this-page-does-not-exist');
  expect(res?.status()).toBe(200);
  await expect(page.getByText(/swapped itself out/i)).toBeVisible();
});

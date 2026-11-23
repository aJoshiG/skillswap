import AxeBuilder from '@axe-core/playwright';
import { Page, expect, test } from '@playwright/test';
import { login, reseed } from './helpers';

test.beforeAll(reseed);

/** Fails on any WCAG 2.1 A/AA violation, listing each rule and the elements that break it. */
async function expectAccessible(page: Page, what: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const report = violations.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.help}\n` +
      v.nodes
        .slice(0, 5)
        .map((n) => `    ${n.target.join(' ')}`)
        .join('\n'),
  );
  // Soft assertion: keep checking the other pages, then report every violation at once.
  expect.soft(report, `${what} has accessibility violations`).toEqual([]);
}

test('public pages', async ({ page }) => {
  for (const [path, name] of [
    ['/', 'Home'],
    ['/login', 'Login'],
    ['/register', 'Sign up'],
    ['/nope', 'Not found'],
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expectAccessible(page, name);
  }
});

test('app pages', async ({ page }) => {
  await login(page, 'demo@skillswap.dev');
  for (const [path, name, ready] of [
    ['/matches', 'Matches', 'ol > li'],
    ['/explore', 'Explore', 'a.card'],
    ['/requests', 'Requests', 'article'],
    ['/messages', 'Messages', 'a[href*="/messages/"]'],
    ['/sessions', 'Sessions', 'li.card'],
    ['/profile/edit', 'Edit profile', 'form'],
  ]) {
    await page.goto(path);
    await page.locator(ready).first().waitFor();
    await expectAccessible(page, name);
  }

  // A profile with reviews, a chat thread, and the two dialogs.
  await page.goto('/matches');
  await page.locator('ol > li a').first().click();
  await page.locator('#reviews li').first().waitFor();
  await expectAccessible(page, 'Profile');

  await page.goto('/messages');
  await page.locator('a[href*="/messages/"]').first().click();
  await page.getByPlaceholder('Write a message…').waitFor();
  await expectAccessible(page, 'Chat thread');
  await page.getByRole('button', { name: /schedule a session/i }).click();
  await page.getByRole('dialog').waitFor();
  await expectAccessible(page, 'Schedule dialog');
  await page.keyboard.press('Escape');

  await page.goto('/sessions');
  await page.getByRole('tab', { name: 'History' }).click();
  await page.getByRole('button', { name: /review riya/i }).click();
  await page.getByRole('dialog').waitFor();
  await expectAccessible(page, 'Review dialog');
});

test('dialogs: focus moves in, the page behind is inert, focus returns on close', async ({ page }) => {
  await login(page, 'demo@skillswap.dev');
  await page.goto('/sessions');
  await page.getByRole('tab', { name: 'History' }).click();
  const opener = page.getByRole('button', { name: /review riya/i });
  await opener.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Focus starts inside the dialog...
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  // ...and Tab can't reach the page behind it.
  await expect(page.locator('main#main')).toHaveAttribute('inert', '');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const inDialog = await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]') || document.activeElement === document.body,
    );
    expect(inDialog).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('main#main')).not.toHaveAttribute('inert', '');
  await expect(opener).toBeFocused();
});

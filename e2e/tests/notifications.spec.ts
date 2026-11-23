import AxeBuilder from '@axe-core/playwright';
import { reseed, test, expect } from './helpers';

test.beforeAll(reseed);

test('notifications: live bell badge, dropdown, follow a link, mark all read', async ({ as }) => {
  const demo = await as('demo@skillswap.dev');
  const bell = demo.getByRole('button', { name: /^Notifications/ });
  // Seeded: Carlos's request and Riya's proposal are unread.
  await expect(bell).toHaveAccessibleName('Notifications, 2 unread');

  // Kabir accepts Demo's Python request in another browser → the bell updates live.
  const kabir = await as('kabir@skillswap.dev');
  await kabir.goto('/requests');
  await kabir.locator('article').filter({ hasText: 'Demo User' }).getByRole('button', { name: 'Accept' }).click();
  await expect(bell).toHaveAccessibleName('Notifications, 3 unread');

  // The dropdown lists it first; it's accessible.
  await bell.click();
  const panel = demo.getByRole('region', { name: 'Notifications' });
  await expect(panel.getByRole('listitem').first()).toContainText('Kabir accepted your Python request');
  const { violations } = await new AxeBuilder({ page: demo })
    .include('#notification-panel')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);

  // Clicking it opens the chat with Kabir and marks it read.
  await panel.getByRole('link', { name: /Kabir accepted/ }).click();
  await expect(demo).toHaveURL(/\/messages\/.+/);
  await expect(demo.getByRole('heading', { name: 'Kabir Mehta' }).or(demo.getByText('Kabir Mehta').first())).toBeVisible();
  await expect(bell).toHaveAccessibleName('Notifications, 2 unread');

  // Escape closes the dropdown and returns focus to the bell.
  await bell.click();
  await expect(panel).toBeVisible();
  await demo.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(bell).toBeFocused();

  // The full page: Unread tab, then mark everything read.
  await demo.goto('/notifications');
  await demo.getByRole('tab', { name: /Unread/ }).click();
  await expect(demo.locator('main li')).toHaveCount(2);
  await demo.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(bell).toHaveAccessibleName('Notifications');
  await expect(demo.getByText('No unread notifications')).toBeVisible();
});

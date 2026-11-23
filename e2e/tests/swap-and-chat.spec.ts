
import { reseed, toast, test, expect } from './helpers';

test.beforeAll(reseed);

test('request → accept → real-time chat between two people', async ({ as }) => {
  const demo = await as('demo@skillswap.dev');
  const kabir = await as('kabir@skillswap.dev');

  // Demo already asked Kabir for Python (seed). Kabir sees it in the inbox and accepts.
  await kabir.goto('/requests');
  const request = kabir.locator('article').filter({ hasText: 'Demo User' });
  await expect(request).toContainText('Pending');
  await request.getByRole('button', { name: 'Accept' }).click();
  // Demo is told live.
  await expect(toast(demo)).toContainText(/accepted your python request/i);

  // Kabir opens the chat; Demo opens it from Messages.
  await kabir.goto('/requests');
  await kabir.getByRole('button', { name: 'Accepted' }).click();
  await kabir.locator('article').filter({ hasText: 'Demo User' }).getByRole('link', { name: /open chat/i }).click();
  await expect(kabir).toHaveURL(/\/messages\/.+/);
  await demo.goto(kabir.url().replace(/^https?:\/\/[^/]+/, ''));

  // Typing indicator, then the message arrives live, then a read receipt.
  const box = demo.getByPlaceholder('Write a message…');
  await box.fill('Hi Kabir! When do you have time for some Python?');
  await expect(kabir.getByText('typing…')).toBeVisible();
  await box.press('Enter');
  // (.last(): the sidebar preview also shows the latest message)
  await expect(kabir.getByText('When do you have time for some Python?').last()).toBeVisible();
  await expect(demo.getByText('Seen')).toBeVisible();

  await kabir.getByPlaceholder('Write a message…').fill('Tomorrow evening works 🐍');
  await kabir.getByPlaceholder('Write a message…').press('Enter');
  await expect(demo.getByText('Tomorrow evening works 🐍').last()).toBeVisible();
});

test('a received request can be declined', async ({ as }) => {
  const demo = await as('demo@skillswap.dev');
  await demo.goto('/requests');
  const fromCarlos = demo.locator('article').filter({ hasText: 'Carlos Mendez' });
  await fromCarlos.getByRole('button', { name: 'Decline' }).click();
  await demo.getByRole('button', { name: 'Declined' }).click();
  await expect(demo.locator('article').filter({ hasText: 'Carlos Mendez' })).toContainText('Declined');
});

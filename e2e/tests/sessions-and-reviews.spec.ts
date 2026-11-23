
import { creditsPill, reseed, toast, test, expect, withDb } from './helpers';

test.beforeEach(reseed);

test('credits: accept holds, both confirm pays the teacher, cancel refunds', async ({ as }) => {
  const demo = await as('demo@skillswap.dev');
  const riya = await as('riya@skillswap.dev');
  await expect(creditsPill(demo)).toHaveText(/2\.5/);

  // Riya proposed an in-person guitar lesson (seed): Demo accepts, 1 credit is held.
  await demo.goto('/sessions');
  const guitar = demo.locator('li.card').filter({ hasText: 'Riya teaches you Guitar' });
  await guitar.getByRole('button', { name: 'Accept' }).click();
  await expect(toast(demo)).toContainText('1 credit held');
  await expect(creditsPill(demo)).toHaveText(/1\.5/);
  await expect(demo.getByText('+ 1 credit held for upcoming sessions')).toBeVisible();
  await expect(toast(riya)).toContainText(/accepted the guitar session/i);

  // The scheduled JavaScript lesson (Demo teaches Riya) starts now.
  await withDb((db) =>
    db.collection('sessions').updateOne(
      { status: 'scheduled', 'skill.name': 'JavaScript' },
      { $set: { scheduledAt: new Date(Date.now() - 60_000) } },
    ),
  );
  await demo.reload();
  const js = demo.locator('li.card').filter({ hasText: 'You teach Riya JavaScript' });
  await js.getByRole('button', { name: /confirm session/i }).click();
  await expect(js).toContainText('waiting for Riya');
  await expect(toast(riya)).toContainText(/confirm it too/i);

  await riya.goto('/sessions');
  await riya
    .locator('li.card')
    .filter({ hasText: 'Demo teaches you JavaScript' })
    .getByRole('button', { name: /confirm session/i })
    .click();
  await expect(toast(riya)).toContainText(/session completed/i);
  await expect(toast(demo)).toContainText(/1 credit paid to Demo/i);
  await expect(creditsPill(demo)).toHaveText(/2\.5/);

  // Cancelling the accepted guitar lesson before it starts refunds Demo.
  await demo.reload();
  await demo
    .locator('li.card')
    .filter({ hasText: 'Riya teaches you Guitar' })
    .getByRole('button', { name: /cancel/i })
    .click();
  await expect(toast(demo)).toContainText(/credits refunded/i);
  await expect(creditsPill(demo)).toHaveText(/3\.5/);

  // The ledger shows every movement.
  const activity = demo.locator('aside').getByRole('listitem');
  await expect(activity.first()).toContainText('Refund');
  await expect(demo.locator('aside')).toContainText('Taught JavaScript to Riya Sharma');
});

test('schedule a session from the chat header', async ({ as }) => {
  const riya = await as('riya@skillswap.dev');
  const demo = await as('demo@skillswap.dev');
  await riya.goto('/messages');
  await riya.locator('a[href*="/messages/"]').first().click();
  await riya.getByRole('button', { name: /schedule a session/i }).click();

  const dialog = riya.getByRole('dialog');
  await expect(dialog.locator('fieldset label')).toHaveText(['Demo teaches you JavaScript', 'You teach Demo Guitar']);
  await dialog.locator('fieldset label').filter({ hasText: 'You teach Demo Guitar' }).click();
  await dialog.getByLabel('How long').selectOption({ label: '30 min' });
  await expect(dialog).toContainText('Costs 0.5 credits, paid by Demo');
  await dialog.getByRole('button', { name: 'Propose session' }).click();

  await expect(toast(demo)).toContainText(/riya sharma proposed a guitar session/i);
  await demo.goto('/sessions');
  await expect(demo.locator('li.card').filter({ hasText: '30 min' })).toContainText('Riya teaches you Guitar');
});

test('review after a completed session, then see it on their profile', async ({ as }) => {
  const demo = await as('demo@skillswap.dev');
  const riya = await as('riya@skillswap.dev');
  await demo.goto('/sessions');
  await demo.getByRole('tab', { name: 'History' }).click();
  await demo.getByRole('button', { name: /review riya/i }).click();

  // Keyboard only: focus the stars, pick 4 with the arrow keys.
  const dialog = demo.getByRole('dialog');
  await dialog.locator('input[type=radio]').first().focus();
  await demo.keyboard.press('Space');
  for (let i = 0; i < 3; i++) await demo.keyboard.press('ArrowRight');
  await expect(dialog.getByText('Great', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: /4 stars/ })).toBeChecked();
  await dialog.getByLabel(/comment/i).fill('Sharp questions every week!');
  await dialog.getByRole('button', { name: 'Post review' }).click();

  await expect(toast(riya)).toContainText(/left you a 4★ review/i);
  await expect(demo.locator('li.card').filter({ hasText: 'You teach Riya JavaScript' })).toContainText('You rated');

  await riya.goto('/matches');
  await riya.locator('[aria-haspopup="menu"]').click();
  await riya.getByRole('menuitem', { name: /my public profile/i }).click();
  await expect(riya.getByRole('img', { name: /rated 4\.5 out of 5 from 2 reviews/i }).first()).toBeVisible();
  await expect(riya.locator('#reviews')).toContainText('Sharp questions every week!');
});

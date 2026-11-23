/* Captures the README screenshots and an animated tour GIF into docs/images.
 * Run with: npm run screenshots   (PW_CHANNEL=msedge locally if Chrome isn't installed)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Browser, Page, test } from '@playwright/test';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { PNG } from 'pngjs';
import { login, reseed, withDb } from '../tests/helpers';

const OUT = path.resolve(__dirname, '../../docs/images');
mkdirSync(OUT, { recursive: true });

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // let transitions finish
}

async function shoot(page: Page, name: string) {
  await settle(page);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function demoPage(browser: Browser, width = 1280, height = 800) {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
  await login(page, 'demo@skillswap.dev');
  return page;
}

test('README screenshots and tour GIF', async ({ browser }) => {
  reseed();
  // Friendlier times for the Sessions screenshot: tomorrow 18:30, and a proposal three days later at 11:00.
  await withDb(async (db) => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(18, 30, 0, 0);
    await db.collection('sessions').updateOne({ status: 'scheduled' }, { $set: { scheduledAt: t } });
    const p = new Date(t);
    p.setDate(p.getDate() + 3);
    p.setHours(11, 0, 0, 0);
    await db.collection('sessions').updateOne({ status: 'proposed' }, { $set: { scheduledAt: p } });
  });

  const frames: string[] = [];
  const anon = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await anon.goto('/');
  frames.push(await shoot(anon, 'home'));

  const page = await demoPage(browser);
  await page.goto('/matches');
  frames.push(await shoot(page, 'matches'));

  await page.locator('ol > li a').first().click();
  await page.locator('#reviews li').first().waitFor();
  frames.push(await shoot(page, 'profile'));

  await page.goto('/messages');
  await page.locator('a[href*="/messages/"]').first().click();
  await page.getByPlaceholder('Write a message…').fill('See you Saturday! I will bring the chord sheets 🎸');
  frames.push(await shoot(page, 'chat'));

  await page.getByRole('button', { name: /schedule a session/i }).click();
  await page.getByRole('dialog').locator('fieldset label').nth(1).click();
  frames.push(await shoot(page, 'schedule'));
  await page.keyboard.press('Escape');

  await page.goto('/sessions');
  await page.locator('li.card').first().waitFor();
  frames.push(await shoot(page, 'sessions'));

  await page.getByRole('tab', { name: 'History' }).click();
  await page.getByRole('button', { name: /review riya/i }).click();
  const stars = page.getByRole('dialog').locator('app-rating-input label');
  await stars.nth(4).click();
  await page.getByRole('dialog').getByLabel(/comment/i).fill('Sharp questions every week, and she does the homework!');
  await page.mouse.move(0, 0);
  frames.push(await shoot(page, 'review'));

  const phone = await demoPage(browser, 390, 844);
  await phone.goto('/matches');
  await shoot(phone, 'mobile-matches');

  writeGif(frames, path.join(OUT, 'tour.gif'));
});

/** Builds a slideshow GIF from same-sized PNGs (full resolution; the README scales it down). */
function writeGif(files: string[], out: string) {
  const gif = GIFEncoder();
  for (const file of files) {
    const png = PNG.sync.read(readFileSync(file));
    const data = new Uint8Array(png.data);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), png.width, png.height, { palette, delay: 2200 });
  }
  gif.finish();
  writeFileSync(out, gif.bytes());
}

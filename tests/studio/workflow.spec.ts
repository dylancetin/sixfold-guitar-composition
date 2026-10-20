import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

type Manifest = { id: string; title: string; integrity: { pdf: string; midi: string } };
let manifest: Manifest;
test.beforeAll(async ({ request }) => {
  const response = await request.get('/api/arrangements');
  expect(response.ok()).toBe(true);
  const library = await response.json();
  if (!library.arrangements.length) throw new Error('Browser acceptance requires an actual published song; no test-study fallback is allowed.');
  manifest = library.arrangements[0].manifest;
});
test('published library → real score deep link → reload → actual PDF/MIDI bytes', async ({ page }) => {
  const errors: string[] = [];
  const writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.goto('/');
  await page.getByRole('link', { name: manifest.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/arrangements/${manifest.id}$`));
  await expect(page.locator('.song-heading h1')).toHaveText(manifest.title);
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
  await expect(page.locator('.native-note-target').first()).toBeAttached();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
  for (const [name, key] of [['PDF score', 'pdf'], ['MIDI', 'midi']] as const) {
    const downloaded = page.waitForEvent('download');
    await page.getByRole('link', { name, exact: true }).click();
    const download = await downloaded;
    const bytes = await readFile((await download.path())!);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.integrity[key]);
    expect(bytes.subarray(0, key === 'pdf' ? 5 : 4).toString()).toBe(key === 'pdf' ? '%PDF-' : 'MThd');
  }
  expect(await page.getByRole('button', { name: /create|import|save|rebuild|approve/i }).count()).toBe(0);
  expect(await page.locator('input[type=url], input[type=password]').count()).toBe(0);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
test('canonical playback, pause, seek, practice tempo, loop, mute/solo and note inspection', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/arrangements/${manifest.id}`);
  await page.getByRole('button', { name: 'Play arrangement' }).click({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  await expect.poll(async () => (await page.locator('.time-readout').innerText()).startsWith('0:00')).toBe(false);
  await page.getByRole('button', { name: 'Pause playback' }).click();
  const paused = await page.locator('.time-readout').innerText();
  await page.waitForTimeout(200); expect(await page.locator('.time-readout').innerText()).toBe(paused);
  await page.getByLabel('Practice tempo').selectOption('0.75');
  await page.getByLabel('Jump to measure').selectOption('8');
  await expect(page.getByLabel('Jump to measure')).toHaveValue('8');
  expect(await page.locator('.score-viewport').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Mute bass', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute bass', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Solo melody', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Solo melody', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Loop first measure').selectOption('8');
  await page.getByLabel('Loop last measure').selectOption('9');
  await page.getByRole('button', { name: 'Loop measures' }).click();
  await expect(page.getByRole('button', { name: 'Loop measures' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Stop playback' }).click();
  const target = page.locator('.native-note-target').first();
  await target.focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Sounding pitch', { exact: true })).toBeVisible();
  await expect(page.locator('.note-inspector')).toContainText('MIDI');
  expect(errors).toEqual([]);
});
test('390px mobile deep link has no page overflow and controls remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/arrangements/${manifest.id}`);
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const viewport = page.getByLabel('Scrollable staff and tablature');
  expect(await viewport.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByLabel('Notation size').selectOption('1.25');
  await page.getByLabel('Jump to measure').selectOption('63');
  await expect(page.getByLabel('Jump to measure')).toHaveValue('63');
  await page.getByRole('button', { name: 'Stop playback' }).click();
  await page.getByLabel('Inspect a written note').selectOption({ index: 1 });
  await expect(page.locator('.note-inspector')).toContainText('MIDI');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('published markdown cannot execute HTML or javascript links', async ({ page }) => {
  await page.route('**/notes.md', route => route.fulfill({ contentType: 'text/plain', body: '# TEST-ONLY notes safety\n<script>window.BAD=true</script>\n[Unsafe](javascript:alert(1))\n**Safe rationale**' }));
  await page.goto(`/arrangements/${manifest.id}`);
  await expect(page.getByText('Safe rationale', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { BAD?: boolean }).BAD)).toBeUndefined();
  expect(await page.locator('.markdown-notes a[href^="javascript:"]').count()).toBe(0);
  expect(await page.locator('.markdown-notes script').count()).toBe(0);
});

test('empty library directs requests to project chat without creation or study controls', async ({ page }) => {
  await page.route('**/api/arrangements', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ arrangements: [], unavailableCount: 0 }) }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your arrangements will live here.' })).toBeVisible();
  await expect(page.getByText('Request a song arrangement in this project’s chat.', { exact: false })).toBeVisible();
  expect(await page.getByRole('button').count()).toBe(0);
  expect(await page.locator('input').count()).toBe(0);
  expect(await page.getByText('Original test study', { exact: false }).count()).toBe(0);
});

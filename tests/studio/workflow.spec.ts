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
test('live preview uses bundled acoustic guitar samples, not oscillator tones', async ({ page }) => {
  await page.addInitScript(() => {
    const evidence = { oscillators: 0, voices: [] as { samples: number; loop: boolean; rate: number; offset: number }[] };
    (window as Window & { guitarEvidence?: typeof evidence }).guitarEvidence = evidence;
    const createSource = AudioContext.prototype.createBufferSource, createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { evidence.oscillators++; return createOscillator.call(this); };
    AudioContext.prototype.createBufferSource = function () {
      const source = createSource.call(this), start = source.start.bind(source);
      source.start = (when = 0, offset = 0, duration?: number) => {
        evidence.voices.push({ samples: source.buffer?.length ?? 0, loop: source.loop, rate: source.playbackRate.value, offset });
        start(when, offset, duration);
      };
      return source;
    };
  });
  await page.goto(`/arrangements/${manifest.id}`);
  await page.getByRole('button', { name: 'Play arrangement' }).click({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause playback' }).click();
  const evidence = await page.evaluate(() => (window as Window & { guitarEvidence?: { oscillators: number; voices: { samples: number; loop: boolean; rate: number; offset: number }[] } }).guitarEvidence!);
  expect(evidence.oscillators).toBe(0); expect(evidence.voices.length).toBeGreaterThan(0);
  expect(evidence.voices.every(voice => voice.samples > 300 && voice.loop && voice.rate > 0 && voice.offset >= 0)).toBe(true);
});
test('MP3 downloads real decodable full-song audio, independent of practice controls', async ({ page, request }) => {
  test.setTimeout(120000);
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.goto(`/arrangements/${manifest.id}`);
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
  await page.getByLabel('Practice tempo').selectOption('0.5');
  await page.getByRole('button', { name: 'Mute bass', exact: true }).click();
  await page.getByRole('button', { name: 'Solo melody', exact: true }).click();
  await page.getByRole('button', { name: 'Loop measures', exact: true }).click();
  const downloaded = page.waitForEvent('download', { timeout: 90000 });
  await page.getByRole('button', { name: 'Download MP3', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/-preview\.mp3$/);
  const bytes = await readFile((await download.path())!);
  expect(bytes.length).toBeGreaterThan(100000);
  const audio = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const context = new OfflineAudioContext(1, 1, 44100);
    const buffer = await context.decodeAudioData(bytes.buffer);
    const samples = buffer.getChannelData(0);
    let sum = 0, tail = 0;
    for (const value of samples) sum += value * value;
    for (let i = Math.max(0, samples.length - 44100); i < samples.length; i++) tail += samples[i]! ** 2;
    return { duration: buffer.duration, channels: buffer.numberOfChannels, rms: Math.sqrt(sum / samples.length), tailRms: Math.sqrt(tail / Math.min(44100, samples.length)) };
  }, bytes.toString('base64'));
  const score = await (await request.get(`/arrangements/${manifest.id}/score.json`)).json();
  const number = (q: { n: number; d: number }) => q.n / q.d;
  const last = score.occurrences.at(-1);
  const end = number(last.start) + number(last.length);
  const tempos = score.performedTempos as { start: { n: number; d: number }; quarterBpm: number }[];
  const seconds = tempos.reduce((sum, tempo, i) => sum + ((tempos[i + 1] ? number(tempos[i + 1]!.start) : end) - number(tempo.start)) * 60 / tempo.quarterBpm, 0);
  expect(Math.abs(audio.duration - seconds)).toBeLessThan(0.1);
  expect(audio.channels).toBe(1); expect(audio.rms).toBeGreaterThan(0.001); expect(audio.tailRms).toBeGreaterThan(0.00001);
  await expect(page.getByRole('link', { name: 'Download MP3', exact: true })).toBeVisible();
  const again = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download MP3', exact: true }).click();
  expect(await readFile((await (await again).path())!)).toEqual(bytes);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});

test('MP3 failure stays retryable and does not block PDF, MIDI or playback', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'OfflineAudioContext', { value: undefined, configurable: true }); });
  await page.goto(`/arrangements/${manifest.id}`);
  await page.getByRole('button', { name: 'Download MP3', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This browser cannot render MP3 audio');
  await expect(page.getByRole('button', { name: 'Download MP3', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'PDF score', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'MIDI', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
});
test('390px mobile deep link has no page overflow and controls remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/arrangements/${manifest.id}`);
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Download MP3', exact: true })).toBeVisible();
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

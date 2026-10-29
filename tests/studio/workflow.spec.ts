import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

type Manifest = { id: string; title: string; integrity: { pdf: string; midi: string } };
let manifest: Manifest;
async function openScore(page: Page) {
  await page.goto(`/arrangements/${manifest.id}`);
  await page.getByRole('button', { name: 'Restore preview controls' }).click();
}
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
  for (const [name, key] of [['Original PDF', 'pdf'], ['MIDI', 'midi']] as const) {
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
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`score defaults to tight four-bar rows and minimized controls at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/arrangements/${manifest.id}`);
    for (let visit = 0; visit < 2; visit++) {
      await expect(page.getByRole('button', { name: 'Play arrangement', exact: true })).toBeEnabled({ timeout: 20000 });
      await expect(page.locator('.score-panel')).toHaveAttribute('data-spacing', 'tight');
      await expect(page.locator('#preview-toolbar')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Restore preview controls' })).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('button', { name: 'Fullscreen preview' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const height = await page.locator('.native-score').evaluate(e => e.getBoundingClientRect().height);
      await page.getByRole('button', { name: 'Restore preview controls' }).click();
      await expect(page.getByLabel('Preview spacing')).toHaveValue('tight');
      await expect(page.getByLabel('Bars per row')).toHaveValue('4');
      await expect(page.locator('.native-score')).toHaveCSS('height', `${height}px`);
      await page.getByRole('button', { name: 'Minimize preview controls' }).click();
      await expect(page.locator('#preview-toolbar')).toBeHidden();
      if (visit === 0) await page.reload();
    }
  });
}
test('canonical playback, pause, seek, practice tempo, loop, mute/solo and note inspection', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await openScore(page);
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
test('TAB numbering switches during playback and fullscreen keeps controls available', async ({ page }) => {
  await openScore(page);
  await page.getByRole('button', { name: 'Play arrangement' }).click({ timeout: 20000 });
  await page.getByLabel('Jump to measure').selectOption('8');
  await page.getByLabel('Inspect a written note').selectOption({ index: 1 });
  const relativeFret = await page.locator('.note-inspector dd').nth(3).innerText();
  const pitch = await page.locator('.note-inspector dd').first().innerText();
  await page.getByLabel('TAB fret numbering').selectOption('absolute');
  await expect(page.getByLabel('TAB fret numbering')).toBeEnabled();
  await expect(page.locator('.native-fragment').first()).toContainText('absolute neck frets');
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await expect(page.getByLabel('Jump to measure')).toHaveValue('8');
  await expect(page.locator('.note-inspector dd').first()).toHaveText(pitch);
  const capo = await page.request.get(`/arrangements/${manifest.id}/score.json`).then(r => r.json()).then(s => s.instrument.capo);
  const [string, fret] = relativeFret.split(' / ');
  await expect(page.locator('.note-inspector dd').nth(3)).toHaveText(`${string} / ${Number(fret) + capo}`);
  await page.getByRole('button', { name: 'Fullscreen preview' }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
  expect(await page.locator('.score-panel').evaluate(e => e.getBoundingClientRect().height)).toBe(await page.evaluate(() => innerHeight));
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeVisible();
  await page.getByLabel('TAB fret numbering').selectOption('relative');
  await expect(page.locator('.native-fragment').first()).toContainText('frets relative to capo');
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Fullscreen preview' })).toHaveAttribute('aria-pressed', 'false');
});

test('preview spacing, bars per row and smaller sizes fit more music without restarting playback', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await openScore(page);
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
  await page.getByLabel('Preview spacing').selectOption('normal');
  await expect(page.getByLabel('Preview spacing')).toBeEnabled();
  await page.getByLabel('Bars per row').selectOption('2');
  await expect(page.getByLabel('Bars per row')).toBeEnabled();
  const surface = page.locator('.native-score');
  const originalHeight = await surface.evaluate(e => e.getBoundingClientRect().height);
  const originalTargets = await page.locator('.native-note-target').count();
  const originalRows = await page.locator('.native-fragment').count();
  const pdfBefore = await request.get(`/arrangements/${manifest.id}/arrangement.pdf`).then(r => r.body());
  await page.getByLabel('Preview spacing').selectOption('compact');
  await expect(page.getByLabel('Preview spacing')).toBeEnabled();
  const compactHeight = await surface.evaluate(e => e.getBoundingClientRect().height);
  expect(compactHeight).toBeLessThan(originalHeight);
  await page.getByRole('button', { name: 'Play arrangement' }).click();
  await page.getByLabel('Jump to measure').selectOption('8');
  await page.getByLabel('Preview spacing').selectOption('tight');
  await expect(page.getByLabel('Preview spacing')).toBeEnabled();
  expect(await surface.evaluate(e => e.getBoundingClientRect().height)).toBeLessThan(compactHeight);
  await page.getByLabel('Bars per row').selectOption('4');
  await expect(page.getByLabel('Bars per row')).toBeEnabled();
  expect(await page.locator('.native-fragment').count()).toBeLessThan(originalRows);
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await expect(page.getByLabel('Jump to measure')).toHaveValue('8');
  const tightHeight = await surface.evaluate(e => e.getBoundingClientRect().height);
  await page.getByLabel('Notation size').selectOption('0.75');
  await expect.poll(() => surface.evaluate(e => e.getBoundingClientRect().height)).toBeCloseTo(tightHeight * .75, 0);
  await page.getByLabel('TAB fret numbering').selectOption('absolute');
  await expect(page.getByLabel('TAB fret numbering')).toBeEnabled();
  await expect(page.getByLabel('Preview spacing')).toHaveValue('tight');
  await expect(page.getByLabel('Bars per row')).toHaveValue('4');
  expect(await page.locator('.native-note-target').count()).toBe(originalTargets);
  await page.getByLabel('Jump to measure').selectOption('63');
  await page.locator('.score-viewport').scrollIntoViewIfNeeded();
  await expect(page.locator('.native-cursor')).toBeInViewport();
  const target = page.locator('.native-note-target').last();
  await target.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.note-inspector')).toContainText('MIDI');
  const pdfAfter = await request.get(`/arrangements/${manifest.id}/arrangement.pdf`).then(r => r.body());
  expect(pdfAfter).toEqual(pdfBefore);
  expect(errors).toEqual([]);
});

test('mobile fullscreen fallback exits with Escape and restores page scrolling', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, 'fullscreenEnabled', { value: false }));
  await page.setViewportSize({ width: 390, height: 844 });
  await openScore(page);
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
  await page.getByRole('button', { name: 'Fullscreen preview' }).click();
  await expect(page.locator('.score-panel')).toHaveClass(/score-expanded/);
  await page.getByLabel('Preview spacing').selectOption('tight');
  await expect(page.getByLabel('Preview spacing')).toBeEnabled();
  await page.getByLabel('Bars per row').selectOption('3');
  await expect(page.getByLabel('Bars per row')).toBeEnabled();
  await page.getByLabel('Notation size').selectOption('0.65');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('TAB fret numbering').selectOption('absolute');
  await expect(page.getByLabel('TAB fret numbering')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.locator('.score-panel')).not.toHaveClass(/score-expanded/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await expect(page.getByRole('button', { name: 'Fullscreen preview' })).toBeFocused();
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
  await openScore(page);
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
  await openScore(page);
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
  await openScore(page);
  await page.getByRole('button', { name: 'Download MP3', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This browser cannot render MP3 audio');
  await expect(page.getByRole('button', { name: 'Download MP3', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Original PDF', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'MIDI', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play arrangement' })).toBeEnabled({ timeout: 20000 });
});
test('390px mobile deep link has no page overflow and controls remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScore(page);
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
  await openScore(page);
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

test('finger-number switch updates the actual engraving without resetting playback or changing downloads', async ({ page, request }) => {
  const path = `/arrangements/${manifest.id}`;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const before = await Promise.all(['score.json', 'arrangement.pdf', 'arrangement.mid'].map(file => request.get(`${path}/${file}`).then(r => r.body())));
  await page.goto(path);
  await page.getByRole('button', { name: 'Restore preview controls' }).click();
  const toggle = page.getByRole('switch', { name: 'Finger numbers' });
  await expect(toggle).toBeEnabled({ timeout: 20000 });
  await expect(toggle).not.toBeChecked();
  const glyphs = () => page.locator('.native-fragment svg').evaluateAll(svgs => (svgs.map(svg => svg.textContent).join('').match(/[\uED10-\uED14]/g) ?? []).length);
  expect(await glyphs()).toBe(0);
  const targets = await page.locator('.native-note-target').count();
  await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
  await page.getByLabel('Jump to measure').selectOption('8');
  await toggle.check();
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeChecked();
  const shownCount = await glyphs(); expect(shownCount).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await expect(page.getByLabel('Jump to measure')).toHaveValue('8');
  for (const [label, value] of [['Preview spacing', 'tight'], ['Bars per row', '3'], ['TAB fret numbering', 'absolute']] as const) {
    await page.getByLabel(label).selectOption(value);
    await expect(toggle).toBeEnabled();
    expect(await glyphs()).toBe(shownCount);
  }
  await page.getByLabel('Notation size').selectOption('0.75');
  await expect(toggle).toBeChecked();
  expect(await page.locator('.native-note-target').count()).toBe(targets);
  await toggle.uncheck(); await expect(toggle).toBeEnabled();
  expect(await glyphs()).toBe(0);
  await expect(page.getByLabel('Jump to measure')).toHaveValue('8');
  const target = page.locator('.native-note-target').first();
  await target.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.note-inspector')).toContainText('MIDI');
  const after = await Promise.all(['score.json', 'arrangement.pdf', 'arrangement.mid'].map(file => request.get(`${path}/${file}`).then(r => r.body())));
  expect(after).toEqual(before); expect(errors).toEqual([]);
});

test('finger-number switch is keyboard accessible in mobile fullscreen', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, 'fullscreenEnabled', { value: false }));
  await page.setViewportSize({ width: 390, height: 844 });
  await openScore(page);
  const toggle = page.getByRole('switch', { name: 'Finger numbers' });
  await expect(toggle).toBeEnabled({ timeout: 20000 });
  await page.getByRole('button', { name: 'Fullscreen preview' }).click();
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toBeChecked(); await expect(toggle).toBeEnabled();
  await expect(page.locator('.finger-legend')).toContainText('0 open, 1 index');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.score-panel')).not.toHaveClass(/score-expanded/);
  await expect(toggle).toBeChecked();
});

async function pdfEvidence(bytes: Uint8Array) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const text: string[] = [], sizes: number[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      for (const item of content.items) if ('str' in item) {
        text.push(item.str);
        if (item.str.includes('\ue050')) sizes.push(item.height);
      }
    }
    return { pages: pdf.numPages, text: text.join(' '), sizes, metadata: (await pdf.getMetadata()).info };
  } finally { await task.destroy(); }
}

test('PDF button downloads the complete score with current spacing, row count, size, TAB and fingers', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const original = await request.get(`/arrangements/${manifest.id}/arrangement.pdf`).then(r => r.body());
  await openScore(page);
  await expect(page.getByRole('button', { name: 'PDF score', exact: true })).toBeEnabled({ timeout: 20000 });
  for (const [label, value] of [['Preview spacing', 'tight'], ['Bars per row', '4'], ['Notation size', '0.75'], ['TAB fret numbering', 'absolute']] as const) {
    await page.getByLabel(label).selectOption(value);
    await expect(page.getByRole('button', { name: 'PDF score', exact: true })).toBeEnabled();
  }
  await page.getByRole('switch', { name: 'Finger numbers' }).check();
  await expect(page.getByRole('button', { name: 'PDF score', exact: true })).toBeEnabled();
  await page.getByRole('switch', { name: 'Measure details' }).check();
  await expect(page.getByRole('button', { name: 'PDF score', exact: true })).toBeEnabled();
  await page.getByLabel('Practice tempo').selectOption('0.5');
  await page.getByRole('button', { name: 'Mute bass', exact: true }).click();
  await page.getByRole('button', { name: 'Loop measures', exact: true }).click();
  await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
  const response = page.waitForResponse(r => r.url().includes('/preview.pdf?'));
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF score', exact: true }).click();
  const download = await downloaded, http = await response;
  expect(download.suggestedFilename()).toMatch(/-preview-layout\.pdf$/);
  expect(http.status()).toBe(200); expect(http.headers()['content-type']).toBe('application/pdf');
  const query = new URL(http.url()).searchParams;
  expect(Object.fromEntries(query)).toEqual({ spacing: 'tight', barsPerRow: '4', scale: '0.75', fretMode: 'absolute', showFingerNumbers: 'true', showMeasureLabels: 'true' });
  const first = await pdfEvidence(await readFile((await download.path())!));
  expect(first.metadata).toMatchObject({ Keywords: query.toString() });
  expect(first.text).toContain('tight spacing'); expect(first.text).toContain('4 bars per row');
  expect(first.text).toContain('size 75%'); expect(first.text).toContain('absolute neck TAB');
  const lastWrittenBar = await request.get(`/arrangements/${manifest.id}/score.json`).then(r => r.json()).then(score => score.bars.at(-1).number);
  expect(first.text).toMatch(new RegExp(`\\bS${lastWrittenBar}\\b`)); expect(first.text).toMatch(/[\uED10-\uED14]/);
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await expect(page.getByText('PDF downloaded with the selected preview layout.', { exact: true })).toBeVisible();
  await page.getByLabel('Notation size').selectOption('0.5');
  const again = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF score', exact: true }).click();
  const second = await pdfEvidence(await readFile((await (await again).path())!));
  expect(second.sizes[0]! / first.sizes[0]!).toBeCloseTo(2 / 3, 5);
  expect(second.pages).toBeLessThanOrEqual(first.pages);
  expect(second.text).toContain('size 50%');
  expect(await request.get(`/arrangements/${manifest.id}/arrangement.pdf`).then(r => r.body())).toEqual(original);
  expect(errors).toEqual([]);
});

test('PDF export errors stay retryable, never download error bytes, and keep the Original PDF available', async ({ page }) => {
  let downloads = 0; page.on('download', () => downloads++);
  await page.route('**/preview.pdf?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'PDF test failure. Use the Original PDF.' }) }));
  await openScore(page);
  const button = page.getByRole('button', { name: 'PDF score', exact: true });
  await expect(button).toBeEnabled({ timeout: 20000 }); await button.click();
  await expect(page.getByRole('alert')).toContainText('PDF test failure');
  await expect(button).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Original PDF', exact: true })).toBeVisible();
  expect(downloads).toBe(0);
  await page.unroute('**/preview.pdf?**');
  await page.route('**/preview.pdf?**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Not a PDF</h1>' }));
  await button.click(); await expect(page.getByRole('alert')).toContainText('not a PDF'); expect(downloads).toBe(0);
  await page.unroute('**/preview.pdf?**');
  const downloaded = page.waitForEvent('download'); await button.click();
  expect((await readFile((await (await downloaded).path())!)).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

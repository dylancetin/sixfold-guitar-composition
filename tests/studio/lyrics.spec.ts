import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { add, ScoreV1Schema, subtract } from '../../src/domain';
import type { PreviewLyrics } from '../../src/lyrics';

async function publication(request: APIRequestContext) {
  const library = await (await request.get('/api/arrangements')).json();
  const manifest = library.arrangements[0]?.manifest;
  if (!manifest) throw new Error('Requires a real published arrangement.');
  const path = `/arrangements/${manifest.id}`;
  const score = ScoreV1Schema.parse(await (await request.get(`${path}/score.json`)).json());
  const sound = score.sounds.find(s => s.role === 'melody' && s.provenance.kind === 'source')!;
  if (sound.provenance.kind !== 'source') throw new Error('Requires selected source melody');
  const eventId = sound.provenance.eventIds[0]!;
  const selector = score.selection.sections.flatMap(s => s.selectors).find(s => s.eventIds.includes(eventId))!;
  const segment = score.notation.find(s => s.eventId === sound.id)!;
  const bar = score.bars.find(b => b.id === segment.barId)!;
  const lyrics: PreviewLyrics = {
    sourceRevision: score.source.revision, scoreRevision: { id: score.revision.id, digest: score.revision.digest },
    syllables: [{ id: 'original-browser-lyric', text: 'FixtureSun', line: 1,
      source: { eventId, beatId: eventId.replace(/:n\d+$/, ''), partId: selector.partId, voiceId: selector.voiceId, barId: bar.id },
      writtenStart: sound.start, soundId: sound.id, segmentId: segment.id,
      occurrences: score.occurrences.filter(o => o.writtenBarId === bar.id).map(o => ({ occurrenceId: o.id, start: add(o.start, subtract(sound.start, bar.start)) })),
    }],
  };
  return { path, lyrics };
}

async function lyricResponse(page: Page, path: string, response: unknown, status = 200) {
  await page.route(`**${path}/lyrics.json`, route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(response) }));
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`engraved lyrics toggle under notation without resetting playback at ${viewport.width}px`, async ({ page, request }) => {
    const { path, lyrics } = await publication(request);
    await page.setViewportSize(viewport);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const files = ['score.json', 'arrangement.pdf', 'arrangement.mid'];
    const before = await Promise.all(files.map(file => request.get(`${path}/${file}`).then(response => response.body())));
    await lyricResponse(page, path, lyrics);
    await page.goto(path);
    const toggle = page.getByRole('switch', { name: 'Lyrics', exact: true });
    const engraved = page.locator('.native-fragment svg text').filter({ hasText: /^FixtureSun$/ });
    await expect(page.locator('#preview-toolbar')).toBeHidden();
    await expect(toggle).toBeVisible(); await expect(toggle).toBeChecked();
    await expect(engraved).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator('.lyrics-preview')).toHaveCount(0);
    const geometry = await engraved.evaluate(node => {
      const lyric = node.getBoundingClientRect();
      const svg = node.closest('svg')!;
      const numbers = [...svg.querySelectorAll('text')].filter(t => /^\d+$/.test(t.textContent ?? '') && (t.getAttribute('style') ?? '').includes('14px Arial')).map(t => t.getBoundingClientRect());
      return { lyricY: lyric.y, firstTabY: Math.min(...numbers.map(r => r.y)) };
    });
    expect(geometry.lyricY).toBeLessThan(geometry.firstTabY);
    await page.getByRole('button', { name: 'Play arrangement', exact: true }).click({ timeout: 20000 });
    await toggle.focus(); await page.keyboard.press('Space');
    await expect(toggle).not.toBeChecked(); await expect(engraved).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
    await toggle.check(); await expect(engraved).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore preview controls' }).click();
    await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
    await page.getByLabel('Jump to measure').selectOption('2');
    await page.getByLabel('Preview spacing').selectOption('compact');
    await expect(page.getByLabel('Preview spacing')).toBeEnabled();
    await expect(engraved).toHaveCount(1);
    await page.getByLabel('Notation size').selectOption('0.75');
    await expect(engraved).toHaveCount(1);
    await page.getByLabel('Practice tempo').selectOption('0.75');
    await page.getByLabel('Loop first measure').selectOption('0');
    await page.getByLabel('Loop last measure').selectOption('1');
    await page.getByRole('button', { name: 'Loop measures' }).click();
    await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
    await expect(engraved).toHaveCount(1);
    await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
    await page.getByRole('button', { name: 'Loop measures' }).click();
    await page.getByRole('button', { name: 'Minimize preview controls' }).click();
    await page.getByRole('button', { name: 'Fullscreen preview' }).click();
    await expect(engraved).toBeAttached(); await expect(toggle).toBeVisible();
    await page.getByRole('button', { name: 'Exit fullscreen' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await Promise.all(files.map(file => request.get(`${path}/${file}`).then(response => response.body())))).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('late lyric loading respects an off switch while notation and playback are already available', async ({ page, request }) => {
  const { path, lyrics } = await publication(request);
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${path}/lyrics.json`, async route => {
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lyrics) });
  });
  await page.goto(path);
  await expect(page.locator('#lyrics-preview-note')).toContainText('Loading synchronized lyrics');
  await page.getByRole('button', { name: 'Play arrangement', exact: true }).click({ timeout: 20000 });
  const toggle = page.getByRole('switch', { name: 'Lyrics', exact: true });
  await toggle.uncheck(); release();
  await expect(page.locator('#lyrics-preview-note')).toContainText('Lyrics aligned beneath');
  const engraved = page.locator('.native-fragment svg text').filter({ hasText: /^FixtureSun$/ });
  await expect(engraved).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await toggle.check(); await expect(engraved).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
});

for (const state of ['empty', 'unavailable', 'wrong source revision', 'wrong score revision', 'unsupported anchor'] as const) {
  test(`${state} lyrics do not prevent score playback`, async ({ page, request }) => {
    const { path, lyrics } = await publication(request);
    if (state === 'empty') lyrics.syllables = [];
    if (state === 'wrong source revision') lyrics.sourceRevision.id = 'different-source';
    if (state === 'wrong score revision') lyrics.scoreRevision.id = 'different-score';
    if (state === 'unsupported anchor') lyrics.syllables[0]!.segmentId = 'not-a-segment';
    await lyricResponse(page, path, state === 'unavailable' ? { error: 'Unavailable' } : lyrics, state === 'unavailable' ? 503 : 200);
    await page.goto(path);
    await expect(page.locator('#lyrics-preview-note')).toContainText(state === 'empty' || state === 'unsupported anchor' ? 'No supported lyrics' : 'Verified lyrics unavailable');
    await expect(page.locator('.native-fragment svg text').filter({ hasText: /^FixtureSun$/ })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Lyrics', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Play arrangement', exact: true }).click({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  });
}

// Independent browser check; run with Bun and the documented environment.
// Non-invasive: observes actual WebAudio gains/cursor,
// never substitutes an adapter or score. Requires retained Project Shelf URL.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(`${process.env.REVIEW_WORKSPACE}/package.json`)('playwright');
const origin = process.env.VIEWER_URL, output = process.env.REVIEW_OUTPUT;
assert(origin && output); await mkdir(output, { recursive: true });
const id = 'arr-1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const errors = [], writes = [], captures = [], observed = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.addInitScript(() => {
    const Native = window.AudioContext; window.reviewAudio = [];
    window.AudioContext = class extends Native {
      constructor(...args) { super(...args); window.reviewAudio.push(this); this.reviewGains = []; this.reviewOscillators = 0; this.reviewSchedules = []; }
      createGain() { const node = super.createGain(); this.reviewGains.push(node); return node; }
      createOscillator() {
        this.reviewOscillators++;
        const node = super.createOscillator(), record = { frequency: 0, start: 0, stops: [] };
        const start = node.start.bind(node), stop = node.stop.bind(node);
        // AudioParam.value can still be its default before the audio quantum runs;
        // observe the exact native scheduling arguments, without altering them.
        const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
        node.frequency.setValueAtTime = (value, when) => { record.frequency = value; return setFrequency(value, when); };
        node.start = (when = 0) => { record.start = when; return start(when); };
        node.stop = (when = 0) => { record.stops.push(when); return stop(when); };
        this.reviewSchedules.push(record); return node;
      }
    };
  });
  await page.goto(origin); await page.locator('.arrangement-row').first().waitFor();
  observed.libraryEntries = await page.locator('.arrangement-row').count();
  await page.screenshot({ path: `${output}/library-desktop.png`, fullPage: true });
  await page.goto(`${origin}/arrangements/${id}`); await page.reload();
  await page.waitForFunction(() => { const button = document.querySelector('.play-button'); return button && !button.disabled; });
  observed.nativeTargets = await page.locator('.native-note-target').count(); assert(observed.nativeTargets > 300);
  await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
  await page.waitForTimeout(1200);
  observed.audio = await page.evaluate(() => window.reviewAudio.map(c => ({ state: c.state, clock: c.currentTime, oscillators: c.reviewOscillators, gains: c.reviewGains.slice(0, 3).map(n => n.gain.value) })));
  assert(observed.audio.some(c => c.state === 'running' && c.clock > 1 && c.oscillators > 0));
  const fullSpeedNotes = await page.evaluate(() => window.reviewAudio.at(-1).reviewSchedules.slice(0, 3).map(n => ({ frequency: n.frequency, duration: n.stops[0] - n.start })));
  assert(fullSpeedNotes.some(note => note.frequency !== 440) && fullSpeedNotes.every(note => note.frequency > 0));
  const gains = () => page.evaluate(() => window.reviewAudio.at(-1).reviewGains.slice(0, 3).map(n => n.gain.value));
  const waitGains = values => page.waitForFunction(expected => window.reviewAudio.at(-1).reviewGains.slice(0, 3).every((node, i) => expected[i] ? node.gain.value > .6 : node.gain.value === 0), values);
  await page.getByRole('button', { name: 'Mute bass', exact: true }).click();
  await waitGains([1, 0, 1]);
  observed.muted = await gains(); assert(observed.muted[0] > .6 && observed.muted[1] === 0 && observed.muted[2] > .6);
  await page.getByRole('button', { name: 'Solo melody', exact: true }).click();
  await waitGains([1, 0, 0]);
  observed.solo = await gains(); assert(observed.solo[0] > .6 && observed.solo[1] === 0 && observed.solo[2] === 0);
  await page.getByRole('button', { name: 'Mute melody', exact: true }).click();
  await waitGains([0, 0, 0]);
  assert.deepEqual(await gains(), [0, 0, 0]);
  await page.getByRole('button', { name: 'Mute melody', exact: true }).click();
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const paused = await page.locator('.time-readout').innerText(); await page.waitForTimeout(1100);
  assert.equal(await page.locator('.time-readout').innerText(), paused);
  await page.getByLabel('Practice tempo').selectOption('0.5');
  observed.halfSpeed = await page.locator('.time-readout').innerText(); assert.match(observed.halfSpeed, /5:44/);
  await page.getByRole('button', { name: 'Stop playback', exact: true }).click();
  const marker = await page.evaluate(() => window.reviewAudio.at(-1).reviewSchedules.length);
  await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
  // The third attack is not simultaneous with the two opening notes; at 50%
  // its source onset is 1.5 seconds, so observe long enough for it to be scheduled.
  await page.waitForTimeout(1800);
  const halfSpeedNotes = await page.evaluate(from => window.reviewAudio.at(-1).reviewSchedules.slice(from, from + 3).map(n => ({ frequency: n.frequency, duration: n.stops[0] - n.start })), marker);
  assert.equal(halfSpeedNotes.length, 3);
  for (const [i, note] of halfSpeedNotes.entries()) {
    assert.equal(note.frequency, fullSpeedNotes[i].frequency);
    assert(note.duration / fullSpeedNotes[i].duration > 1.9 && note.duration / fullSpeedNotes[i].duration < 2.1);
  }
  observed.livePracticeScheduling = { fullSpeedNotes, halfSpeedNotes, samePitchesDoubleHolds: true };
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await page.getByLabel('Practice tempo').selectOption('1');
  await page.getByLabel('Jump to measure').selectOption('8');
  assert(await page.locator('.score-viewport').evaluate(e => e.scrollTop > 0));
  await page.getByLabel('Loop first measure').selectOption('8'); await page.getByLabel('Loop last measure').selectOption('8');
  await page.getByRole('button', { name: 'Loop measures', exact: true }).click();
  await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
  const samples = await page.evaluate(async () => {
    const result = [];
    for (let i = 0; i < 65; i++) { const c = document.querySelector('.native-cursor'); result.push({ measure: document.querySelector('[aria-label="Jump to measure"]').value, time: document.querySelector('.time-readout').textContent, cursor: c.style.cssText, hidden: c.hidden }); await new Promise(r => setTimeout(r, 100)); }
    return result;
  });
  assert(samples.every(s => s.measure === '8')); assert(samples.some(s => !s.hidden));
  assert(new Set(samples.filter(s => !s.hidden).map(s => s.cursor)).size > 1);
  const seconds = text => { const [m, s] = text.split('/')[0].trim().split(':').map(Number); return m * 60 + s; };
  assert(samples.some((s, i) => i > 0 && seconds(s.time) < seconds(samples[i - 1].time)), 'Loop must actually wrap, not just toggle a button');
  observed.loopSamples = samples;
  await page.getByRole('button', { name: 'Stop playback', exact: true }).click();
  assert.match(await page.locator('.time-readout').innerText(), /^0:00/); assert.equal(await page.getByLabel('Jump to measure').inputValue(), '0');
  await page.getByLabel('Inspect a written note').selectOption({ index: 1 });
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.score-viewport').scrollTop = 0; });
  await page.screenshot({ path: `${output}/viewer-desktop.png`, fullPage: true }); captures.push('viewer-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin); await page.locator('.arrangement-row').first().waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${output}/library-mobile.png`, fullPage: true });
  await page.goto(`${origin}/arrangements/${id}`); await page.waitForFunction(() => { const button = document.querySelector('.play-button'); return button && !button.disabled; });
  await page.getByLabel('Inspect a written note').selectOption({ index: 1 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${output}/viewer-mobile.png`, fullPage: true }); captures.push('viewer-mobile.png');
  await page.getByLabel('Notation size').selectOption('1.5'); await page.getByLabel('Jump to measure').selectOption('63');
  assert(await page.locator('.score-viewport').evaluate(e => e.scrollTop > 1000));
  await page.screenshot({ path: `${output}/viewer-mobile-final.png`, fullPage: true });
  await page.goto(`${origin}/arrangements/arr-${'0'.repeat(64)}`);
  await page.getByRole('heading', { name: 'This score couldn’t be opened.' }).waitFor();
  assert.equal(await page.locator('.download-actions a').count(), 0);
  observed.unknownShowsErrorWithoutDownload = true; assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await writeFile(`${output}/browser-independent.json`, JSON.stringify({ checkedAt: new Date().toISOString(), status: 'passed', browser: await browser.version(), origin, id, observed, captures, errors, writes, limitation: 'Headless real WebAudio scheduling/gains, not human audition or physical latency calibration.' }, null, 2));
  console.log('PASS: live oscillator/clock/gains, mute-over-solo, pause/stop, half-speed actual note scheduling, actual loop wrap/cursor, desktop/mobile/final seek, unknown error');
} finally { await browser.close(); }

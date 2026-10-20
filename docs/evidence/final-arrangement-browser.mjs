// Non-substituting real Chromium/WebAudio check of the exact final publication.
// VIEWER_URL, PUBLISH_RESULT, REVIEW_DIR required; never launches a server.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright-core');
const origin = process.env.VIEWER_URL, out = process.env.REVIEW_DIR;
const pub = JSON.parse(await readFile(process.env.PUBLISH_RESULT, 'utf8'));
const score = JSON.parse(await readFile(`${pub.directory}/score.json`, 'utf8'));
assert(origin && out && pub.links.viewer.startsWith(origin));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const errors = [], writes = [], observed = {}, captures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!['GET','HEAD'].includes(r.method())) writes.push(r.url()); });
  await page.addInitScript(() => {
    const Native = window.AudioContext; window.reviewAudio = [];
    window.AudioContext = class extends Native {
      constructor(...args) { super(...args); window.reviewAudio.push(this); this.reviewGains = []; this.reviewSchedules = []; }
      createGain() { const n = super.createGain(); this.reviewGains.push(n); return n; }
      createOscillator() {
        const n = super.createOscillator(), record = { frequency: 0, start: 0, stops: [] };
        const start = n.start.bind(n), stop = n.stop.bind(n), frequency = n.frequency.setValueAtTime.bind(n.frequency);
        n.frequency.setValueAtTime = (v,t) => { record.frequency = v; return frequency(v,t); };
        n.start = (t=0) => { record.start = t; return start(t); };
        n.stop = (t=0) => { record.stops.push(t); return stop(t); };
        this.reviewSchedules.push(record); return n;
      }
    };
  });
  await page.goto(origin);
  await page.getByRole('link', { name: 'The Beach Boys — You Still Believe in Me', exact: true }).click();
  assert.equal(page.url(), pub.links.viewer);
  await page.reload();
  const ready = () => page.waitForFunction(() => { const b=document.querySelector('.play-button'); return b && !b.disabled; });
  await ready();console.log('ready');
  observed.nativeTargets = await page.locator('.native-note-target').count();
  assert(observed.nativeTargets > 500);
  assert.match(await page.locator('.score-facts').innerText(), /No capo/);
  assert.match(await page.locator('.voice-mixer').innerText(), /98 attacks/);
  assert.equal(await page.locator('.review-label').innerText(), 'Unreviewed draft');
  await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
  await page.waitForTimeout(1300);
  observed.audio = await page.evaluate(() => window.reviewAudio.map(c => ({ state:c.state, clock:c.currentTime, scheduled:c.reviewSchedules.length })));
  assert(observed.audio.some(c => c.state==='running' && c.clock>1 && c.scheduled>0));console.log('audio running');
  const schedules = from => page.evaluate(i => window.reviewAudio.at(-1).reviewSchedules.slice(i).map(n => ({frequency:n.frequency,duration:n.stops[0]-n.start})), from);
  const fullSpeed = (await schedules(0)).slice(0,3);
  const waitGains = expected => page.waitForFunction(values => window.reviewAudio.at(-1).reviewGains.slice(0,3).every((n,i) => values[i] ? n.gain.value>.6 : n.gain.value===0), expected);
  const gains = () => page.evaluate(() => window.reviewAudio.at(-1).reviewGains.slice(0,3).map(n=>n.gain.value));
  await page.getByRole('button', { name:'Mute bass',exact:true }).click(); await waitGains([1,0,1]); observed.muted = await gains();console.log('muted');
  await page.getByRole('button', { name:'Solo melody',exact:true }).click(); await waitGains([1,0,0]); observed.solo = await gains();console.log('solo');
  await page.getByRole('button', { name:'Pause playback',exact:true }).click();
  const paused = await page.locator('.time-readout').innerText(); await page.waitForTimeout(300); assert.equal(await page.locator('.time-readout').innerText(),paused);
  await page.getByLabel('Practice tempo').selectOption('0.5'); assert.match(await page.locator('.time-readout').innerText(), /5:44/);
  await page.getByRole('button', { name:'Stop playback',exact:true }).click();
  let marker = await page.evaluate(() => window.reviewAudio.at(-1).reviewSchedules.length);
  await page.getByRole('button', { name:'Play arrangement',exact:true }).click(); await page.waitForTimeout(1800);
  const halfSpeed = (await schedules(marker)).slice(0,3); assert.equal(halfSpeed.length,3);
  for(const [i,n] of halfSpeed.entries()){assert.equal(n.frequency,fullSpeed[i].frequency);assert(Math.abs(n.duration/fullSpeed[i].duration-2)<.1);}
  observed.speed = { fullSpeed, halfSpeed, unchangedPitchesDoubleHolds:true };console.log('speed passed');
  await page.getByRole('button', { name:'Pause playback',exact:true }).click();
  await page.getByLabel('Practice tempo').selectOption('1');
  // Hear all roles again; muted scheduling is otherwise still canonical but silent.
  await page.getByRole('button', { name:'Mute bass',exact:true }).click();
  await page.getByRole('button', { name:'Solo melody',exact:true }).click();
  // AudioParam.value updates on a live audio quantum; restarting below resumes it.
  const q = x => x.n/x.d;
  observed.changedBars = [];
  for(const bar of [8,35]) {
    const index = score.occurrences.findIndex(o => o.writtenBarId===`bar-${bar}`);
    await page.getByLabel('Jump to measure').selectOption(String(index));
    marker = await page.evaluate(() => window.reviewAudio.at(-1).reviewSchedules.length);
    await page.getByRole('button', { name:'Play arrangement',exact:true }).click();
    // 90 BPM: observes final attack plus look-ahead, but stops before next bar.
    await page.waitForTimeout(2350);
    const played = await schedules(marker);
    const at = q(score.occurrences[index].start), sounds = new Map(score.sounds.map(s=>[s.id,s]));
    const expected = score.performedSounds.filter(p=>q(p.start)<at+4 && q(p.start)+q(p.duration)>at).map(p=>sounds.get(p.soundId).soundingMidi).sort((a,b)=>a-b);
    // Exact canonical quarters become floating AudioContext seconds. A seek can
    // schedule a just-ended predecessor for ~1e-15s; retain and disclose these
    // numerical boundary records, rather than count them as audible attacks.
    const boundaryRecords = played.filter(n=>n.duration<=1e-9);
    assert(boundaryRecords.every(n=>n.duration>=0));
    const actual = played.filter(n=>n.duration>1e-9).map(n=>Math.round(69+12*Math.log2(n.frequency/440))).sort((a,b)=>a-b);
    if(JSON.stringify(actual)!==JSON.stringify(expected)) console.log(JSON.stringify({bar,expected,actual,played,time:await page.locator('.time-readout').innerText(),index:await page.getByLabel('Jump to measure').inputValue()}));
    assert.deepEqual(actual,expected,`actual complete browser pitch multiset in changed bar ${bar}`);
    observed.changedBars.push({writtenBar:bar,occurrence:index+1,actualPitches:actual,exactPitchMultisetAbove1ns:true,numericalBoundaryRecords:boundaryRecords});
    await page.getByRole('button', { name:'Pause playback',exact:true }).click();
  }
  await page.getByLabel('Loop first measure').selectOption('8');await page.getByLabel('Loop last measure').selectOption('8');
  await page.getByRole('button', { name:'Loop measures',exact:true }).click();await page.getByLabel('Jump to measure').selectOption('8');
  await page.getByRole('button', { name:'Play arrangement',exact:true }).click();
  const samples = await page.evaluate(async () => { const samples=[]; for(let i=0;i<65;i++){const c=document.querySelector('.native-cursor');samples.push({measure:document.querySelector('[aria-label="Jump to measure"]').value,time:document.querySelector('.time-readout').textContent,cursor:c.style.cssText,hidden:c.hidden});await new Promise(r=>setTimeout(r,100));}return samples; });
  const seconds = t => { const [m,s]=t.split('/')[0].trim().split(':').map(Number);return m*60+s; };
  assert(samples.every(s=>s.measure==='8'));assert(new Set(samples.filter(s=>!s.hidden).map(s=>s.cursor)).size>1);
  assert(samples.some((s,i)=>i>0&&seconds(s.time)<seconds(samples[i-1].time)));observed.loopSamples=samples;
  await page.getByRole('button', { name:'Stop playback',exact:true }).click();
  await page.getByRole('button', { name:'Loop measures',exact:true }).click();
  await page.getByLabel('Inspect a written note').selectOption({index:1});
  await page.evaluate(() => { window.scrollTo(0,0);document.querySelector('.score-viewport').scrollTop=0; });
  await page.screenshot({path:`${out}/viewer-desktop.png`});captures.push('viewer-desktop.png');
  await page.getByLabel('Jump to measure').selectOption('40');
  await page.screenshot({path:`${out}/viewer-desktop-bar35.png`});captures.push('viewer-desktop-bar35.png');
  await page.setViewportSize({width:390,height:1300});await page.goto(pub.links.viewer);await ready();
  assert(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/viewer-mobile.png`});captures.push('viewer-mobile.png');
  await page.getByLabel('Notation size').selectOption('1.25');await page.getByLabel('Jump to measure').selectOption('63');
  assert(await page.locator('.score-viewport').evaluate(e=>e.scrollTop>1000));
  await page.screenshot({path:`${out}/viewer-mobile-final.png`});captures.push('viewer-mobile-final.png');
  assert(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
  observed.finalMeasure = await page.getByLabel('Jump to measure').inputValue();
  // Scroll to notes and check readable wrapping without capturing the whole score/audit.
  await page.locator('.arrangement-notes').scrollIntoViewIfNeeded();
  observed.notes = {chars:(await page.locator('.markdown-notes').innerText()).length,noPageOverflow:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),auditHeavy:true};
  assert(observed.notes.noPageOverflow);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await writeFile(`${out}/browser-independent.json`,JSON.stringify({status:'VERIFIED',checkedAt:new Date().toISOString(),origin,id:pub.id,browser:await browser.version(),observed,captures,errors,writes,limitation:'Real headless WebAudio scheduling, not human listening or movement calibration'},null,2)+'\n');
  console.log('VERIFIED final exact-data library/reload/audio/changed-bars/tempo/loop/cursor/mixer/desktop/mobile');
} finally { await browser.close(); }

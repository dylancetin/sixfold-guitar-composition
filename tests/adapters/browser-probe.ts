// Real Chromium/WebAudio boundary probe; no web server, endpoints, React or external content.
// Run: bun tests/adapters/browser-probe.ts [artifact-directory]
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { study } from './fixture';

const root = path.resolve(process.argv[2] ?? '/tmp/opencode/guitar-adapters-u11-u12');
await mkdir(root, { recursive: true });
const fixture = await study(12, 2, 2);
const build = await Bun.build({ entrypoints: [path.resolve('src/adapters/index.ts')], target: 'browser', minify: false });
assert(build.success, 'Browser bundle failed');
const bundle = await build.outputs[0]!.text();
const font = await readFile(path.resolve('node_modules/@coderline/alphatab/dist/font/Bravura.woff2'));
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Canonical notation / WebAudio evidence</title><style>
@font-face{font-family:alphaTab;src:url(data:font/woff2;base64,${font.toString('base64')})}
body{margin:28px;background:#f4f3ef;color:#171e24;font:15px system-ui}header{max-width:900px}h1{font:28px Georgia;margin:0 0 10px}p{margin:6px 0}button{padding:10px 20px;margin:12px 0;background:#183b37;color:white;border:0;border-radius:4px}#score{position:relative;background:white;width:900px;box-shadow:0 1px 8px #0002}#score>div{position:absolute}#status{color:#255a50;font-weight:600}
</style></head><body><header><h1>Canonical guitar adapter evidence</h1><p>Original held-voice study · capo-relative TAB · one unfolded timeline</p><p>Synthetic plucked WebAudio; not a recorded guitar or musical approval.</p><button id="play">Run WebAudio probe</button><p id="status">Loading notation; audio requires a gesture.</p></header><div id="score"></div><script type="module">
${bundle}
const canonical = ${JSON.stringify(fixture.score)};
const notation = createAlphaTabScore(canonical, {title:'Original held-voice study'});
await document.fonts.load('34px alphaTab');
const layout = await notation.renderSvg(900);
const sheet = document.querySelector('#score'); sheet.style.height=layout.height+'px';
for(const f of layout.fragments){const element=document.createElement('div');element.style.left=f.x+'px';element.style.top=f.y+'px';element.innerHTML=f.svg;sheet.appendChild(element);}
let ctx, analyser; const gains=[], roleAnalysers=[];
const audio=createPlaybackController(canonical,{audioContextFactory:()=>{
  ctx=new AudioContext(); analyser=ctx.createAnalyser(); analyser.fftSize=2048; analyser.connect(ctx.destination);
  const make=ctx.createGain.bind(ctx);
  ctx.createGain=()=>{const gain=make();const connect=gain.connect.bind(gain);gain.connect=(target,...args)=>{if(target===ctx.destination){const roleAnalyser=ctx.createAnalyser();roleAnalyser.fftSize=2048;roleAnalyser.connect(analyser);roleAnalysers.push(roleAnalyser);return connect(roleAnalyser,...args);}return connect(target,...args);};gains.push(gain);return gain;};
  return ctx;
}});
const result={kind:'real-Chromium-WebAudio-not-human-audition',initial:audio.getSnapshot(),sampleCount:0,maxCursorDriftMs:0,peakRms:0,errors:[]};
window.probe={audio,result,ready:true,done:false};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rms=(node=analyser)=>{const samples=new Float32Array(node.fftSize);node.getFloatTimeDomainData(samples);return Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);};
document.querySelector('#status').textContent='Notation loaded. Press Run to unlock and measure actual WebAudio.';
document.querySelector('#play').onclick=async()=>{try{
  await audio.play(); result.gestureReady=audio.getSnapshot();
  await delay(150); result.peakRms=rms();
  audio.setMuted('bass',true); await delay(80); result.bassMuteGain=gains[1].gain.value;result.mutedBassRms=rms(roleAnalysers[1]);
  audio.setSolo('melody',true);await delay(80);result.harmonySoloGain=gains[2].gain.value;result.soloExcludedHarmonyRms=rms(roleAnalysers[2]);result.soloMelodyRms=rms(roleAnalysers[0]);
  await delay(150); audio.pause();const paused=audio.getSnapshot().positionQuarter;
  await delay(100);result.pausedQuarterDrift=Math.abs(audio.getSnapshot().positionQuarter-paused);result.pauseRms=rms();result.pauseActiveSources=audio.getMetrics().activeSourceCount;
  audio.setMuted('bass',false);audio.setSolo('melody',false);audio.setTempoScale(0.5);audio.seek(4.5);await audio.play();
  result.seekSnapshot=audio.getSnapshot();result.seekResumed=audio.getMetrics().scheduleLog.filter(r=>r.performedSoundId==='m4@o1-p1').at(-1);
  audio.stop();result.stopSnapshot=audio.getSnapshot();result.stopActiveSources=audio.getMetrics().activeSourceCount;
  audio.setTempoScale(1.25);audio.setLoop({startQuarter:0,endQuarter:4});await audio.play();
  const anchor=audio.getMetrics().scheduleLog.filter(r=>r.performedSoundId==='m0@o1-p1'&&r.cycle===0).at(-1).expectedAudioTime;
  const sampler=setInterval(()=>{const snapshot=audio.getSnapshot();const now=audio.getMetrics().audioClockSeconds;const expected=((now-anchor)*100/60)%4;const delta=Math.abs(snapshot.positionQuarter-expected);result.maxCursorDriftMs=Math.max(result.maxCursorDriftMs,Math.min(delta,4-delta)*600);result.peakRms=Math.max(result.peakRms,rms());result.sampleCount++;},25);
  document.querySelector('#status').textContent='Measuring 60 seconds and at least twenty audio-clock loops…';
  await delay(60050);clearInterval(sampler);result.elapsedAudioSeconds=ctx.currentTime-anchor;result.final=audio.getSnapshot();result.metrics=audio.getMetrics();
  await audio.dispose();result.disposed=audio.getSnapshot();window.probe.done=true;document.querySelector('#status').textContent='Completed: real WebAudio samples, cancellation, tempo, seek and 60-second loop/cursor measurement.';
}catch(error){result.errors.push(String(error.stack??error));window.probe.done=true;}};
</script></body></html>`;
await writeFile(path.join(root, 'browser-probe.html'), html);
const cached = await Array.fromAsync(new Bun.Glob('chromium-*/chrome-linux64/chrome').scan({ cwd: path.join(process.env.HOME!, '.cache/ms-playwright'), absolute: true }));
const executablePath = process.env.ADAPTERS_CHROMIUM ?? cached.sort().at(-1);
assert(executablePath, 'Set ADAPTERS_CHROMIUM to a local Chromium executable');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 980, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`file://${path.join(root, 'browser-probe.html')}`);
  await page.waitForFunction(() => (window as any).probe?.ready, { timeout: 15000 });
  await page.locator('#play').click();
  await page.waitForFunction(() => (window as any).probe?.done, null, { timeout: 75000 });
  const result = await page.evaluate(() => (window as any).probe.result);
  await page.screenshot({ path: path.join(root, 'browser-notation.png') });
  await writeFile(path.join(root, 'browser-audio.json'), JSON.stringify({ executablePath, browserVersion: browser.version(), errors, ...result }, null, 2));
  assert.deepEqual(errors, []); assert.deepEqual(result.errors, []);
  assert.equal(result.initial.readiness, 'needs-gesture'); assert.equal(result.gestureReady.readiness, 'ready');
  assert.equal(result.bassMuteGain, 0); assert.equal(result.harmonySoloGain, 0);
  assert(result.mutedBassRms < 0.00001); assert(result.soloExcludedHarmonyRms < 0.00001); assert(result.soloMelodyRms > 0.001);
  assert.equal(result.pauseActiveSources, 0); assert.equal(result.stopActiveSources, 0); assert.equal(result.pausedQuarterDrift, 0);
  assert(result.pauseRms < 0.00001, `Paused audio still audible: RMS ${result.pauseRms}`);
  assert(result.peakRms > 0.001, 'No actual nonzero WebAudio samples');
  assert(result.seekSnapshot.activePerformedSoundIds.includes('m4@o1-p1')); assert(Math.abs(result.seekResumed.elapsedSeconds - 2.25) < 0.02);
  assert(result.elapsedAudioSeconds >= 60); assert(result.metrics.loopCount >= 20);
  assert(result.maxCursorDriftMs < 30); assert(result.metrics.maxScheduleLatenessMs < 30);
  console.log(JSON.stringify({ root, browser: browser.version(), sampleCount: result.sampleCount, peakRms: result.peakRms, pauseRms: result.pauseRms, elapsedAudioSeconds: result.elapsedAudioSeconds, loopCount: result.metrics.loopCount, maxCursorDriftMs: result.maxCursorDriftMs, maxScheduleLatenessMs: result.metrics.maxScheduleLatenessMs, screenshot: path.join(root, 'browser-notation.png') }, null, 2));
} finally { await browser.close(); }

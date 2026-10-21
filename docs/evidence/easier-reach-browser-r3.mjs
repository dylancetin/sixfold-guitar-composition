// Real Chromium/native WebAudio observation; does not start or modify a server.
// VIEWER_URL, REVIEW_DIR, PUBLISH_RESULT, CHROMIUM_PATH required; use documented libs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright-core');
const out=process.env.REVIEW_DIR,origin=process.env.VIEWER_URL;
const pub=JSON.parse(await readFile(process.env.PUBLISH_RESULT,'utf8'));
const score=JSON.parse(await readFile(`${pub.directory}/score.json`,'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const errors=[],writes=[],observed={},captures=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await page.addInitScript(()=>{
    const Native=window.AudioContext;window.reviewAudio=[];
    window.AudioContext=class extends Native{
      constructor(...args){super(...args);window.reviewAudio.push(this);this.reviewSchedules=[];}
      createOscillator(){const n=super.createOscillator(),record={frequency:0,start:0,stops:[]};
        const f=n.frequency.setValueAtTime.bind(n.frequency),start=n.start.bind(n),stop=n.stop.bind(n);
        n.frequency.setValueAtTime=(v,t)=>{record.frequency=v;return f(v,t);};n.start=(t=0)=>{record.start=t;return start(t);};n.stop=(t=0)=>{record.stops.push(t);return stop(t);};this.reviewSchedules.push(record);return n;
      }
    };
  });
  const ready=()=>page.waitForFunction(()=>{const b=document.querySelector('.play-button');return b&&!b.disabled;});
  await page.goto(origin);await page.locator(`a.open-score[href="/arrangements/${pub.id}"]`).click();assert.equal(page.url(),pub.links.viewer);await ready();
  await page.reload();await ready();
  observed.facts=await page.locator('.score-facts').innerText();assert.match(observed.facts,/Capo 2/);assert.match(observed.facts,/Original concert pitches preserved/);
  assert.equal(await page.locator('.review-label').innerText(),'Unreviewed draft');
  const mixer=await page.locator('.voice-mixer').innerText();for(const n of [245,80,9])assert(mixer.includes(`${n} attacks`));
  observed.nativeTargets=await page.locator('.native-note-target').count();assert.equal(observed.nativeTargets,345);
  await page.screenshot({path:`${out}/viewer-desktop.png`});captures.push('viewer-desktop.png');
  observed.downloads=[];
  for(const file of ['arrangement.pdf','arrangement.mid']){
    const target=page.locator(`a[href="/arrangements/${pub.id}/${file}"]`).first();
    const [download]=await Promise.all([page.waitForEvent('download'),target.click()]);
    const path=`${out}/browser-${file}`;await download.saveAs(path);assert.deepEqual(await readFile(path),await readFile(`${pub.directory}/${file}`));
    observed.downloads.push({file,sha256:hash(await readFile(path)),bytesEqual:true});
  }
  const sounds=new Map(score.sounds.map(s=>[s.id,s])),q=x=>x.n/x.d;
  observed.changedBars=[];
  for(const bar of [1,12,30,35,46]){
    const index=score.occurrences.findIndex(o=>o.writtenBarId===`bar-${bar}`),at=q(score.occurrences[index].start);
    await page.getByLabel('Jump to measure').selectOption(String(index));
    const marker=await page.evaluate(()=>window.reviewAudio.at(-1)?.reviewSchedules.length??0);
    await page.getByRole('button',{name:'Play arrangement',exact:true}).click();await page.waitForTimeout(bar===1?2600:2350);
    const state=await page.evaluate(()=>{const c=window.reviewAudio.at(-1);return {state:c.state,clock:c.currentTime};});assert.equal(state.state,'running');assert(state.clock>1);
    const played=await page.evaluate(i=>window.reviewAudio.at(-1).reviewSchedules.slice(i).map(n=>({pitch:Math.round(69+12*Math.log2(n.frequency/440)),duration:n.stops[0]-n.start})),marker);
    const expected=score.performedSounds.filter(p=>q(p.start)<at+4&&q(p.start)+q(p.duration)>at).map(p=>sounds.get(p.soundId).soundingMidi).sort((a,b)=>a-b);
    const actual=played.filter(n=>n.duration>1e-9).map(n=>n.pitch).sort((a,b)=>a-b);
    assert.deepEqual(actual,expected,`complete actual scheduled pitches in written bar ${bar}`);
    observed.changedBars.push({writtenBar:bar,occurrence:index+1,actualPitches:actual,nativeAudio:state,boundaryRecords:played.filter(n=>n.duration<=1e-9)});
    await page.getByRole('button',{name:'Pause playback',exact:true}).click();
    const time=await page.locator('.time-readout').innerText();await page.waitForTimeout(150);assert.equal(await page.locator('.time-readout').innerText(),time);
  }
  await page.getByRole('button',{name:'Stop playback',exact:true}).click();await page.getByLabel('Jump to measure').selectOption('35');
  await page.screenshot({path:`${out}/viewer-desktop-bar30.png`});captures.push('viewer-desktop-bar30.png');
  await page.setViewportSize({width:390,height:1300});await page.goto(pub.links.viewer);await ready();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/viewer-mobile.png`});captures.push('viewer-mobile.png');
  await page.getByLabel('Jump to measure').selectOption('63');assert(await page.locator('.score-viewport').evaluate(e=>e.scrollTop>1000));
  await page.screenshot({path:`${out}/viewer-mobile-final.png`});captures.push('viewer-mobile-final.png');
  observed.finalMeasure=await page.getByLabel('Jump to measure').inputValue();assert.equal(observed.finalMeasure,'63');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await writeFile(`${out}/browser-independent.json`,JSON.stringify({status:'VERIFIED',checkedAt:new Date().toISOString(),id:pub.id,browser:await browser.version(),observed,captures,errors,writes,limitation:'Native headless playback/seek verification, not human listening or comfort'},null,2)+'\n');
  console.log('VERIFIED exact new library/deep-load/reload/downloads, capo2, 345 targets, native playback/seek of bars 1/12/30/35/46, desktop/mobile/final');
}finally{await browser.close();}

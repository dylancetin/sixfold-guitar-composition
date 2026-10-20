import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { project,placementEvidence,midiBytes,render,writePdf } from './adapter.mjs';
import { checkMidi,expected } from './checks.mjs';

const root=path.resolve(process.argv[2]??new URL('artifacts',import.meta.url).pathname);
fs.mkdirSync(root,{recursive:true});
const unitLog=[];
const record=(decision,why,evidence,result)=>{
  unitLog.push([new Date().toISOString(),'U02',decision,why,evidence,result]);
  fs.writeFileSync(`${root}/unit-log.tsv`,['ts\tphase\tdecision\twhy\tevidence\tresult',...unitLog.map(r=>r.join('\t'))].join('\n')+'\n');
};
record('Start bounded export proof','Hypothesis: literal unfolded 24-bar fixture survives independent MIDI and whole-system A4/Letter PDF parsing at capo 0/2; timebox 3 hours',root,'RUNNING');
const tests=spawnSync(process.execPath,['--test','test/checks.test.mjs'],{cwd:new URL('.',import.meta.url),encoding:'utf8'});
fs.writeFileSync(`${root}/negative-controls.tap`,tests.stdout+tests.stderr);
assert.equal(tests.status,0,'verification-first predicate tests must pass before generating artifacts');
record('Establish oracle and negative controls','Reject omission/octave/capo/tie/form/font/clipping before adapter output',`${root}/negative-controls.tap`,'VERIFIED predicate controls only');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest={revision:expected.revision,startedAt:new Date().toISOString(),node:process.version,dependencies:JSON.parse(fs.readFileSync(new URL('package.json',import.meta.url))).dependencies,inputHashes:Object.fromEntries(['fixtures/engraving.tsv','fixtures/oracle.tsv','fixtures/expected.json','package-lock.json'].map(p=>[p,hash(fs.readFileSync(new URL(p,import.meta.url)))])),midi:[],placementChecks:[],actualNegativeControls:[]};
try {
  const licenses=[];
  for(const name of Object.keys(manifest.dependencies)) {
    const dir=new URL(`node_modules/${name}/`,import.meta.url);
    const pkg=JSON.parse(fs.readFileSync(new URL('package.json',dir)));
    const notices=fs.readdirSync(dir).filter(p=>/^(license|licence|copying)/i.test(p));
    licenses.push({name,version:pkg.version,spdx:pkg.license,notices:notices.map(p=>({path:new URL(p,dir).pathname,sha256:hash(fs.readFileSync(new URL(p,dir)))}))});
  }
  for(const [file,dest] of [['dist/font/Bravura-OFL.txt','Bravura-OFL.txt'],['LICENSE','alphaTab-MPL-2.0.txt']]) {
    const bytes=fs.readFileSync(new URL(`node_modules/@coderline/alphatab/${file}`,import.meta.url));
    fs.writeFileSync(`${root}/${dest}`,bytes);
    licenses.push({name:dest,path:`${root}/${dest}`,sha256:hash(bytes)});
  }
  fs.writeFileSync(`${root}/license-inventory.json`,JSON.stringify(licenses,null,2));
  for(const capo of [0,2]) {
    const dir=`${root}/capo-${capo}`;
    fs.mkdirSync(dir,{recursive:true});
    const projection=project(capo), placements=placementEvidence(projection);
    assert.deepEqual(projection.rows.map(r=>r.source),expected.form);
    assert.deepEqual(projection.rows.map(r=>r.pass),expected.passes);
    for(const p of placements) {
      assert.equal(p.actualSound,p.expectedSound,'native sounding pitch');
      assert.equal(p.actualSound,p.openTuning+p.capo+p.relativeFret,'capo-relative formula');
      assert.equal(p.physicalNeckFret,p.capo+p.relativeFret);
      assert.equal(p.writtenPitch,p.actualSound+12,'guitar written octave');
    }
    fs.writeFileSync(`${dir}/placements.json`,JSON.stringify(placements,null,2));
    const midi=midiBytes(projection);
    fs.writeFileSync(`${dir}/fixture.mid`,midi);
    const result=checkMidi(midi);
    manifest.midi.push({capo,...result});
    manifest.placementChecks.push({capo,notesIncludingTieSegments:placements.length,first:placements[0]});
    record(`Parse actual capo ${capo} MIDI`,'Independent literal intervals, balanced on/off, tempo restoration, two parsers',`${dir}/fixture.mid`,'VERIFIED');
    const layout=await render(projection,dir);
    for(const size of ['A4','LETTER']) await writePdf(layout,dir,size,capo);
  }
  // Generate a REAL wrong MIDI through the native capo/transposition trap, not merely a synthetic summary.
  const doubled=midiBytes(project(2,{doubleCapo:true}));
  fs.writeFileSync(`${root}/negative-double-capo.mid`,doubled);
  assert.throws(()=>checkMidi(doubled),/mismatch/);
  manifest.actualNegativeControls.push({name:'native capo2 plus transposition -2 produces +2 error',path:`${root}/negative-double-capo.mid`,rejected:true});
  // Actual PDF controls: valid container with the wrong music font, and a lost final complete system.
  const negativeProjection=project(2),negativeDir=`${root}/negative-pdf-layout`;
  fs.mkdirSync(negativeDir,{recursive:true});
  const negativeLayout=await render(negativeProjection,negativeDir);
  for(const name of ['no-music-font','missing-last-system','clipped-last-system']) {
    const dir=`${root}/negative-${name}`;
    fs.mkdirSync(dir,{recursive:true});
    const layout=name==='missing-last-system' ? {...negativeLayout,units:negativeLayout.units.filter(u=>u.system!==11)} : negativeLayout;
    await writePdf(layout,dir,'A4',2,{omitMusicFont:name==='no-music-font',clipLastSystem:name==='clipped-last-system'});
  }
  const staffDir=`${root}/negative-staff-only`;
  fs.mkdirSync(staffDir,{recursive:true});
  const staffProjection=project(2);
  staffProjection.score.tracks[0].staves[0].showTablature=false;
  const staffLayout=await render(staffProjection,staffDir);
  await writePdf(staffLayout,staffDir,'A4',2);
  fs.writeFileSync(`${root}/generation.json`,JSON.stringify(manifest,null,2));
  const verify=spawnSync(process.execPath,['verify-artifacts.mjs',root],{cwd:new URL('.',import.meta.url),encoding:'utf8'});
  fs.writeFileSync(`${root}/verification.log`,verify.stdout+verify.stderr);
  assert.equal(verify.status,0,`independent artifact check failed; see ${root}/verification.log`);
  record('Verify all actual PDF pages','PDF.js glyph/font/text/vector/raster checks; first/middle/last PNGs available for inspection',`${root}/verification.json`,'VERIFIED automated checks; raster review remains separate');
  console.log(JSON.stringify({root,midi:manifest.midi,verification:`${root}/verification.json`},null,2));
} catch(error) {
  fs.writeFileSync(`${root}/failure.txt`,error.stack+'\n');
  record('Stop failed measurement','Do not weaken a required gate',`${root}/failure.txt`,'NOT VERIFIED');
  throw error;
}

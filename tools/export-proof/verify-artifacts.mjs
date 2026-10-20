import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseMidi,writeMidi } from 'midi-file';
import { checkMidi } from './checks.mjs';
import { inspectPdf } from './pdf-check.mjs';

const root=path.resolve(process.argv[2]??new URL('artifacts',import.meta.url).pathname);
const results={checkedAt:new Date().toISOString(),midi:[],pdf:[],negativeControls:[],hashes:[]};
for(const capo of [0,2]) {
  const file=`${root}/capo-${capo}/fixture.mid`;
  results.midi.push({capo,file,...checkMidi(fs.readFileSync(file))});
  for(const paper of ['A4','LETTER']) results.pdf.push({capo,paper,...await inspectPdf(`${root}/capo-${capo}/${paper}.pdf`,capo,{rasterDir:`${root}/capo-${capo}/${paper}-raster`})});
}
assert.deepEqual(fs.readFileSync(`${root}/capo-0/fixture.mid`),fs.readFileSync(`${root}/capo-2/fixture.mid`),'capo variants must be byte-identical MIDI');

// Mutate actual parsed MIDI events, reserialize to actual SMF, then reject with the same acceptance check.
const baseline=fs.readFileSync(`${root}/capo-0/fixture.mid`);
const mutations={
  'missing-final-melody': parsed=>{parsed.tracks=parsed.tracks.map(track=>{
    let tick=0,carry=0;
    return track.filter(e=>{
      tick+=e.deltaTime;
      const remove=e.noteNumber===66 && ((e.type==='noteOn' && tick===88320) || (e.type==='noteOff' && tick===92160));
      if(remove) {carry+=e.deltaTime;return false;}
      e.deltaTime+=carry;carry=0;return true;
    });
  });},
  'octave-shift': parsed=>{for(const track of parsed.tracks)for(const e of track)if('noteNumber' in e)e.noteNumber+=12;},
  'unbalanced-note-off': parsed=>{const e=parsed.tracks.flat().find(e=>e.type==='noteOff');assert(e);e.noteNumber=1;},
  'tempo-not-restored': parsed=>{for(const track of parsed.tracks){let tick=0;for(const e of track){tick+=e.deltaTime;if(e.type==='setTempo' && tick===30720)e.microsecondsPerBeat=500000;}}}
};
for(const [name,mutate] of Object.entries(mutations)) {
  const parsed=parseMidi(baseline); mutate(parsed);
  const bytes=Buffer.from(writeMidi(parsed)),file=`${root}/negative-${name}.mid`;
  fs.writeFileSync(file,bytes);
  let rejection;
  try {checkMidi(bytes);} catch(error) {rejection=error.message.split('\n')[0];}
  assert(rejection,`actual MIDI negative ${name} was accepted`);
  results.negativeControls.push({name,file,rejected:true,rejection});
}
assert.throws(()=>checkMidi(fs.readFileSync(`${root}/negative-double-capo.mid`)),/mismatch/);
results.negativeControls.push({name:'native double capo',rejected:true});
for(const name of ['no-music-font','missing-last-system','clipped-last-system','staff-only']) {
  const file=`${root}/negative-${name}/A4.pdf`;
  let rejection;
  try {await inspectPdf(file,2);} catch(error) {rejection=error.message.split('\n')[0];}
  assert(rejection,`actual PDF negative ${name} was accepted`);
  results.negativeControls.push({name,file,rejected:true,rejection});
}
for(const entry of fs.readdirSync(root,{recursive:true})) {
  const file=path.join(root,entry);
  if(fs.statSync(file).isFile() && /\.(pdf|mid|png|svg)$/.test(file)) {
    const bytes=fs.readFileSync(file);
    results.hashes.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
}
fs.writeFileSync(`${root}/verification.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify({midi:results.midi.map(({notes,bytes,capo})=>({capo,notes,bytes})),pdf:results.pdf.map(({file,bytes,pages})=>({file,bytes,pages:pages.length,operators:pages.map(p=>p.operators),glyphs:pages.map(p=>p.musicGlyphs)})),negativeControls:results.negativeControls},null,2));

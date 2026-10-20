import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const root='/tmp/opencode/guitar-adapters-review-r2',work='/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-cf255def';
const engine='/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-2e0bc3f7';
const require=createRequire(`${work}/package.json`),{parseMidi}=require('midi-file');
const at=await import(`${work}/node_modules/@coderline/alphatab/dist/alphaTab.mjs`);
const {createAlphaTabScore}=await import(`${work}/src/adapters/index.ts`);
const {createScoreAdapter}=await import(`${work}/src/adapters/server.ts`);
const {verifyRevisionDigest}=await import(`${work}/src/domain/index.ts`);
const {guitarValidator}=await import(`${engine}/src/engine/index.ts`);
const {gapStudy}=await import(`${work}/tests/adapters/gap-fixture.ts`);
const {stamp}=await import(`${work}/tests/adapters/fixture.ts`);
const read=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
const hash=(b:any)=>createHash('sha256').update(b).digest('hex');
const T=(q:any)=>{const x=BigInt(q.n)*960n;assert.equal(x%BigInt(q.d),0n);return Number(x/BigInt(q.d));};
await mkdir(root,{recursive:true});
const generation=await read('/tmp/opencode/guitar-live-exports/generation.json');
const before=await read('/tmp/opencode/guitar-live-exports/generation-before-gap-fix.json');
const source=await read(generation.sourcePath);assert(await verifyRevisionDigest(source));
assert.equal(source.manifest.identity.songId,692866);assert.equal(source.manifest.identity.upstreamRevisionId,847990);
assert.equal(hash(await readFile(generation.sourcePath)),generation.sourceFileSha256);
assert.equal(generation.sourceFileSha256,before.sourceFileSha256);
const form=[1,2,3,4,5,6,7,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,43,44,45,46,43,44,45,46,43,44,45,46];
const results:any[]=[];
for(const capo of [0,2]){
 const score=await read(`/tmp/opencode/engine-live-${capo}.json`),entry=generation.candidates.find((c:any)=>c.variant===String(capo));
 assert(await verifyRevisionDigest(score));assert.equal(hash(await readFile(entry.file)),entry.fileSha256);assert.equal(entry.fileSha256,before.candidates.find((c:any)=>c.variant===String(capo)).fileSha256);
 assert.deepEqual(score.instrument.tuning,[40,45,50,55,59,64]);assert.equal(score.instrument.capo,capo);assert.equal(score.preferences.difficulty,'intermediate');assert.equal(score.preferences.transposition.semitones,0);
 const report=guitarValidator.validate(source,score,{approvedRevisions:[]});assert.equal(report.status,'passed');assert.equal(report.validatorVersion,'independent-guitar-validator-1');
 assert.equal(score.occurrences.length,64);assert.deepEqual(score.occurrences.map((o:any)=>source.bars.find((b:any)=>b.id===o.writtenBarId).number),form);
 score.occurrences.forEach((o:any,i:number)=>{assert.equal(T(o.start),i*3840);assert.equal(T(o.length),3840);});
 // Independent SOURCE melody oracle: selection references source attacks and holds, not score sounds,
 // adapter projections, compiled timelines, or native timing fields. Source events already merge ties.
 const selected=[...new Set(score.selection.sections.flatMap((s:any)=>s.selectors.flatMap((v:any)=>v.eventIds)))].map(id=>{const e=source.events.find((e:any)=>e.id===id);assert(e);return e;}).filter((e:any)=>e.kind==='note');
 const sourceMelody=score.occurrences.flatMap((o:any)=>{const bar=source.bars.find((b:any)=>b.id===o.writtenBarId),start=T(bar.start);return selected.filter((e:any)=>T(e.start)>=start&&T(e.start)<start+3840).map((e:any)=>`melody/${e.soundingMidi}/${T(o.start)+T(e.start)-start}/${T(o.start)+T(e.start)-start+T(e.duration)}`);}).sort();
 assert.equal(sourceMelody.length,245);
 const bytes=await readFile(`/tmp/opencode/guitar-live-exports/capo-${capo}/full-song.mid`),midi=parseMidi(bytes),actual:string[]=[],tempos:any[]=[];let end=0;
 for(const [i,track]of midi.tracks.entries()) {let tick=0;const active=new Map();for(const e of track){tick+=e.deltaTime;if(e.type==='setTempo')tempos.push([tick,e.microsecondsPerBeat]);if(e.type==='noteOn'&&e.velocity>0){assert(!active.has(e.noteNumber));active.set(e.noteNumber,tick);}else if(e.type==='noteOff'||e.type==='noteOn'&&e.velocity===0){assert(active.has(e.noteNumber));actual.push(`${['melody','bass','harmony'][i-1]}/${e.noteNumber}/${active.get(e.noteNumber)}/${tick}`);active.delete(e.noteNumber);end=Math.max(end,tick);}}assert.equal(active.size,0);assert.equal(tick,245760);}
 assert.deepEqual(actual.filter(x=>x.startsWith('melody/')).sort(),sourceMelody,'All exported melody holds equal selected source, independently unfolded');
 const sounds=new Map(score.sounds.map((s:any)=>[s.id,s]));
 assert.deepEqual(actual.sort(),score.performedSounds.map((p:any)=>{const s:any=sounds.get(p.soundId);return `${s.role}/${s.soundingMidi}/${T(p.start)}/${T(p.start)+T(p.duration)}`;}).sort());
 const sourceTempos=score.occurrences.map((o:any)=>{const at=T(source.bars.find((b:any)=>b.id===o.writtenBarId).start);const bpm=source.tempos.filter((t:any)=>T(source.bars.find((b:any)=>b.id===t.barId).start)+T(t.offset)<=at).at(-1).quarterBpm;return [T(o.start),Math.floor(60000000/bpm)];});
 assert.deepEqual(tempos,sourceTempos);const seconds=sourceTempos.reduce((s:number,t:any,i:number)=>s+((sourceTempos[i+1]?.[0]??245760)-t[0])*t[1]/960000000,0);assert(Math.abs(seconds-172.405524)<1e-9);assert.equal(end,244800);
 // Independent native observation: compare each mapped note and rest to canonical notation,
 // plus contiguous exact 3840-tick lane coverage, never use the adapter's private expected-native arrays.
 const finish=at.model.Score.prototype.finish;let native:any;at.model.Score.prototype.finish=function(s:any){finish.call(this,s);native=this;};let notation:any;
 try{notation=createAlphaTabScore(score);}finally{at.model.Score.prototype.finish=finish;}
 const beats=new Map(),notes=new Map();let beatCount=0;
 for(const [i,b]of native.tracks[0].staves[0].bars.entries()) for(const v of b.voices){let position=0;for(const beat of v.beats){assert.equal(beat.playbackStart,position);position+=beat.playbackDuration;assert(beat.playbackDuration>0);assert(beat.dots<=2);beats.set(String(beat.id),{beat,at:i*3840+beat.playbackStart});for(const n of beat.notes)notes.set(String(n.id),n);beatCount++;}assert.equal(position,3840);}
 const expected=score.occurrences.flatMap((o:any)=>score.notation.filter((n:any)=>n.barId===o.writtenBarId).map((n:any)=>`${o.id}/${n.id}`)).sort();assert.deepEqual(notation.projection.mapping.map((m:any)=>`${m.occurrenceId}/${m.segmentId}`).sort(),expected);
 for(const map of notation.projection.mapping){const n=score.notation.find((n:any)=>n.id===map.segmentId),o=score.occurrences.find((o:any)=>o.id===map.occurrenceId),bar=score.bars.find((b:any)=>b.id===o.writtenBarId),b:any=beats.get(map.nativeBeatId);assert.equal(b.at,T(o.start)+T(n.start)-T(bar.start));assert.equal(b.beat.playbackDuration,T(n.duration));if(n.kind==='note'){const note:any=notes.get(map.nativeNoteId),sound:any=sounds.get(n.eventId),performed=score.performedSounds.find((p:any)=>p.soundId===sound.id&&p.occurrenceIds.includes(o.id)),placement=score.placements.find((p:any)=>p.id===performed.placementId);assert.equal(note.realValue,sound.soundingMidi);assert.equal(note.displayValue,sound.soundingMidi+12);assert.equal(note.string-1,placement.stringIndex);assert.equal(note.fret,placement.fret);}else assert.equal(map.nativeNoteId,null);}
 assert.equal(native.masterBars.at(-1).start,241920);assert(!native.masterBars.some((b:any)=>b.isRepeatStart||b.isRepeatEnd));
 let calls=0;const adapter=createScoreAdapter({validator:{validate(...args:any[]){calls++;return guitarValidator.validate(...args);}},getValidationContext:()=>({approvedRevisions:[]})});
 const fresh=await adapter.exportArtifact(source,{status:'validatedDraft',score,validation:{status:'passed',forged:true}} as any,'midi');assert.equal(calls,1);assert.equal(fresh.manifest.review,'unreviewed-draft');assert.equal(fresh.manifest.validationVersion,'independent-guitar-validator-1');assert.deepEqual(Buffer.from(fresh.bytes),bytes);
 const bad=structuredClone(score);bad.performedSounds=bad.performedSounds.filter((p:any)=>p.id!==score.performedSounds.find((p:any)=>sounds.get(p.soundId).role==='melody').id);await stamp(bad);await assert.rejects(adapter.exportArtifact(source,{status:'validatedDraft',score:bad,validation:report} as any,'midi'),{code:'validation-failed'});assert.equal(calls,2);
 results.push({capo,sourceMelodyAttacks:sourceMelody.length,exportedAttacks:actual.length,sourceMelodyEqualsActualMidi:true,sourceTempoEqualsMidi:true,performanceEndTicks:245760,performanceSeconds:seconds,actualLastOff:244800,nativeBeats:beatCount,allNativeMappings:expected.length,nativeExactCoverage:true,freshMidiIdentical:true,realValidatorRejectsMissingMelody:true,sourceAndCandidateFilesUnchangedSinceFailedGapRun:true,diagnostics:report.diagnostics});
}
// Reproduce actual OLD adapter behavior without moving HEAD or writing any worktree.
await mkdir(`${root}/pre-gap`,{recursive:true});
execFileSync('tar',['-x','-C',`${root}/pre-gap`],{input:execFileSync('git',['archive','6f1f455e11c30a90ab983626b631e261c39c0745','src'],{cwd:work})});
try{await symlink(`${work}/node_modules`,`${root}/pre-gap/node_modules`);}catch(e:any){if(e.code!=='EEXIST')throw e;}
const old=await import(`${root}/pre-gap/src/adapters/alpha-tab.ts`),fixture=await gapStudy();assert.equal(guitarValidator.validate(fixture.source,fixture.score,{approvedRevisions:[]}).status,'passed');
let oldNative:any;const finish=at.model.Score.prototype.finish;at.model.Score.prototype.finish=function(s:any){finish.call(this,s);oldNative=this;};let oldError='';try{old.createAlphaTabScore(fixture.score);}catch(e:any){oldError=e.message;}finally{at.model.Score.prototype.finish=finish;}
assert.match(oldError,/cannot represent exact timing/);const oldBass=oldNative.tracks[0].staves[0].bars[0].voices[1].beats.map((b:any)=>({start:b.playbackStart,duration:b.playbackDuration,rest:b.isRest,dots:b.dots}));assert.deepEqual(oldBass,[{start:0,duration:1440,rest:false,dots:1},{start:1440,duration:1280,rest:true,dots:3}]);
const summary={status:'passed',reviewedCommits:['043b1fc216cd46c9bf3998b022150783df0b89a4','6f1f455e11c30a90ab983626b631e261c39c0745','ee367928997e7df1011f018b13d14dd3ddf21c3d'],validatorSha256:hash(await readFile(`${engine}/src/engine/validator.ts`)),results,originalOldAdapter:{commit:'6f1f455e11c30a90ab983626b631e261c39c0745',oldError,oldBass}};
await writeFile(`${root}/independent.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));

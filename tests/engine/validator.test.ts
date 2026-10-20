import { expect, test } from 'bun:test';
import { contentDigest, q, revisionDigest } from '../../src/domain';
import type { ScoreV1 } from '../../src/domain';
import { digest, documentDigest } from '../../src/engine/identity';
import { scopeDigest } from '../../src/engine/scopes';
import { guitarValidator } from '../../src/engine/validator';
import { score, source } from '../fixtures/original';
import { guitarEngine } from '../../src/engine';
import { literalPlanner, oneBarStudy } from './studies';

export function stamped(s: ScoreV1): ScoreV1 { s.revision.digest=documentDigest(s);return s; }
const codes=(s: ScoreV1)=>guitarValidator.validate(source,stamped(s),{approvedRevisions:[]}).diagnostics.filter((d)=>d.severity==='error').map((d)=>d.code);

test('portable synchronous digest agrees with contract WebCrypto for unicode and multi-block documents',async()=>{
  expect(digest({study:'♪',payload:'x'.repeat(200)})).toBe(await contentDigest({study:'♪',payload:'x'.repeat(200)}));
  expect(documentDigest(source)).toBe(await revisionDigest(source));
  expect(documentDigest(score)).toBe(score.revision.digest);
});

test('independent original full melody/tuplets/tie/rest passes with movement warning, not a human claim',()=>{
  const report=guitarValidator.validate(source,score,{approvedRevisions:[]});
  expect(report.status).toBe('passed');
  expect(report.diagnostics.map((d)=>d.code)).toEqual(['transition-unverified']);
});

test('production validator rejects independently mutated final/middle/extra/retuned melody and incomplete selection',()=>{
  for (const id of ['m2','m4']) {const s=structuredClone(score);s.sounds=s.sounds.filter((e)=>e.id!==id);expect(codes(s)).toContain('melody-mismatch');}
  const pitch=structuredClone(score);pitch.sounds[0]!.soundingMidi+=12;expect(codes(pitch)).toContain('melody-mismatch');
  const duration=structuredClone(score);duration.sounds[4]!.duration=q(1);expect(codes(duration)).toContain('melody-mismatch');
  const selection=structuredClone(score);selection.selection.sections[0]!.selectors[0]!.eventIds.pop();expect(codes(selection)).toContain('selection-needed');
  const sourceId=structuredClone(score);sourceId.source.revision.id='wrong';expect(codes(sourceId)).toContain('source-mismatch');
});

test('production validator rejects missing triplet notation, retriggered tie and missing entry tempo',()=>{
  const triplet=structuredClone(score);triplet.notation=triplet.notation.filter((n)=>n.id!=='n2');expect(codes(triplet)).toContain('melody-mismatch');
  const retrigger=structuredClone(score);retrigger.performedSounds.push({...retrigger.performedSounds[4]!,id:'m4@o2',start:q(4),duration:q(1),attackOccurrenceId:'o2'});expect(codes(retrigger)).toContain('form-mismatch');
  const tempo=structuredClone(score);tempo.performedTempos.pop();expect(codes(tempo)).toContain('tempo-mismatch');
});

test('production validator distinguishes held finger collision, held string collision and exact release reuse',()=>{
  expect(codes(structuredClone(score))).toEqual([]); // m1 attacks exactly when m0 releases on the same string.
  const finger=structuredClone(score);finger.placements.find((p)=>p.id==='pb1')!.finger=1;expect(codes(finger)).toContain('finger-collision');
  const string=structuredClone(score);const p=string.placements.find((p)=>p.id==='ph0')!;p.stringIndex=5;p.fret=0;expect(codes(string)).toContain('string-collision');
  const contact=structuredClone(score);contact.contacts[0]!.release=q(1,2);expect(codes(contact)).toContain('finger-collision');
  const states=structuredClone(score);states.handStates.splice(2,1);expect(codes(states)).toContain('finger-collision');
});

test('capo physical-pitch mismatch, finger0 stopped and specified impossible movement fail',()=>{
  const capo=structuredClone(score);capo.instrument.capo=2;capo.capoComparison.selected=2;capo.preferences.capo={mode:'chosen',value:2};expect(codes(capo)).toContain('pitch-placement');
  const stopped=structuredClone(score);stopped.placements[1]!.finger=0;expect(codes(stopped)).toContain('invalid-input');
  const movement=structuredClone(score);movement.ability.transition={status:'specified',maxPhysicalFretsPerSecond:0.01,minFingerReassignmentMs:10000,evidence:'Deliberately restrictive test limits'};expect(codes(movement)).toContain('profile-limit');
});

test('approvals require real context revision and whole scoped snapshots; copied digest is insufficient',()=>{
  const approved=structuredClone(score);const hash=scopeDigest(approved,'melody');const s=structuredClone(score);const ref={id:approved.revision.id,digest:approved.revision.digest};
  s.approvals={stage:'melodyApproved',melody:{id:'approval',approvedFrom:ref,scopeDigest:hash,reviewer:'Original fixture test',approvedAt:'2026-10-20T00:00:00Z'}};
  s.locks=[{role:'melody',approvedFrom:ref,scopeDigest:hash,sounds:structuredClone(approved.sounds.filter((s)=>s.role==='melody')),rests:approved.rests}];
  expect(codes(s)).toContain('approval-stale');
  expect(guitarValidator.validate(source,stamped(s),{approvedRevisions:[approved]}).status).toBe('passed');
  s.locks[0]!.sounds[0]!.duration=q(2);
  expect(guitarValidator.validate(source,stamped(s),{approvedRevisions:[approved]}).diagnostics.map((d)=>d.code)).toContain('approval-stale');
});

test('five stopped contacts with no barre fail production sweep, independently of fret span',()=>{
  const fixture=oneBarStudy([['mel',0,0,4,64],['a',2,0,1,41],['b',2,0,1,47],['c',2,0,1,53],['d',2,0,1,59],['e',2,0,1,60]]);
  fixture.request.ability.maxSoundingNotes=6;
  const result=guitarEngine.arrange(fixture.source,fixture.request,{version:'no-accompaniment',candidates:[]},literalPlanner);
  if(result.status!=='candidate') throw new Error(JSON.stringify(result));
  const s=result.score;
  for(const [index,e] of fixture.source.events.filter((e)=>e.partId===2).entries()) {
    if(e.kind!=='note') continue;
    const id=`extra${index}`,pl=`extra-pl${index}`,ps=`${id}@o1`,contact=`extra-contact${index}`;
    s.sounds.push({id,role:'harmony',voiceId:id,start:e.start,duration:e.duration,soundingMidi:e.soundingMidi,spelling:e.spelling,provenance:{kind:'source',eventIds:[e.id]}});
    s.notation.push({id:`extra-n${index}`,eventId:id,kind:'note',barId:'b1',voiceId:id,start:q(0),duration:q(1),baseDenominator:4,dots:0,tuplet:null,tie:'none'});
    s.placements.push({id:pl,soundId:id,stringIndex:index,fret:[1,2,3,4,1][index]!,finger:[1,2,3,4,1][index]!});
    s.performedSounds.push({id:ps,soundId:id,attackOccurrenceId:'o1',occurrenceIds:['o1'],start:q(0),duration:q(1),placementId:pl});
    s.contacts.push({id:contact,performedSoundId:ps,soundId:id,placementId:pl,start:q(0),release:q(1)});
  }
  const originalContact=s.contacts[0]!.id;
  s.handStates=[{at:q(0),activeContactIds:s.contacts.map((c)=>c.id),position:{kind:'fretting',anchorPhysicalFret:1}},{at:q(1),activeContactIds:[originalContact],position:{kind:'released'}},{at:q(4),activeContactIds:[],position:{kind:'released'}}];
  const report=guitarValidator.validate(fixture.source,stamped(s),{approvedRevisions:[]});
  expect(report.status).toBe('failed');
  expect([...new Set(report.diagnostics.filter((d)=>d.severity==='error').map((d)=>d.code))].sort()).toEqual(['finger-collision','profile-limit']);
});

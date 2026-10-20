import { expect, test } from 'bun:test';
import { compare, eventEnd, overlaps, q } from '../../src/domain';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { crossedRegisterScore, heldRegisterStudy, isolatedRegisterStudy } from './register-studies';
import { literalPlanner, oneBarStudy } from './studies';
import { documentDigest } from '../../src/engine/identity';
import { scopeDigest } from '../../src/engine/scopes';

test('independent role gate rejects statically valid held bass ABOVE later inner harmony',()=>{
  const {source,score}=crossedRegisterScore();
  const report=guitarValidator.validate(source,score,{approvedRevisions:[]});
  expect(report.status).toBe('failed');
  expect(report.diagnostics.some((d)=>d.message.includes('role-order-v1'))).toBe(true);
});

test('role gate also rejects bass attacking under already held harmony, but releases before equal-time attacks',()=>{
  const held=crossedRegisterScore('harmony-first');
  const report=guitarValidator.validate(held.source,held.score,{approvedRevisions:[]});
  expect(report.status).toBe('failed');
  expect(report.diagnostics.filter((d)=>d.severity==='error').map((d)=>d.code)).toEqual(['unsatisfied']);
  const boundary=crossedRegisterScore('boundary');
  expect(guitarValidator.validate(boundary.source,boundary.score,{approvedRevisions:[]}).status).toBe('passed');
});

test('crossing approved snapshots do not authorize silent inversions or lock edits',()=>{
  const {source,score}=crossedRegisterScore();
  const request=heldRegisterStudy().request;
  request.locks=(['bass','harmony'] as const).map((role)=>({role,approvedFrom:{id:score.revision.id,digest:score.revision.digest},scopeDigest:scopeDigest(score,role),sounds:score.sounds.filter((s)=>s.role===role),rests:[]}));
  const before=JSON.stringify(request.locks);
  const result=guitarEngine.arrange(source,request,score.plan,score.planner);
  expect(result.status).toBe('reapproval-needed');
  expect(result.diagnostics.some((d)=>d.message.includes('role-order-v1'))).toBe(true);
  expect(JSON.stringify(request.locks)).toBe(before);
  const candidate=structuredClone(score);candidate.locks=request.locks;candidate.revision.id='crossing-lock-candidate';candidate.revision.digest=documentDigest(candidate);
  const report=guitarValidator.validate(source,candidate,{approvedRevisions:[score]});
  expect(report.status).toBe('failed');
  expect(report.diagnostics.filter((d)=>d.severity==='error').map((d)=>d.code)).toEqual(['unsatisfied']);
});

test('held-role sequence retains lower source bass and inner harmony through both lead notes',()=>{
  const {source,request,plan}=heldRegisterStudy();
  const result=guitarEngine.arrange(source,request,plan,literalPlanner);
  if(result.status!=='candidate') throw new Error(JSON.stringify(result));
  const bass=result.score.sounds.find((s)=>s.role==='bass')!,inner=result.score.sounds.find((s)=>s.role==='harmony')!;
  expect(bass.soundingMidi).toBe(47);
  expect(inner.soundingMidi).toBe(57);
  expect(overlaps(bass.start,eventEnd(bass),inner.start,eventEnd(inner))).toBe(true);
  expect(guitarValidator.validate(source,result.score,{approvedRevisions:[]}).status).toBe('passed');
});

test('isolated bass in a melody gap does not turn a source +7 step into a gratuitous +19 leap',()=>{
  const {source,request,plan}=isolatedRegisterStudy();
  const result=guitarEngine.arrange(source,request,plan,literalPlanner);
  if(result.status!=='candidate') throw new Error(JSON.stringify(result));
  expect(result.score.sounds.filter((s)=>s.role==='bass').map((s)=>s.soundingMidi)).toEqual([40,47]);
  expect(result.score.rests).toHaveLength(1);
});

test('source-plan bass octave target participates as a preference, without forcing it above protected melody',()=>{
  const {source,request,plan}=oneBarStudy([['lead',0,0,4,64],['root',1,1,1,35]]);
  for(const [shift,expected] of [[0,47],[2,59],[3,59]] as const) {
    plan.candidates[0]!.octaveShift=shift;
    const result=guitarEngine.arrange(source,request,plan,literalPlanner);
    if(result.status!=='candidate') throw new Error(JSON.stringify(result));
    expect(result.score.sounds.find((s)=>s.role==='bass')!.soundingMidi).toBe(expected);
    expect(guitarValidator.validate(source,result.score,{approvedRevisions:[]}).status).toBe('passed');
  }
});

test('necessary guitar-register folding at capo 2 stays available rather than forcing unavailable low E',()=>{
  const {source,request,plan}=oneBarStudy([['lead',0,0,4,66],['root',1,0,4,28],['inner',2,0,2,59]]);
  request.preferences.capo={mode:'chosen',value:2};
  const result=guitarEngine.arrange(source,request,plan,literalPlanner);
  if(result.status!=='candidate') throw new Error(JSON.stringify(result));
  expect(result.score.sounds.find((s)=>s.role==='bass')!.soundingMidi).toBe(52);
  expect(result.score.sounds.find((s)=>s.role==='harmony')!.soundingMidi).toBe(59);
  expect(result.score.changes.some((c)=>c.role==='bass'&&c.kind==='bass-register'&&c.before.soundingMidi===28&&c.after?.soundingMidi===52)).toBe(true);
  expect(guitarValidator.validate(source,result.score,{approvedRevisions:[]}).status).toBe('passed');
});

test('reduce unapproved held harmony, not source bass foundation, when their role registers cannot coexist',()=>{
  const {source,request,plan}=oneBarStudy([['lead-a',0,0,2,66],['lead-b',0,2,2,68],['root',1,1,2,35],['low-inner',2,0,4,45]]);
  const result=guitarEngine.arrange(source,request,plan,literalPlanner);
  if(result.status!=='candidate') throw new Error(JSON.stringify(result));
  expect(result.score.sounds.filter((s)=>s.role==='bass').map((s)=>s.soundingMidi)).toEqual([47]);
  const bass=result.score.sounds.find((s)=>s.role==='bass')!;
  expect(result.score.sounds.filter((s)=>s.role==='harmony').every((s)=>compare(eventEnd(s),bass.start)<=0)).toBe(true);
  expect(result.score.changes.some((c)=>(c.kind==='omission'||c.kind==='shortened-sustain')&&c.role==='harmony'&&c.sourceEventIds.includes('low-inner'))).toBe(true);
});

test('independent role gate rejects inner harmony at or above lead even with valid separate-string fingering',()=>{
  for(const pitch of [64,69]) {
    const {source,request,plan}=oneBarStudy([['lead',0,0,4,64],['inner',2,0,2,pitch]]);
    const result=guitarEngine.arrange(source,request,{version:'melody-only',candidates:[]},literalPlanner);
    if(result.status!=='candidate') throw new Error(JSON.stringify(result));
    const score=result.score,e=source.events.find((e)=>e.id==='inner')!;
    if(e.kind!=='note') throw new Error('Original inner note missing');
    score.plan=plan;
    score.sounds.push({id:'inner',role:'harmony',voiceId:'harmony',start:q(0),duration:q(2),soundingMidi:pitch,spelling:e.spelling,provenance:{kind:'source',eventIds:['inner']}});
    score.notation.push({id:'n-inner',eventId:'inner',kind:'note',barId:'b1',voiceId:'harmony',start:q(0),duration:q(2),baseDenominator:2,dots:0,tuplet:null,tie:'none'});
    score.placements.push({id:'pl-inner',soundId:'inner',stringIndex:4,fret:pitch-59,finger:1});
    score.performedSounds.push({id:'inner@o1',soundId:'inner',attackOccurrenceId:'o1',occurrenceIds:['o1'],start:q(0),duration:q(2),placementId:'pl-inner'});
    score.contacts.push({id:'c-inner',performedSoundId:'inner@o1',soundId:'inner',placementId:'pl-inner',start:q(0),release:q(2)});
    const melodyContact=score.contacts[0]!.id;
    score.handStates=[{at:q(0),activeContactIds:[melodyContact,'c-inner'],position:{kind:'fretting',anchorPhysicalFret:pitch-59}},{at:q(2),activeContactIds:[melodyContact],position:{kind:'released'}},{at:q(4),activeContactIds:[],position:{kind:'released'}}];
    score.revision.digest=documentDigest(score);
    const report=guitarValidator.validate(source,score,{approvedRevisions:[]});
    expect(report.status).toBe('failed');
    expect(report.diagnostics.filter((d)=>d.severity==='error').map((d)=>d.code)).toEqual(['unsatisfied']);
  }
});

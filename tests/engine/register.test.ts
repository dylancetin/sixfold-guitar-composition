import { expect, test } from 'bun:test';
import { eventEnd, overlaps } from '../../src/domain';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { crossedRegisterScore, heldRegisterStudy, isolatedRegisterStudy } from './register-studies';
import { literalPlanner } from './studies';
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
  const candidate=structuredClone(score);candidate.locks=request.locks;candidate.revision.digest=documentDigest(candidate);
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

import { expect, test } from 'bun:test';
import { eventEnd, overlaps } from '../../src/domain';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { crossedRegisterScore, heldRegisterStudy, isolatedRegisterStudy } from './register-studies';
import { literalPlanner } from './studies';

test('independent role gate rejects statically valid held bass ABOVE later inner harmony',()=>{
  const {source,score}=crossedRegisterScore();
  const report=guitarValidator.validate(source,score,{approvedRevisions:[]});
  expect(report.status).toBe('failed');
  expect(report.diagnostics.some((d)=>d.message.includes('role-order-v1'))).toBe(true);
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

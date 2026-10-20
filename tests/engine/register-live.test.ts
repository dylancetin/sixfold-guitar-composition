import { expect, test } from 'bun:test';
import { ArrangementRequestSchema, compare, eventEnd, overlaps, PlanSchema, PlannerProvenanceSchema, SourceScoreV1Schema } from '../../src/domain';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { digest } from '../../src/engine/identity';

const run=process.env.ENGINE_M1_RUN,planPath=process.env.ENGINE_M1_PLAN;

test.skipIf(!run||!planPath)('optional full unchanged authored Plan: M1 role/contour fix without losing a single candidate or changing source melody',async()=>{
  const source=SourceScoreV1Schema.parse(await Bun.file(`${run}/source.json`).json());
  const prepared=ArrangementRequestSchema.parse(await Bun.file(`${run}/request.json`).json());
  const bytes=new Uint8Array(await Bun.file(planPath!).arrayBuffer());
  const plan=PlanSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  const baseline=await Bun.file(new URL('../../docs/evidence/engine-m1-baseline.json',import.meta.url)).json();
  expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(baseline.planRawSha256);
  const planner=PlannerProvenanceSchema.parse(baseline.reusedOriginalPlannerProvenance);
  for(const [index,capo] of [0,2,'compare'].entries()) {
    const request=structuredClone(prepared);
    request.preferences.capo=capo==='compare'?{mode:'recommend',compare:[0,2]}:{mode:'chosen',value:capo as number};
    const result=guitarEngine.arrange(source,request,plan,planner);
    if(result.status!=='candidate') throw new Error(JSON.stringify(result));
    const score=result.score,old=baseline.results[index];
    expect(guitarValidator.validate(source,score,{approvedRevisions:[]}).status).toBe('passed');
    expect(score.plan).toEqual(plan);
    expect(score.sounds.filter((s)=>s.role==='bass')).toHaveLength(92);
    expect(score.sounds.filter((s)=>s.role==='harmony')).toHaveLength(67);
    expect(score.changes.filter((c)=>c.kind==='omission')).toHaveLength(0);
    const ids=(s:typeof score.sounds[number])=>s.provenance.kind==='source'?s.provenance.eventIds:s.provenance.evidenceEventIds;
    const byId=new Map(score.sounds.map((s)=>[s.id,s]));
    const timeline=score.performedSounds.filter((p)=>byId.get(p.soundId)!.role==='melody').map((p)=>({sourceIds:ids(byId.get(p.soundId)!),pitch:byId.get(p.soundId)!.soundingMidi,start:p.start,duration:p.duration}));
    expect(digest(timeline)).toBe(old.melodyTimelineDigest);
    expect(digest(score.rests)).toBe(old.restsDigest);
    expect(digest({bars:score.bars,form:score.form,occurrences:score.occurrences,performedTempos:score.performedTempos})).toBe(old.formDigest);
    for(const h of score.sounds.filter((s)=>s.role==='harmony')) for(const b of score.sounds.filter((s)=>s.role==='bass')) if(overlaps(b.start,eventEnd(b),h.start,eventEnd(h))) expect(b.soundingMidi).toBeLessThan(h.soundingMidi);
    const bass=score.sounds.filter((s)=>s.role==='bass').sort((a,b)=>compare(a.start,b.start));
    // All octave-sized gratuitous leaps disappear, not just the named bar-8 case.
    for(let i=1;i<bass.length;i++) expect(Math.abs(bass[i]!.soundingMidi-bass[i-1]!.soundingMidi)).toBeLessThan(12);
    expect(score.sounds.some((s)=>s.role==='harmony'&&ids(s).includes('p7:b35:v0:bt4:n0'))).toBe(true);
    expect(score.ability.transition.status).toBe('uncalibrated');
  }
},30000);

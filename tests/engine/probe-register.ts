// Local musical-regression experiment. Never writes author inputs or root.
import { add, ArrangementRequestSchema, compare, eventEnd, overlaps, PlanSchema, PlannerProvenanceSchema, q, SourceScoreV1Schema, subtract } from '../../src/domain';
import type { ScoreV1, SourceScoreV1 } from '../../src/domain';
import { guitarEngine, guitarValidator, secondsBetween } from '../../src/engine';
import { digest } from '../../src/engine/identity';
import { crossedRegisterScore, heldRegisterStudy, isolatedRegisterStudy } from './register-studies';
import { literalPlanner } from './studies';

const args=process.argv.slice(2);
const arg=(name:string)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const run=arg('--run');
const planPath=arg('--plan');
const output=arg('--output');
if(!run||!planPath||!output) throw new Error('Required: --run <canonical source/request directory> --plan <unchanged authored plan> --output <own metadata JSON> [--scores <local prefix>]');
const sha=(bytes:Uint8Array)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const sourceBytes=new Uint8Array(await Bun.file(`${run}/source.json`).arrayBuffer()),requestBytes=new Uint8Array(await Bun.file(`${run}/request.json`).arrayBuffer()),planBytes=new Uint8Array(await Bun.file(planPath).arrayBuffer());
const source=SourceScoreV1Schema.parse(JSON.parse(new TextDecoder().decode(sourceBytes)));
const prepared=ArrangementRequestSchema.parse(JSON.parse(new TextDecoder().decode(requestBytes)));
const plan=PlanSchema.parse(JSON.parse(new TextDecoder().decode(planBytes)));
// Reuse the original recorded call provenance; this experiment is NOT a new call.
const prior=await Bun.file('/tmp/opencode/guitar-musician/plan-capocompare-result.json').json();
const planner=PlannerProvenanceSchema.parse(prior.score.planner);
if(planner.mode!=='configured-llm'||planner.responseDigest!==sha(planBytes)) throw new Error('Authored Plan no longer matches its recorded response digest');

function metrics(source:SourceScoreV1,score:ScoreV1) {
  const ids=(s:ScoreV1['sounds'][number])=>s.provenance.kind==='source'?s.provenance.eventIds:s.provenance.evidenceEventIds;
  const sounds=new Map(score.sounds.map((s)=>[s.id,s]));
  const sourceEvents=new Map(source.events.map((s)=>[s.id,s]));
  const bass=score.sounds.filter((s)=>s.role==='bass').sort((a,b)=>compare(a.start,b.start));
  const harmony=score.sounds.filter((s)=>s.role==='harmony');
  const crossings=bass.flatMap((b)=>harmony.flatMap((h)=>{
    if(b.soundingMidi<h.soundingMidi||!overlaps(b.start,eventEnd(b),h.start,eventEnd(h))) return [];
    const start=compare(b.start,h.start)>0?b.start:h.start,end=compare(eventEnd(b),eventEnd(h))<0?eventEnd(b):eventEnd(h);
    return [{bar:source.bars.find((bar)=>compare(start,bar.start)>=0&&compare(start,add(bar.start,bar.length))<0)?.number,bassSource:ids(b),harmonySource:ids(h),bassPitch:b.soundingMidi,harmonyPitch:h.soundingMidi,start,duration:subtract(end,start)}];
  }));
  let performedCrossings=0,crossedQuarters=q(0);
  for(const b of score.performedSounds.filter((p)=>sounds.get(p.soundId)!.role==='bass')) for(const h of score.performedSounds.filter((p)=>sounds.get(p.soundId)!.role==='harmony')) {
    if(sounds.get(b.soundId)!.soundingMidi<sounds.get(h.soundId)!.soundingMidi||!overlaps(b.start,eventEnd(b),h.start,eventEnd(h))) continue;
    performedCrossings++;
    const start=compare(b.start,h.start)>0?b.start:h.start,end=compare(eventEnd(b),eventEnd(h))<0?eventEnd(b):eventEnd(h);
    crossedQuarters=add(crossedQuarters,subtract(end,start));
  }
  const leaps=bass.slice(1).flatMap((b,i)=>{
    const a=bass[i]!,sa=sourceEvents.get(ids(a)[0]!)!,sb=sourceEvents.get(ids(b)[0]!)!;
    if(sa.kind!=='note'||sb.kind!=='note') return [];
    const delta=b.soundingMidi-a.soundingMidi,sourceDelta=sb.soundingMidi-sa.soundingMidi;
    return [{sourceA:sa.id,sourceB:sb.id,from:a.soundingMidi,to:b.soundingMidi,delta,sourceDelta,sameSourceLine:sa.partId===sb.partId&&sa.voiceId===sb.voiceId,addedContourSemitones:Math.abs(delta-sourceDelta)}];
  });
  const selectedIds=new Set(score.selection.sections.flatMap((s)=>s.selectors.flatMap((s)=>s.eventIds)));
  const sourceMelody=source.events.filter((e)=>e.kind==='note'&&selectedIds.has(e.id));
  const melody=score.sounds.filter((s)=>s.role==='melody');
  const exactMelody=sourceMelody.length===melody.length&&sourceMelody.every((e)=>e.kind==='note'&&melody.some((s)=>ids(s).length===1&&ids(s)[0]===e.id&&s.soundingMidi===e.soundingMidi+score.preferences.transposition.semitones&&compare(s.start,e.start)===0&&compare(s.duration,e.duration)===0));
  const timeline=score.performedSounds.filter((p)=>sounds.get(p.soundId)!.role==='melody').map((p)=>({sourceIds:ids(sounds.get(p.soundId)!),pitch:sounds.get(p.soundId)!.soundingMidi,start:p.start,duration:p.duration}));
  const sweep=score.handStates.map((state)=>state.activeContactIds.map((id)=>score.contacts.find((c)=>c.id===id)!).map((c)=>score.placements.find((p)=>p.id===c.placementId)!));
  const isolatedHigh=bass.filter((b)=>!score.sounds.some((s)=>s.id!==b.id&&overlaps(s.start,eventEnd(s),b.start,eventEnd(b)))&&score.instrument.tuning.some((t)=>b.soundingMidi-12>=t+score.instrument.capo&&b.soundingMidi-12<=t+Math.min(score.instrument.maxPhysicalFret,score.ability.maxPhysicalFret)));
  const counts=(role:'melody'|'bass'|'harmony')=>({written:score.sounds.filter((s)=>s.role===role).length,performed:score.performedSounds.filter((p)=>sounds.get(p.soundId)!.role===role).length});
  const anchorSteps=score.handStates.slice(1).flatMap((st,i)=>{
    const before=score.handStates[i]!;
    if(st.position.kind!=='fretting'||before.position.kind!=='fretting') return [];
    const step=Math.abs(st.position.anchorPhysicalFret-before.position.anchorPhysicalFret),seconds=secondsBetween(before.at,st.at,score.performedTempos);
    return [{step,rate:seconds>0?step/seconds:0}];
  });
  return {selectedCapo:score.instrument.capo,melody:counts('melody'),bass:counts('bass'),harmony:counts('harmony'),exactSelectedMelody:exactMelody,melodyTimelineDigest:digest(timeline),restsDigest:digest(score.rests),formDigest:digest({bars:score.bars,form:score.form,occurrences:score.occurrences,performedTempos:score.performedTempos}),occurrences:score.occurrences.length,planUnchanged:digest(score.plan)===digest(plan),crossedWrittenIntervals:crossings.length,crossedPerformedIntervals:performedCrossings,crossedPerformedQuarters:crossedQuarters,crossings,largeBassLeaps:leaps.filter((l)=>Math.abs(l.delta)>=12),inflatedSameLineLeaps:leaps.filter((l)=>l.sameSourceLine&&Math.abs(l.delta)>Math.abs(l.sourceDelta)&&Math.abs(l.delta)>=12),totalSameLineContourDistortionSemitones:leaps.filter((l)=>l.sameSourceLine).reduce((sum,l)=>sum+l.addedContourSemitones,0),isolatedHighBass:isolatedHigh.map((s)=>({source:ids(s),pitch:s.soundingMidi})),bassRange:[Math.min(...bass.map((s)=>s.soundingMidi)),Math.max(...bass.map((s)=>s.soundingMidi))],maxPhysicalFret:Math.max(...score.placements.map((p)=>p.fret+score.instrument.capo)),maxStoppedSpan:Math.max(...sweep.map((ps)=>{const f=ps.filter((p)=>p.fret>0).map((p)=>p.fret);return f.length?Math.max(...f)-Math.min(...f):0;})),maxSounding:Math.max(...sweep.map((ps)=>ps.length)),maxStopped:Math.max(...sweep.map((ps)=>ps.filter((p)=>p.fret>0).length)),maxObservedAnchorStep:Math.max(...anchorSteps.map((s)=>s.step),0),maxObservedAnchorFretsPerSecond:Math.max(...anchorSteps.map((s)=>s.rate),0),movementStatus:score.ability.transition.status,movementProxyNotHumanCalibration:true,omissions:score.changes.filter((c)=>c.kind==='omission').map((c)=>({role:c.role,sourceIds:c.sourceEventIds})),shortened:score.changes.filter((c)=>c.kind==='shortened-sustain').map((c)=>({role:c.role,sourceIds:c.sourceEventIds,before:c.before,after:c.after})),registerChangeCount:score.changes.filter((c)=>c.kind==='bass-register').length,m2CandidatePresent:score.plan.candidates.some((c)=>c.id==='harmony-bar35-p7-bt4-n0'),m2CandidateRetained:score.sounds.some((s)=>s.role==='harmony'&&ids(s).includes('p7:b35:v0:bt4:n0')),comparison:score.capoComparison};
}

const results=[];
for(const capo of [0,2,'compare'] as const) {
  const request=structuredClone(prepared);
  request.preferences.capo=capo==='compare'?{mode:'recommend',compare:[0,2]}:{mode:'chosen',value:capo};
  const started=performance.now();
  const result=guitarEngine.arrange(source,request,plan,planner);
  const elapsedMs=performance.now()-started;
  const entry=result.status==='candidate'?{capo,status:result.status,elapsedMs,...metrics(source,result.score),validation:guitarValidator.validate(source,result.score,{approvedRevisions:[]}),diagnostics:result.diagnostics}:{capo,status:result.status,elapsedMs,diagnostics:result.diagnostics};
  results.push(entry);
  if(result.status==='candidate'&&arg('--scores')) await Bun.write(`${arg('--scores')}-${capo}.json`,JSON.stringify(result.score));
}
const original=[];
for(const [name,fixture] of [['held-crossing',heldRegisterStudy()],['isolated-high',isolatedRegisterStudy()]] as const) {
  const result=guitarEngine.arrange(fixture.source,fixture.request,fixture.plan,literalPlanner);
  original.push(result.status==='candidate'?{name,status:result.status,pitches:result.score.sounds.map((s)=>({role:s.role,pitch:s.soundingMidi,start:s.start,duration:s.duration})),validation:guitarValidator.validate(fixture.source,result.score,{approvedRevisions:[]}).status}:{name,status:result.status,diagnostics:result.diagnostics});
}
const crossed=crossedRegisterScore();
const afterPlan=new Uint8Array(await Bun.file(planPath).arrayBuffer()),afterSource=new Uint8Array(await Bun.file(`${run}/source.json`).arrayBuffer()),afterRequest=new Uint8Array(await Bun.file(`${run}/request.json`).arrayBuffer());
const unchanged=sha(planBytes)===sha(afterPlan)&&sha(sourceBytes)===sha(afterSource)&&sha(requestBytes)===sha(afterRequest);
await Bun.write(output,JSON.stringify({scope:'M1 source-oriented register correction; metadata only; no listening or calibrated human-playability claim',planRawSha256:sha(planBytes),planDigest:digest(plan),sourceRawSha256:sha(sourceBytes),requestRawSha256:sha(requestBytes),inputsUnchanged:unchanged,reusedOriginalPlannerProvenance:planner,original,crossedLiteralValidation:guitarValidator.validate(crossed.source,crossed.score,{approvedRevisions:[]}),results},null,2)+'\n');
console.log(JSON.stringify({output,inputsUnchanged:unchanged,original,results:results.map((r)=>'crossedWrittenIntervals' in r?{capo:r.capo,status:r.status,bass:r.bass,harmony:r.harmony,crossings:r.crossedWrittenIntervals,inflatedLeaps:r.inflatedSameLineLeaps.length,isolatedHigh:r.isolatedHighBass.length,validation:r.validation.status,selected:r.selectedCapo}:{capo:r.capo,status:r.status,diagnostics:r.diagnostics})},null,2));
if(!unchanged) throw new Error('Author inputs changed during experiment');

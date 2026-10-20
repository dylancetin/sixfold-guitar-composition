import { MelodySelectionSchema, SourceScoreV1Schema, compare, eventEnd, q } from '../src/domain';
import type { MelodySelection, ScoreV1, SourceScoreV1 } from '../src/domain';
import { createDefaultRequest, deterministicPlanner, guitarEngine, guitarValidator, secondsBetween } from '../src/engine';
import { digest, documentDigest } from '../src/engine/identity';
import { eightBarStudy } from '../tests/engine/studies';

// Local canonical documents only: deliberately no importer, HTTP, or song constants.
// Copyrighted source/candidate documents must remain outside tracked paths.
const args=process.argv.slice(2);
const option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const sourcePath=option('--source'),selectionPath=option('--selection');
let source:SourceScoreV1,selection:MelodySelection;
if (sourcePath) {
  if (!selectionPath) throw new Error('--source requires --selection (complete explicit canonical map)');
  source=SourceScoreV1Schema.parse(await Bun.file(sourcePath).json());
  const proposal=await Bun.file(selectionPath).json();
  selection=MelodySelectionSchema.parse(proposal.selection??proposal);
} else {
  const fixture=eightBarStudy();source=fixture.source;selection=fixture.request.selection;
}
if (documentDigest(source)!==source.revision.digest) throw new Error('Source digest mismatch; stamp source identity in API before probing');
if (selection.sourceRevision.id!==source.revision.id||selection.sourceRevision.digest!==source.revision.digest) throw new Error('Selection must bind the exact canonical source revision/digest');
const difficulty=option('--difficulty')??'intermediate';
if (!['beginner','intermediate','advanced'].includes(difficulty)) throw new Error('Unknown difficulty');
const request=createDefaultRequest(source,selection,difficulty as 'beginner'|'intermediate'|'advanced');
request.budget.maxStates=Number(option('--max-states')??10000);
const planned=await deterministicPlanner.plan(source,request);
const summaries=[];
for (const capo of [0,2,'recommend'] as const) {
  request.preferences.capo=capo==='recommend'?{mode:'recommend',compare:[0,2]}:{mode:'chosen',value:capo};
  const start=performance.now();
  const result=guitarEngine.arrange(source,request,planned.plan,planned.provenance);
  const elapsedMs=performance.now()-start;
  if (result.status!=='candidate') {summaries.push({capo,status:result.status,elapsedMs,diagnostics:result.diagnostics.slice(0,30)});continue;}
  const score=result.score;
  const validation=guitarValidator.validate(source,score,{approvedRevisions:[]});
  const selectedIds=new Set(selection.sections.flatMap((s)=>s.selectors.flatMap((s)=>s.eventIds)));
  const selectedNotes=source.events.filter((e)=>selectedIds.has(e.id)&&e.kind==='note');
  // Independent source-to-performance identity oracle, not generator counts.
  const melody=score.sounds.filter((s)=>s.role==='melody');
  const mismatches:string[]=[];
  for (const e of selectedNotes) {
    if(e.kind!=='note') continue;
    const sound=melody.filter((s)=>s.provenance.kind==='source'&&s.provenance.eventIds.length===1&&s.provenance.eventIds[0]===e.id);
    if(sound.length!==1||sound[0]!.soundingMidi!==e.soundingMidi||compare(sound[0]!.start,e.start)!==0||compare(sound[0]!.duration,e.duration)!==0) mismatches.push(e.id);
  }
  const ending=eventEnd(score.performedSounds.reduce((last,s)=>compare(eventEnd(s),eventEnd(last))>0?s:last));
  const counts=(role:ScoreV1['sounds'][number]['role'])=>({written:score.sounds.filter((s)=>s.role===role).length,performed:score.performedSounds.filter((p)=>score.sounds.some((s)=>s.id===p.soundId&&s.role===role)).length});
  const melodyTimeline=score.performedSounds.flatMap((p)=>{
    const s=score.sounds.find((s)=>s.id===p.soundId)!;
    if(s.role!=='melody') return [];
    return [{sourceIds:s.provenance.kind==='source'?s.provenance.eventIds:[],pitch:s.soundingMidi,start:p.start,duration:p.duration}];
  });
  summaries.push({capo,status:result.status,elapsedMs,selectedCapo:score.instrument.capo,validation:validation.status,sourceMelodyMismatches:mismatches,melodyTimelineDigest:digest(melodyTimeline),selectedSourceAttacks:selectedNotes.length,part0SelectedAttacks:selectedNotes.filter((e)=>e.partId===0).length,writtenBars:score.bars.length,occurrences:score.occurrences.length,performedQuarters:eventEnd({start:score.occurrences.at(-1)!.start,duration:score.occurrences.at(-1)!.length}),seconds:secondsBetween(q(0),eventEnd({start:score.occurrences.at(-1)!.start,duration:score.occurrences.at(-1)!.length}),score.performedTempos),lastSoundRelease:ending,melody:counts('melody'),bass:counts('bass'),harmony:counts('harmony'),notationSegments:score.notation.length,contacts:score.contacts.length,handStates:score.handStates.length,changes:{omissions:score.changes.filter((c)=>c.kind==='omission').length,bassRegister:score.changes.filter((c)=>c.kind==='bass-register'&&c.role==='bass').length,harmonyRegister:score.changes.filter((c)=>c.kind==='bass-register'&&c.role==='harmony').length,shortened:score.changes.filter((c)=>c.kind==='shortened-sustain').length},capoComparison:score.capoComparison,diagnostics:[...result.diagnostics,...validation.diagnostics]});
  const prefix=option('--score-prefix');
  if (prefix) await Bun.write(`${prefix}-${capo}.json`,JSON.stringify(score));
}
const report={scope:source.manifest.identity.kind==='original-fixture'?'original musical study':'Local canonical source experiment; no copyrighted musical document embedded',identity:source.manifest.identity,sourceRevision:source.revision,sourceDigestVerified:true,difficulty,profile:request.ability,maxStates:request.budget.maxStates,planner:planned.provenance,planCandidates:planned.plan.candidates.length,results:summaries};
const output=JSON.stringify(report,null,2);
if (option('--output')) await Bun.write(option('--output')!,output+'\n');
console.log(output);
process.exitCode=summaries.every((s)=>s.status==='candidate'&&'validation' in s&&s.validation==='passed')?0:1;

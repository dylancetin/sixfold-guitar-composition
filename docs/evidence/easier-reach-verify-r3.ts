// Independent integration reproduction; private song inputs/outputs are never fixtures.
// RUN_DIR, AUTHOR_DIR, REVIEW_DIR required. BASELINE_DIR optionally points to an
// isolated `git archive 845442a` source tree (with node_modules linked), never root edits.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { revisionDigest } from '../../src/domain';
import { acceptAgentPlan } from '../../src/agent/plan';
import { arrangeBounded } from '../../src/agent/engine';
import { loadPreparedRun } from '../../src/agent/prepare';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { oneBarStudy, literalPlanner } from '../../tests/engine/studies';
const runDir=process.env.RUN_DIR!,author=process.env.AUTHOR_DIR!,out=process.env.REVIEW_DIR!;
assert(runDir&&author&&out);await mkdir(out,{recursive:true});
const json=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const {run,source,request,baseline}=await loadPreparedRun(runDir);
const bytes=await readFile(`${runDir}/plan.json`),receipt=await json(`${runDir}/delegation.json`);
assert.equal(hash(bytes),'58adb71d3453d8de7770b4ad34449f8ad6d618da301ef677b061ea6079adbe11');
assert.deepEqual(bytes,await readFile(`${author}/plan.json`));
assert.equal(receipt.taskId,'node:delegated-task:command%3Amcp%3A620ca5f8-6224-4a65-b107-1cb562d2b34d%3Adelegate-task%3Aguitar-easier-reach-musician-r3');
assert.equal(receipt.callId,receipt.taskId);assert.equal(receipt.calledAt,'2026-10-21T08:41:37.596Z');
assert.equal(receipt.provider,'opencode');assert.equal(receipt.model,'openai/gpt-6.1-sol');
assert.equal(run.requestDigest,'9cbad5ea5f0a6b8cca23e04643bf8ffa3ca43ce8c937d42e16f5fd9bcb8f7e34');
const accepted=await acceptAgentPlan({bytes,delegation:receipt,source,requestDigest:run.requestDigest,baseline});
assert.equal(accepted.plan.candidates.length,64);
assert.deepEqual(await json(`${runDir}/selection.json`),request.selection);
const trials:any[]=[];
for(const capo of [0,2,'compare'] as const){
  const req=structuredClone(request);if(capo!=='compare')req.preferences.capo={mode:'chosen',value:capo};
  const start=performance.now(),result=await arrangeBounded(source,req,accepted.plan,accepted.provenance);
  const elapsedMs=Math.round(performance.now()-start);assert.equal(result.status,'candidate',JSON.stringify(result));
  if(result.status!=='candidate')throw Error('No candidate');
  const validation=guitarValidator.validate(source,result.score,{approvedRevisions:[]});assert.equal(validation.status,'passed');assert.equal(validation.transitions,'uncalibrated');
  assert.equal(await revisionDigest(result.score),result.score.revision.digest);
  assert(result.diagnostics.some(d=>d.code==='transition-unverified'));
  assert.equal(result.score.changes.filter(c=>c.kind==='omission'||c.kind==='shortened-sustain').length,0);
  const prior=await json(`${author}/revised-compact-capo${capo}-score.json`);
  const strip=(s:any)=>{const {revision,planner,...rest}=s;return rest;};
  assert.deepEqual(strip(result.score),strip(prior),'fresh receipt changes provenance/digest only');
  await writeFile(`${out}/capo${capo}-score.json`,JSON.stringify(result.score,null,2)+'\n');
  trials.push({capo,selected:result.score.instrument.capo,elapsedMs,budget:req.budget,validation});
}
const negatives=[];
for(const kind of ['raw-digest','source','request']){
  const bad=structuredClone(receipt);if(kind==='raw-digest')bad.responseDigest='0'.repeat(64);if(kind==='source')bad.sourceRevision.digest='0'.repeat(64);if(kind==='request')bad.requestDigest='0'.repeat(64);
  await assert.rejects(()=>acceptAgentPlan({bytes,delegation:bad,source,requestDigest:run.requestDigest,baseline}));negatives.push(kind);
}
const codeReview:any={};
if(process.env.BASELINE_DIR){
  const {guitarEngine:old}=await import(pathToFileURL(`${process.env.BASELINE_DIR}/src/engine/index.ts`).href);
  const example=oneBarStudy([['lead',0,0,4,56],['root',1,0,1,37]]);example.request.preferences.capo={mode:'chosen',value:2};
  const before=JSON.stringify(example),a=old.arrange(example.source,example.request,example.plan,literalPlanner),b=guitarEngine.arrange(example.source,example.request,example.plan,literalPlanner);
  assert.equal(JSON.stringify(example),before);assert.equal(a.status,'candidate');assert.equal(b.status,'candidate');
  if(b.status!=='candidate')throw Error('counterexample failed');
  assert.deepEqual(a.score.placements.map((p:any)=>[p.fret,p.finger]),[[4,1],[2,2]]);
  assert.deepEqual(b.score.placements.map(p=>[p.fret,p.finger]),[[4,4],[2,2]]);
  codeReview.counterexample={old:a.score.placements,new:b.score.placements};
  codeReview.actualTrials=[];
  for(const capo of [0,2,'compare'] as const){
    const req=structuredClone(request);if(capo!=='compare')req.preferences.capo={mode:'chosen',value:capo};
    const inputs=JSON.stringify({source,req,plan:accepted.plan,provenance:accepted.provenance});
    const start=performance.now(),r=old.arrange(source,req,accepted.plan,accepted.provenance);
    assert.equal(r.status,'candidate');assert.equal(JSON.stringify({source,req,plan:accepted.plan,provenance:accepted.provenance}),inputs);
    const n=await json(`${out}/capo${capo}-score.json`);
    const strip=(s:any)=>{const {revision,placements,...rest}=s;return {...rest,placements:placements.map(({finger,...p}:any)=>p)};};
    assert.deepEqual(strip(r.score),strip(n));
    codeReview.actualTrials.push({capo,baselineMs:Math.round(performance.now()-start),onlyFingerAndDigestChanged:true,changedFingerLabels:n.placements.filter((p:any,i:number)=>p.finger!==r.score.placements[i].finger).length});
  }
  const specified=oneBarStudy([['mel',0,0,4,65],['bass',1,0,4,40]]);
  specified.source.form.repeats=[{id:'repeat',fromBarId:'b1',toBarId:'b1',totalPasses:2}];
  specified.source.revision.digest=await revisionDigest(specified.source);specified.request.sourceRevision.digest=specified.source.revision.digest;specified.request.selection.sourceRevision.digest=specified.source.revision.digest;
  specified.request.ability.transition={status:'specified',maxPhysicalFretsPerSecond:10,minFingerReassignmentMs:0,evidence:'Independent technical control'};
  const immutable=JSON.stringify(specified),s=guitarEngine.arrange(specified.source,specified.request,specified.plan,literalPlanner);
  assert.equal(s.status,'candidate');assert.deepEqual(s,old.arrange(specified.source,specified.request,specified.plan,literalPlanner));assert.equal(JSON.stringify(specified),immutable);
  codeReview.specifiedRepeatedResultExactlyUnchanged=true;
}
await writeFile(`${out}/root-verification.json`,JSON.stringify({status:'VERIFIED',createdAt:new Date().toISOString(),receipt,rawPlanSha256:hash(bytes),trials,negatives,codeReview,humanAcceptance:'pending; heuristic labels are not biomechanics'},null,2)+'\n');
console.log(JSON.stringify({trials:trials.map(({validation,...t})=>t),codeReview,negatives},null,2));

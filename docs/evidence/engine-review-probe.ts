// Independent judge reproduction. Local canonical input only; never writes a checkout.
// bun docs/evidence/engine-review-probe.ts SOURCE_DIR /tmp/opencode/REVIEW [ADAPTER_ROOT]
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createDefaultRequest, deterministicPlanner, guitarEngine, guitarValidator } from '../../src/engine';
import { scopeDigest } from '../../src/engine/scopes';
import { score as original, source as originalSource } from '../../tests/fixtures/original';
import { eightBarStudy, oneBarStudy, literalPlanner } from '../../tests/engine/studies';

const [sourceDir,out,adapterRoot]=process.argv.slice(2);
if(!sourceDir||!out||!out.startsWith('/tmp/opencode/')) throw new Error('Expected SOURCE_DIR and /tmp/opencode/OUTPUT_DIR');
await mkdir(out,{recursive:true});
const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const stamp=(s:any)=>{const v=structuredClone(s);delete v.revision.digest;s.revision.digest=createHash('sha256').update(canonical(v)).digest('hex');return s;};
const source=await Bun.file(`${sourceDir}/source.json`).json();
const proposal=await Bun.file(`${sourceDir}/melody-proposal.json`).json();
const selection=proposal.selection??proposal;
const report:any={experiments:[],negativeControls:[],adapter:[]};
const validate=(src:any,s:any,context:any={approvedRevisions:[]})=>guitarValidator.validate(src,s,context);
for(const difficulty of ['beginner','intermediate','advanced'] as const) {
  const request=createDefaultRequest(source,selection,difficulty);
  const planned=await deterministicPlanner.plan(source,request);
  for(const capo of [0,2,'recommend'] as const) {
    request.preferences.capo=capo==='recommend'?{mode:'recommend',compare:[0,2]}:{mode:'chosen',value:capo};
    const result=guitarEngine.arrange(source,request,planned.plan,planned.provenance);
    if(result.status!=='candidate') throw new Error(JSON.stringify(result));
    const score=result.score,v=validate(source,score);if(v.status!=='passed') throw new Error(JSON.stringify(v));
    await Bun.write(`${out}/${difficulty}-${capo}.json`,JSON.stringify(score));
    report.experiments.push({difficulty,capo,status:result.status,validation:v.status,selectedCapo:score.instrument.capo,diagnostics:result.diagnostics});
  }
}
const base=await Bun.file(`${out}/intermediate-2.json`).json();
const negative=(name:string,src:any,base:any,mutate:(s:any)=>void,expected:string,context:any={approvedRevisions:[]})=>{
  const s=structuredClone(base);mutate(s);stamp(s);const v=validate(src,s,context);
  const codes=[...new Set(v.diagnostics.filter((d:any)=>d.severity==='error').map((d:any)=>d.code))];
  const detected=v.status==='failed'&&codes.includes(expected)&&!codes.includes('revision-stale');
  report.negativeControls.push({name,status:v.status,codes,expected,detected});if(!detected) throw new Error(name+': '+JSON.stringify(v));
};
negative('coherent final-melody removal',source,base,s=>{
  const id=s.sounds.filter((s:any)=>s.role==='melody').at(-1).id;
  s.sounds=s.sounds.filter((e:any)=>e.id!==id);s.notation=s.notation.filter((e:any)=>e.eventId!==id);
  s.performedSounds=s.performedSounds.filter((e:any)=>e.soundId!==id);s.contacts=s.contacts.filter((e:any)=>e.soundId!==id);
  const used=new Set(s.performedSounds.map((e:any)=>e.placementId));s.placements=s.placements.filter((e:any)=>used.has(e.id));
  const times=[...new Map(s.contacts.flatMap((c:any)=>[c.start,c.release]).map((t:any)=>[`${t.n}/${t.d}`,t])).values()] as any[];
  times.sort((a,b)=>a.n/a.d-b.n/b.d);
  s.handStates=times.map(at=>{const active=s.contacts.filter((c:any)=>c.start.n/c.start.d<=at.n/at.d&&at.n/at.d<c.release.n/c.release.d);const frets=active.map((c:any)=>s.placements.find((p:any)=>p.id===c.placementId)).filter((p:any)=>p.fret>0).map((p:any)=>p.fret+s.instrument.capo);return {at,activeContactIds:active.map((c:any)=>c.id),position:frets.length?{kind:'fretting',anchorPhysicalFret:Math.min(...frets)}:{kind:'released'}};});
},'melody-mismatch');
negative('flattened repeat schedule',source,base,s=>{s.occurrences=s.occurrences.slice(0,46);},'form-mismatch');
negative('missing repeat-entry tempo',source,base,s=>{const o=s.occurrences.find((o:any)=>o.entry==='repeat-jump');s.performedTempos=s.performedTempos.filter((t:any)=>t.occurrenceId!==o.id);},'tempo-mismatch');
negative('removed omission audits',source,base,s=>{s.changes=s.changes.filter((c:any)=>c.kind!=='omission');},'source-mismatch');
negative('removed register-move audits',source,base,s=>{s.changes=s.changes.filter((c:any)=>c.kind!=='bass-register');},'source-mismatch');
negative('wrong capo',source,base,s=>{s.instrument.capo=0;s.capoComparison.selected=0;s.preferences.capo={mode:'chosen',value:0};},'pitch-placement');
negative('wrong source identity',source,base,s=>{s.source.revision.id='review-other-source';},'source-mismatch');
negative('occupied held finger',originalSource,original,s=>{s.placements.find((p:any)=>p.id==='pb1').finger=1;},'finger-collision');
negative('later attack on occupied string, pitches correct',originalSource,original,s=>{Object.assign(s.placements.find((p:any)=>p.id==='p1'),{stringIndex:4,fret:8,finger:3});s.handStates.find((h:any)=>h.at.n===1&&h.at.d===1).position.anchorPhysicalFret=8;},'string-collision');
negative('early contact release',originalSource,original,s=>{s.contacts[0].release={n:1,d:2};},'finger-collision');
negative('missing boundary state',originalSource,original,s=>{s.handStates.splice(2,1);},'finger-collision');
const approved=structuredClone(base),ref={id:approved.revision.id,digest:approved.revision.digest},locked=structuredClone(base);
locked.locks=[{role:'melody',approvedFrom:ref,scopeDigest:scopeDigest(approved,'melody'),sounds:approved.sounds.filter((s:any)=>s.role==='melody'),rests:approved.rests.filter((s:any)=>s.role==='melody')}];
stamp(locked);report.lockPositive=validate(source,locked,{approvedRevisions:[approved]}).status;
negative('absent referenced approval',source,locked,()=>{},'approval-stale');
negative('copied digest / modified full lock',source,locked,s=>{s.locks[0].sounds[0].duration={n:99,d:1};},'approval-stale',{approvedRevisions:[approved]});
report.halfOpenReleaseReusePositive=validate(originalSource,original).status;
report.physicalBoundary=[];
for(const [pitch,fret] of [[62,10],[63,11]] as const) {
  const f=oneBarStudy([['physical-boundary',0,0,4,pitch]]);f.request.preferences.capo={mode:'chosen',value:2};
  const result=guitarEngine.arrange(f.source,f.request,f.plan,literalPlanner);if(result.status!=='candidate') throw new Error(JSON.stringify(result));
  const s=result.score;s.placements[0]={...s.placements[0]!,stringIndex:2,fret,finger:1};s.handStates[0]!.position={kind:'fretting',anchorPhysicalFret:2+fret};stamp(s);
  const v=validate(f.source,s);if(v.status!==(fret===10?'passed':'failed')) throw new Error(JSON.stringify(v));
  report.physicalBoundary.push({capo:2,relativeFret:fret,physicalFret:2+fret,maxPhysicalFret:12,validation:v.status,codes:v.diagnostics.filter((d:any)=>d.severity==='error').map((d:any)=>d.code)});
}
if(adapterRoot) {
  const {createAlphaTabScore}=await import(`${adapterRoot}/src/adapters/alpha-tab.ts`);
  const {compileTimeline}=await import(`${adapterRoot}/src/adapters/timeline.ts`);
  for(const capo of [0,2,'recommend']) {
    const s=await Bun.file(`${out}/intermediate-${capo}.json`).json();
    const timeline=compileTimeline(s);
    try {const a=createAlphaTabScore(s);report.adapter.push({name:`live-${capo}`,status:'passed',notes:timeline.notes.length,segments:a.projection.mapping.length});}
    catch(e) {report.adapter.push({name:`live-${capo}`,status:'failed',canonicalTimeline:'passed',error:String(e)});}
  }
  const study=eightBarStudy(),p=await deterministicPlanner.plan(study.source,study.request),result=guitarEngine.arrange(study.source,study.request,p.plan,p.provenance);
  if(result.status!=='candidate') throw new Error(JSON.stringify(result));
  try {const a=createAlphaTabScore(result.score);report.adapter.push({name:'eight-bar',status:'passed',segments:a.projection.mapping.length});}
  catch(e) {report.adapter.push({name:'eight-bar',status:'failed',error:String(e)});}
}
await Bun.write(`${out}/execution.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

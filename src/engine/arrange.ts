import { add, ArrangementRequestSchema, compare, eventEnd, overlaps, PlanSchema, PlannerProvenanceSchema, q, ScoreV1Schema, SourceScoreV1Schema, subtract } from '../domain';
import type { ArrangeResult, ArrangementRequest, Diagnostic, Engine, Instrument, Occurrence, PerformedSound, Placement, Plan, PlannerProvenance, Rest, ScoreV1, Sound, SourceEvent, SourceScoreV1 } from '../domain';
import { diagnostic, expandForm } from './form';
import { digest, documentDigest, same } from './identity';
import { makeNotation } from './notation';
import { compareSolutions, pitchPositions, searchSequence } from './search';
import type { Budget, SearchItem, SearchState } from './search';
import { selectMelody, spell } from './selection';
import { guitarValidator } from './validator';
import { scopeDigest } from './scopes';
import { roleOrderConflict } from './roles';

type Note=Extract<SourceEvent,{kind:'note'}>;
type Trial={status:'candidate';score:ScoreV1;state:SearchState}|Exclude<ArrangeResult,{status:'candidate'}>;

export const guitarEngine:Engine={
  arrange(source,request,plan,planner) {
    try {
      const parses=[SourceScoreV1Schema.safeParse(source),ArrangementRequestSchema.safeParse(request),PlanSchema.safeParse(plan),PlannerProvenanceSchema.safeParse(planner)];
      if (parses.some((p)=>!p.success)) {
        const unsupportedForm=!parses[0]!.success&&parses[0]!.error.issues.every((i)=>i.path[0]==='form');
        return {status:unsupportedForm?'unsupported':'invalid-input',diagnostics:[diagnostic(unsupportedForm?'unsupported-construct':'invalid-input',parses.filter((p)=>!p.success).map((p)=>p.error.message).join('; '))]};
      }
      const sourceRef={id:source.revision.id,digest:source.revision.digest};
      if (!same(sourceRef,request.sourceRevision)||!same(sourceRef,request.selection.sourceRevision)||documentDigest(source)!==source.revision.digest) return {status:'invalid-input',diagnostics:[diagnostic('source-mismatch','Request/selection must bind the exact digest-verified source revision')]};
      if (request.preferences.difficulty!==request.ability.difficulty||request.preferences.ability.id!==request.ability.id||request.preferences.ability.version!==request.ability.version) return {status:'invalid-input',diagnostics:[diagnostic('profile-limit','Selected difficulty and resolved ability reference disagree')]};
      if (new Set(plan.candidates.map((c)=>c.id)).size!==plan.candidates.length) return {status:'invalid-input',diagnostics:[diagnostic('source-mismatch','Plan has duplicate candidate IDs')]};
      for (const c of plan.candidates) for (const id of c.sourceEventIds) if (!source.events.some((e)=>e.id===id&&e.kind==='note')) return {status:'invalid-input',diagnostics:[diagnostic('source-mismatch','Plan contains an unknown/non-note source event',[id])]};
      if (planner.mode==='configured-llm'&&planner.acceptedCandidateIds.some((id)=>!plan.candidates.some((c)=>c.id===id))) return {status:'invalid-input',diagnostics:[diagnostic('source-mismatch','Planner provenance references absent accepted candidates')]};
      const selected=selectMelody(source,request);
      if (selected.status!=='selected') return selected;
      if (!selected.sounds.length) return {status:'unsupported',diagnostics:[diagnostic('unsupported-construct','V1 score requires a sounding melody; entirely silent arrangements are unsupported')]};
      const expansion=expandForm({...source,events:selected.events},request.preferences.tempoScale);
      if (expansion.status!=='expanded') return expansion;
      const caps=request.preferences.capo.mode==='chosen'?[request.preferences.capo.value]:request.preferences.capo.compare;
      const budget:Budget={used:0,limit:request.budget.maxStates,pruned:false};
      const trials:{capo:number;result:Trial}[]=[];
      for (const [i,capo] of caps.entries()) {
        if (budget.used>=budget.limit) {
          trials.push({capo,result:{status:'search-exhausted',diagnostics:[diagnostic('search-budget',`No remaining shared state budget to evaluate capo ${capo}`)]}});
          continue;
        }
        // Compare both settings, rather than spending the full budget on the first.
        const sub:Budget={used:0,limit:Math.max(1,Math.floor((budget.limit-budget.used)/(caps.length-i))),pruned:false};
        const result=arrangeCapo(source,request,plan,planner,selected.sounds,selected.rests,capo,sub);
        budget.used+=sub.used;budget.pruned ||= sub.pruned;
        trials.push({capo,result});
      }
      const found=trials.filter((t):t is {capo:number;result:Extract<Trial,{status:'candidate'}>}=>t.result.status==='candidate').sort((a,b)=>compareSolutions(a.result.state,b.result.state)||a.capo-b.capo);
      if (!found.length) {
        const failures=trials.map((t)=>t.result).filter((r)=>r.status!=='candidate');
        // A proof at one capo is not a proof over all recommended alternatives.
        if (failures.every((r)=>r.status==='proven-unsatisfiable')) return {status:'proven-unsatisfiable',proof:{method:'exhaustive-finite-domain',checkedStates:failures.reduce((n,r)=>n+(r.status==='proven-unsatisfiable'?r.proof.checkedStates:0),0),domainDigest:digest({sourceRevision:sourceRef,request,capos:caps,proofs:failures.map((r)=>r.status==='proven-unsatisfiable'?r.proof.domainDigest:'')})},diagnostics:failures.flatMap((r)=>r.diagnostics)};
        const first=failures.find((r)=>r.status==='reapproval-needed')??failures.find((r)=>r.status==='unsupported')??failures.find((r)=>r.status==='invalid-candidate')??failures.find((r)=>r.status==='search-exhausted')??failures[0]!;
        return {status:first.status,diagnostics:failures.flatMap((r)=>r.diagnostics)} as Exclude<ArrangeResult,{status:'candidate'}>;
      }
      const chosen=found[0]!;
      chosen.result.score.capoComparison={selected:chosen.capo,reason:request.preferences.capo.mode==='chosen'?'User-chosen capo; sounding melody preserved':'Compared capo 0 and 2 with identical concert melody. Prefer retained source bass, source-oriented bass register/contour, then sparse inner harmony and lower fretting cost; role-order-v1, no key transposition.',alternatives:trials.map(({capo,result})=>({capo,outcome:result.status==='candidate'?'candidate':result.status==='search-exhausted'?'search-exhausted':'unsatisfied',reason:result.status==='candidate'?`Retained ${result.score.sounds.filter((s)=>s.role==='bass').length} bass and ${result.score.sounds.filter((s)=>s.role==='harmony').length} harmony attacks; concert melody unchanged; source-oriented bass register/contour penalty ${result.state.bassRegisterCost}`:result.diagnostics.map((d)=>d.message).join('; ')}))};
      chosen.result.score.revision.digest=documentDigest(chosen.result.score);
      const diagnostics:Diagnostic[]=[{...diagnostic('search-budget',`Constraint-based unapproved draft; ${budget.used}/${budget.limit} successor states evaluated${budget.pruned?', bounded beam pruned alternatives':''}. State budget is deterministic; maxElapsedMs is enforced by the outer worker.`),severity:'info'}];
      if (request.ability.transition.status==='uncalibrated') diagnostics.push({...diagnostic('transition-unverified','Movement is uncalibrated; hard-checked draft is available, not a human-playability claim.'),severity:'warning'});
      return {status:'candidate',score:ScoreV1Schema.parse(chosen.result.score),diagnostics};
    } catch (cause) { return {status:'invalid-input',diagnostics:[diagnostic('invalid-input',cause instanceof Error?cause.message:String(cause))]}; }
  },
};

function arrangeCapo(source:SourceScoreV1,request:ArrangementRequest,plan:Plan,planner:PlannerProvenance,melody:Sound[],melodyRests:Rest[],capo:number,budget:Budget):Trial {
  const instrument:Instrument={id:'standard-six-string-guitar-v1',tuning:[40,45,50,55,59,64],stringOrder:'low-to-high',capo,maxPhysicalFret:request.maxPhysicalFret,writtenOctaveOffset:12};
  if (capo>instrument.maxPhysicalFret||capo>request.ability.maxPhysicalFret) return {status:'invalid-input',diagnostics:[diagnostic('profile-limit','Capo exceeds instrument/profile physical neck limit')]};
  const roles=new Set(request.locks.map((l)=>l.role));
  if (roles.size!==request.locks.length) return {status:'invalid-input',diagnostics:[diagnostic('approval-stale','Duplicate approved role lock')]};
  let requiredMelody=melody;
  const melodyLock=request.locks.find((l)=>l.role==='melody');
  if (melodyLock) requiredMelody=melodyLock.sounds;
  for (const sound of requiredMelody) if (!pitchPositions(sound.soundingMidi,instrument,request.ability).length) {
    if (budget.limit-budget.used<6) return {status:'search-exhausted',diagnostics:[diagnostic('search-budget','Insufficient remaining state budget for the six-string empty-domain proof')]};
    budget.used+=6;
    return {
    status:request.locks.length?'reapproval-needed':'proven-unsatisfiable',
    ...(request.locks.length?{}:{proof:{method:'exhaustive-finite-domain' as const,checkedStates:6,domainDigest:digest({sound,instrument,ability:request.ability,positions:[]})}}),
    diagnostics:[diagnostic('unsatisfied',`Melody pitch ${sound.soundingMidi} has no legal position on any of six strings at capo ${capo}; no octave editing performed`,[sound.id])],
    } as Trial;
  }
  const items:SearchItem[]=requiredMelody.map((s)=>({id:s.id,start:s.start,role:s.role,required:true,variants:[s]}));
  const rests=melodyLock?melodyLock.rests:melodyRests;
  for (const lock of request.locks.filter((l)=>l.role!=='melody')) for (const s of lock.sounds) items.push({id:s.id,start:s.start,role:s.role,required:true,variants:[s]});
  const mandatory=items.flatMap((item)=>item.variants);
  for(const [i,a] of mandatory.entries()) for(const b of mandatory.slice(i+1)) if(roleOrderConflict(a,b)&&overlaps(a.start,eventEnd(a),b.start,eventEnd(b))) return {status:'reapproval-needed',diagnostics:[diagnostic('unsatisfied','[role-order-v1] Existing locked accompaniment crosses another mandatory role; explicitly reapprove/revoice it. Locks were not altered.',[a.id,b.id])]};
  const planned=plannedSounds(source,request,plan,melody,instrument);
  for (const item of planned) if (!roles.has(item.role)) items.push(item);
  const written=expandForm({...source,form:{...source.form,repeats:[]},events:[]},request.preferences.tempoScale);
  if (written.status!=='expanded') return written;
  const result=searchSequence(items,instrument,request.ability,written.performedTempos,budget);
  if (result.status!=='found') return {status:request.locks.some((l)=>l.role!=='melody')?'reapproval-needed':'search-exhausted',diagnostics:[diagnostic('search-budget',result.reason)]};
  const state=result.state;
  const sounds=[...state.sounds].sort((a,b)=>compare(a.start,b.start)||a.id.localeCompare(b.id));
  const allRests=[...rests,...request.locks.filter((l)=>l.role!=='melody').flatMap((l)=>l.rests)];
  const expansion=expandForm({...source,events:[...sounds.map((s)=>({kind:'note' as const,id:s.id,start:s.start,duration:s.duration})),...allRests.map((r)=>({kind:'rest' as const,id:r.id,start:r.start,duration:r.duration}))]},request.preferences.tempoScale);
  if (expansion.status!=='expanded') return expansion;
  const notation=makeNotation([...sounds,...allRests],source.bars);
  if (!notation) {
    const failed=[...sounds,...allRests].filter((e)=>!makeNotation([e],source.bars));
    const barIds=source.bars.filter((b)=>failed.some((e)=>overlaps(e.start,eventEnd(e),b.start,add(b.start,b.length)))).map((b)=>b.id);
    return {status:'unsupported',diagnostics:[diagnostic('unsupported-construct','Exact source duration cannot be represented by supported notation values; no quantization performed',failed.map((e)=>e.id),barIds)]};
  }
  let placements=state.placements;
  const performedSounds=unfoldSounds(sounds,expansion.occurrences,source.bars,placements);
  if (request.ability.transition.status==='specified') {
    const performedItems:SearchItem[]=performedSounds.map((ps)=>{const s=sounds.find((s)=>s.id===ps.soundId)!;return {id:ps.id,start:ps.start,role:s.role,required:true,variants:[{...s,id:ps.id,start:ps.start}]};});
    const reassigned=searchSequence(performedItems,instrument,request.ability,expansion.performedTempos,budget);
    if (reassigned.status!=='found') return {status:'search-exhausted',diagnostics:[diagnostic('search-budget','Full performed sequence (including repeat boundaries): '+reassigned.reason)]};
    placements=reassigned.state.placements.map((pl)=>({...pl,soundId:performedSounds.find((ps)=>ps.id===pl.soundId)!.soundId}));
    for (const ps of performedSounds) ps.placementId=`pl-${ps.id}`;
  }
  const contacts=performedSounds.map((ps,i)=>({id:`c${i+1}`,performedSoundId:ps.id,soundId:ps.soundId,placementId:ps.placementId,start:ps.start,release:eventEnd(ps)}));
  const boundaries=[...new Map(contacts.flatMap((c)=>[c.start,c.release]).map((t)=>[`${t.n}/${t.d}`,t])).values()].sort(compare);
  const handStates:ScoreV1['handStates']=boundaries.map((at)=>{
    const active=contacts.filter((c)=>compare(c.start,at)<=0&&compare(c.release,at)>0);
    const frets=active.map((c)=>placements.find((p)=>p.id===c.placementId)!).filter((p)=>p.fret>0).map((p)=>p.fret+capo);
    return {at,activeContactIds:active.map((c)=>c.id),position:frets.length?{kind:'fretting',anchorPhysicalFret:Math.min(...frets)}:{kind:'released'}};
  });
  const candidateId=digest({source:request.sourceRevision,request,plan,capo}).slice(0,24);
  const score:ScoreV1={schemaVersion:1,projectId:`candidate-${candidateId}`,revision:{id:`candidate-r-${candidateId}`,parentId:null,digest:'0'.repeat(64)},source:{revision:request.sourceRevision,manifest:source.manifest},key:source.key,selection:request.selection,preferences:request.preferences,instrument,ability:request.ability,
    capoComparison:{selected:capo,reason:'Provisional trial',alternatives:[{capo,outcome:'candidate',reason:'Trial arrangement'}]},bars:source.bars,tempos:source.tempos,form:source.form,occurrences:expansion.occurrences,performedTempos:expansion.performedTempos,sounds,rests:allRests,notation,placements,performedSounds,contacts,handStates,
    chords:[{id:'source-harmony-unlabelled',start:q(0),duration:add(source.bars.at(-1)!.start,source.bars.at(-1)!.length),chord:{status:'unknown',reason:'Sparse tones are source-grounded; no inferred chord/key label asserted'},evidenceEventIds:[...new Set(plan.candidates.filter((c)=>c.role==='harmony').flatMap((c)=>c.sourceEventIds))],basis:'unresolved'}],
    changes:makeChanges(source,request,plan,sounds),plan,planner,locks:request.locks,approvals:{stage:'sourceReady'},musicalReview:{status:'pending',reason:'Complete source-grounded proposed selection and constrained arrangement; musician review pending'}};
  score.revision.digest=documentDigest(score);
  for (const lock of request.locks) if (scopeDigest(score,lock.role)!==lock.scopeDigest) return {status:'reapproval-needed',diagnostics:[diagnostic('approval-stale',`The complete ${lock.role} scope cannot be carried unchanged (events, upstream selection, or change audit differs). No approved material was silently dropped or revoiced.`)]};
  // Engine cannot authenticate approvals (its port has no repository context).
  // Check all musical/physical facts on an otherwise identical unlocked draft;
  // the API must validate returned original locks with authoritative context.
  const check={...score,locks:[]};check.revision={...score.revision,digest:documentDigest(check)};
  const validation=guitarValidator.validate(source,check,{approvedRevisions:[]});
  if (validation.status==='failed') return {status:request.locks.length?'reapproval-needed':'invalid-candidate',diagnostics:validation.diagnostics.filter((d)=>d.severity==='error')};
  return {status:'candidate',score,state};
}

function plannedSounds(source:SourceScoreV1,request:ArrangementRequest,plan:Plan,melody:Sound[],instrument:Instrument):SearchItem[] {
  const items:SearchItem[]=[];
  const seen=new Set<string>();
  for (const c of plan.candidates) for (const id of c.sourceEventIds) {
    const sourceNote=source.events.find((e):e is Note=>e.id===id&&e.kind==='note')!;
    const key=`${c.role}:${id}`;if (seen.has(key)) continue;seen.add(key);
    const soundId=`${c.role==='bass'?'b':'h'}${items.length+1}`;
    const variants:Sound[]=[];
    const density=c.role==='bass'?request.preferences.bassDensity:request.preferences.harmonyDensity;
    if (density!=='none'&&!sourceNote.effects.some((fx)=>fx.affectsMelody)) {
      const following=source.events.filter((e)=>e.partId===sourceNote.partId&&compare(e.start,sourceNote.start)>0).sort((a,b)=>compare(a.start,b.start))[0]?.start;
      const nextMelody=melody.filter((m)=>compare(m.start,sourceNote.start)>0).sort((a,b)=>compare(a.start,b.start))[0]?.start;
      const limits=[eventEnd(sourceNote),add(sourceNote.start,q(1)),...(following?[following]:[]),...(nextMelody?[nextMelody]:[])].filter((at)=>compare(at,sourceNote.start)>0&&compare(at,eventEnd(sourceNote))<=0).sort(compare);
      const durations=[sourceNote.duration];
      if (limits[0]&&compare(limits[0],eventEnd(sourceNote))<0) durations.push(subtract(limits[0],sourceNote.start));
      const shifts=c.role==='bass'?[-3,-2,-1,0,1,2,3]:[c.octaveShift];
      const target=sourceNote.soundingMidi+request.preferences.transposition.semitones+12*c.octaveShift;
      const pitches=shifts.map((shift)=>sourceNote.soundingMidi+request.preferences.transposition.semitones+12*shift).filter((pitch)=>pitch>=0&&pitch<=127&&pitchPositions(pitch,instrument,request.ability).length).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||a-b);
      for (const duration of durations) for (const midi of pitches.filter((pitch)=>!melody.some((m)=>overlaps(sourceNote.start,add(sourceNote.start,duration),m.start,eventEnd(m))&&pitch>=m.soundingMidi)).slice(0,c.role==='bass'?2:1)) {
        const generated=midi!==sourceNote.soundingMidi+request.preferences.transposition.semitones||!same(duration,sourceNote.duration);
        variants.push({id:soundId,role:c.role,voiceId:c.role==='bass'?'bass':'harmony',start:sourceNote.start,duration,soundingMidi:midi,spelling:midi===sourceNote.soundingMidi?sourceNote.spelling:spell(midi),provenance:generated?{kind:'generated',strategyVersion:'register-sparse-2-role-order-v1',evidenceEventIds:[id],reason:'Source pitch class retained with disclosed source-oriented guitar register/sustain adaptation and strict bass/inner/lead role order'}:{kind:'source',eventIds:[id]}});
      }
    }
    items.push({id:soundId,start:sourceNote.start,role:c.role,required:false,variants,...(c.role==='bass'&&variants.length?{bassReference:{sourceMidi:sourceNote.soundingMidi+request.preferences.transposition.semitones,preferredMidi:variants[0]!.soundingMidi,line:`${sourceNote.partId}/${sourceNote.voiceId}`}}:{})});
  }
  return items;
}

function unfoldSounds(sounds:Sound[],occurrences:Occurrence[],bars:SourceScoreV1['bars'],placements:Placement[]):PerformedSound[] {
  const result:PerformedSound[]=[];
  for (const sound of sounds) {
    const bar=bars.find((b)=>compare(sound.start,b.start)>=0&&compare(sound.start,add(b.start,b.length))<0)!;
    for (const [index,o] of occurrences.entries()) if (o.writtenBarId===bar.id) {
      const occurrenceIds=[o.id];let available=subtract(add(bar.start,bar.length),sound.start);let i=index;
      while (compare(available,sound.duration)<0) {const next=occurrences[++i];if (!next||next.entry!=='contiguous') throw new RangeError('Unsupported jump-crossing sustain');occurrenceIds.push(next.id);available=add(available,next.length);}
      result.push({id:`${sound.id}@${o.id}`,soundId:sound.id,attackOccurrenceId:o.id,occurrenceIds,start:add(o.start,subtract(sound.start,bar.start)),duration:sound.duration,placementId:placements.find((p)=>p.soundId===sound.id)!.id});
    }
  }
  return result.sort((a,b)=>compare(a.start,b.start)||a.id.localeCompare(b.id));
}

function makeChanges(source:SourceScoreV1,request:ArrangementRequest,plan:Plan,sounds:Sound[]):ScoreV1['changes'] {
  const changes:ScoreV1['changes']=[];
  const changeId=(kind:string,role:string,sourceId:string,soundId:string)=>`${role}-${kind}-${digest({sourceId,soundId}).slice(0,24)}`;
  for (const s of sounds) {
    const ids=s.provenance.kind==='source'?s.provenance.eventIds:s.provenance.evidenceEventIds;
    const e=source.events.find((e):e is Note=>ids.includes(e.id)&&e.kind==='note');if (!e) continue;
    const base={role:s.role,sourceEventIds:[e.id],soundIds:[s.id],before:{soundingMidi:e.soundingMidi,duration:e.duration},after:{soundingMidi:s.soundingMidi,duration:s.duration}};
    if (request.preferences.transposition.semitones!==0) changes.push({...base,id:changeId('transpose',s.role,e.id,s.id),kind:'explicit-transposition',reason:request.preferences.transposition.mode==='explicit'?request.preferences.transposition.reason:'Explicit transposition'});
    if (s.role!=='melody'&&s.soundingMidi!==e.soundingMidi+request.preferences.transposition.semitones) changes.push({...base,id:changeId('register',s.role,e.id,s.id),kind:'bass-register',reason:`Source pitch class revoiced into ${s.role==='bass'?'bass':'inner-harmony'} guitar register below melody (register change, not song transposition)`});
    if (!same(s.duration,e.duration)) changes.push({...base,id:changeId('shorten',s.role,e.id,s.id),kind:'shortened-sustain',reason:'Accompaniment released early to preserve protected melody/other held contacts'});
  }
  const seen=new Set<string>();
  for (const c of plan.candidates) for (const id of c.sourceEventIds) {
    const key=`${c.role}:${id}`;if (seen.has(key)) continue;seen.add(key);
    if (sounds.some((s)=>s.role===c.role&&(s.provenance.kind==='source'?s.provenance.eventIds:s.provenance.evidenceEventIds).includes(id))) continue;
    const e=source.events.find((e):e is Note=>e.id===id&&e.kind==='note')!;
    changes.push({id:changeId('omit',c.role,id,''),kind:'omission',role:c.role,sourceEventIds:[id],soundIds:[],before:{soundingMidi:e.soundingMidi,duration:e.duration},after:null,reason:e.effects.some((fx)=>fx.affectsMelody)?'Source accompaniment omitted because its melody-affecting effect is unsupported; effect was not flattened':'Sparse source accompaniment omitted: density preference, unavailable inner/bass register, or held string/finger constraints; melody and approved bass were not sacrificed'});
  }
  return changes;
}

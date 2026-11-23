import { expect, test } from 'bun:test';
import { q } from '../../src/domain';
import type { ArrangeResult, Engine, OptionalPlanner, ScoreV1, Validator } from '../../src/domain';
import { createDefaultAbilityProfile, createDefaultPreferences, deterministicPlanner, guitarEngine, guitarValidator } from '../../src/engine';
import { documentDigest } from '../../src/engine/identity';
import { scopeDigest } from '../../src/engine/scopes';
import { makeNotation } from '../../src/engine/notation';
import { eightBarStudy, literalPlanner, oneBarStudy } from './studies';

function candidate(result:ArrangeResult):ScoreV1 {
  if (result.status!=='candidate') throw new Error(JSON.stringify(result));
  return result.score;
}
const melody=(s:ScoreV1)=>s.performedSounds.filter((p)=>s.sounds.find((s)=>s.id===p.soundId)!.role==='melody').map((p)=>({pitch:s.sounds.find((s)=>s.id===p.soundId)!.soundingMidi,start:p.start,duration:p.duration}));

test('public ports implement exact domain interfaces and all selectable profiles remain no-barre, uncalibrated',()=>{
  const e:Engine=guitarEngine,v:Validator=guitarValidator,p:OptionalPlanner=deterministicPlanner;expect(!!e&&!!v&&!!p).toBe(true);
  for (const difficulty of ['beginner','intermediate','advanced'] as const) {
    const ability=createDefaultAbilityProfile(difficulty),prefs=createDefaultPreferences(ability);
    expect(ability.difficulty).toBe(difficulty);expect(ability.barre).toBe('unsupported');expect(prefs.transposition).toEqual({mode:'preserve',semitones:0});
  }
});

test('eight-bar musical study retains all triplets, tiny tuplets, cross-bar sustains, silence and final attack at capo 0 and 2',async()=>{
  const {source,request}=eightBarStudy();
  const planned=await deterministicPlanner.plan(source,request);
  expect(planned.provenance.mode).toBe('deterministic-fallback');
  expect(planned.provenance).toHaveProperty('label','deterministic fallback');
  const scores=[];
  for (const capo of [0,2]) {
    request.preferences.capo={mode:'chosen',value:capo};
    const s=candidate(guitarEngine.arrange(source,request,planned.plan,planned.provenance));scores.push(s);
    expect(guitarValidator.validate(source,s,{approvedRevisions:[]}).status).toBe('passed');
    expect(s.occurrences.map((o)=>o.writtenBarId)).toEqual(['b1','b2','b3','b4','b3','b4','b5','b6','b7','b8']);
    expect(s.notation.some((n)=>n.duration.n===1&&n.duration.d===6)).toBe(true);
    const cross=s.sounds.find((s)=>s.provenance.kind==='source'&&s.provenance.eventIds[0]==='cross')!;
    expect(cross.duration).toEqual(q(3,2));
    expect(s.performedSounds.find((p)=>p.soundId===cross.id)?.occurrenceIds).toHaveLength(2);
    expect(s.changes.some((c)=>c.kind==='bass-register')).toBe(true);
    expect(s.changes.some((c)=>c.kind==='omission'&&c.role==='bass'&&c.sourceEventIds.includes('bass-4'))).toBe(true);
    expect(s.sounds.filter((s)=>s.role==='melody')).toHaveLength(23);
    expect(melody(s).at(-1)).toEqual({pitch:59,start:q(39),duration:q(1)});
  }
  expect(melody(scores[0]!)).toEqual(melody(scores[1]!));
});

test('sequence search revisits equivalent melody fingering to fit source bass, rather than greedily freezing cheapest melody',()=>{
  const {source,request,plan}=oneBarStudy([['mel',0,0,4,52],['bass',1,1,2,38]]);
  request.ability.maxStoppedFretSpan=1;
  const s=candidate(guitarEngine.arrange(source,request,plan,literalPlanner));
  const bass=s.sounds.find((s)=>s.role==='bass')!;expect(bass.soundingMidi).toBe(50);
  expect(s.placements.find((p)=>p.soundId===bass.id)?.stringIndex).toBe(2);
  expect(s.placements.find((p)=>p.soundId===s.sounds.find((s)=>s.role==='melody')!.id)?.stringIndex).not.toBe(2);
  expect(guitarValidator.validate(source,s,{approvedRevisions:[]}).status).toBe('passed');
});

test('impossible source bass is visibly omitted, not forced above a low melody or silently edited',()=>{
  const {source,request,plan}=oneBarStudy([['mel',0,0,4,42],['bass',1,0,4,35]]);
  const s=candidate(guitarEngine.arrange(source,request,plan,literalPlanner));
  expect(s.sounds.filter((s)=>s.role==='bass')).toHaveLength(0);
  expect(s.changes).toEqual([expect.objectContaining({kind:'omission',role:'bass',sourceEventIds:['bass'],after:null})]);
});

test('incomplete selection, invalid plan, bounded exhaustion and exhaustive empty pitch domain have different results',()=>{
  const {source,request,plan}=oneBarStudy([['mel',0,0,4,64],['bass',1,0,4,28]]);
  const incomplete=structuredClone(request);incomplete.selection.sections[0]!.end=q(2);
  expect(guitarEngine.arrange(source,incomplete,plan,literalPlanner).status).toBe('selection-needed');
  const budget=structuredClone(request);budget.budget.maxStates=1;
  expect(guitarEngine.arrange(source,budget,plan,literalPlanner).status).toBe('search-exhausted');
  const bad=structuredClone(plan);bad.candidates[0]!.sourceEventIds=['invented'];
  expect(guitarEngine.arrange(source,request,bad,literalPlanner).status).toBe('invalid-input');
  const low=oneBarStudy([['unreachable',0,0,4,39]]);
  expect(guitarEngine.arrange(low.source,low.request,low.plan,literalPlanner).status).toBe('proven-unsatisfiable');
  low.request.budget.maxStates=5;
  expect(guitarEngine.arrange(low.source,low.request,low.plan,literalPlanner).status).toBe('search-exhausted');
});

test('complete unapproved selection generates deterministic draft; explicit transposition remains separate from capo',async()=>{
  const {source,request,plan}=oneBarStudy([['mel',0,0,4,64],['bass',1,0,4,28]]);
  request.preferences.capo={mode:'recommend',compare:[0,2]};
  const a=guitarEngine.arrange(source,request,plan,literalPlanner),b=guitarEngine.arrange(source,request,plan,literalPlanner);
  expect(a).toEqual(b);
  const s=candidate(a);expect(s.approvals.stage).toBe('sourceReady');expect(s.musicalReview.status).toBe('pending');expect(s.capoComparison.alternatives.map((a)=>a.outcome)).toEqual(['candidate','candidate']);
  request.preferences.transposition={mode:'explicit',semitones:2,authorizationId:'user-choice',reason:'Original fixture intentional test'};
  const t=candidate(guitarEngine.arrange(source,request,plan,literalPlanner));expect(t.sounds.find((s)=>s.role==='melody')!.soundingMidi).toBe(66);expect(t.changes.some((c)=>c.kind==='explicit-transposition')).toBe(true);
  expect(guitarValidator.validate(source,t,{approvedRevisions:[]}).status).toBe('passed');
});

test('approved bass cannot be sacrificed for new harmony; locks require authoritative context during external validation',()=>{
  const {source,request,plan}=oneBarStudy([['mel',0,0,4,64],['bass',1,0,4,28],['harmony',2,0,2,59]]);
  request.ability.maxSoundingNotes=2;
  const bassOnly=structuredClone(plan);bassOnly.candidates=bassOnly.candidates.filter((c)=>c.role==='bass');
  const approved=candidate(guitarEngine.arrange(source,request,bassOnly,literalPlanner));
  const ref={id:approved.revision.id,digest:approved.revision.digest};
  request.locks=[{role:'bass',approvedFrom:ref,scopeDigest:scopeDigest(approved,'bass'),sounds:approved.sounds.filter((s)=>s.role==='bass'),rests:[]}];
  const s=candidate(guitarEngine.arrange(source,request,plan,literalPlanner));
  expect(s.sounds.filter((s)=>s.role==='bass')).toEqual(approved.sounds.filter((s)=>s.role==='bass'));
  expect(s.sounds.filter((s)=>s.role==='harmony')).toHaveLength(0);
  expect(guitarValidator.validate(source,s,{approvedRevisions:[]}).status).toBe('failed');
  expect(guitarValidator.validate(source,s,{approvedRevisions:[approved]}).status).toBe('passed');
});

test('a capo edit cannot silently relocate an approved low-E bass to fit the new instrument',()=>{
  const {source,request,plan}=oneBarStudy([['mel',0,0,4,52],['bass',1,0,4,28]]);
  const approved=candidate(guitarEngine.arrange(source,request,plan,literalPlanner));
  request.locks=[{role:'bass',approvedFrom:{id:approved.revision.id,digest:approved.revision.digest},scopeDigest:scopeDigest(approved,'bass'),sounds:approved.sounds.filter((s)=>s.role==='bass'),rests:[]}];
  request.preferences.capo={mode:'chosen',value:2};
  expect(guitarEngine.arrange(source,request,plan,literalPlanner).status).toBe('reapproval-needed');
});

test('protected source effects and jump ties are unsupported, not flattened',()=>{
  const fx=oneBarStudy([['mel',0,0,4,64]]);const e=fx.source.events[0]!;
  if(e.kind==='note') e.effects=[{code:'bend',description:'Melody-affecting bend',affectsMelody:true}];
  fx.source.revision.digest=documentDigest(fx.source);fx.request.sourceRevision.digest=fx.source.revision.digest;fx.request.selection.sourceRevision.digest=fx.source.revision.digest;
  expect(guitarEngine.arrange(fx.source,fx.request,fx.plan,literalPlanner).status).toBe('unsupported');
});

test('cross-bar 9/4 sustain exactly tiles 5/4 + 1 without introducing unrelated tuplet primes (live regression)',()=>{
  const {source}=eightBarStudy();
  const sound:ScoreV1['sounds'][number]={id:'dyadic-tie',role:'melody',voiceId:'melody',start:q(11,4),duration:q(9,4),soundingMidi:64,spelling:{step:'E',alter:0,octave:4},provenance:{kind:'source',eventIds:['original-regression']}};
  const notation=makeNotation([sound],source.bars)!;
  expect(notation.map((n)=>n.duration)).toEqual([q(1),q(1,4),q(1)]);
  expect(notation.map((n)=>n.tie)).toEqual(['start','continue','end']);
  expect(notation.every((n)=>n.tuplet===null)).toBe(true);
});

test('a 15/16-quarter duration is spelled with at most two dots, which the alphaTab engraver supports (live regression)',()=>{
  const {source}=eightBarStudy();
  const sound:ScoreV1['sounds'][number]={id:'triple-dot',role:'bass',voiceId:'bass',start:q(0),duration:q(15,16),soundingMidi:40,spelling:{step:'E',alter:0,octave:2},provenance:{kind:'source',eventIds:['original-regression']}};
  const notation=makeNotation([sound],source.bars)!;
  expect(notation.every((n)=>n.dots<=2)).toBe(true);
  expect(notation.map((n)=>n.duration)).toEqual([q(7,8),q(1,16)]);
  expect(notation.map((n)=>n.tie)).toEqual(['start','end']);
});

test('specified hand movement cannot be bypassed by assigning a fresh finger; uncalibrated draft remains available',()=>{
  const {source,request,plan}=oneBarStudy([['low',0,0,1,65],['high',0,1,3,76]]);
  const uncalibrated=candidate(guitarEngine.arrange(source,request,plan,literalPlanner));
  const mutated=structuredClone(uncalibrated);
  mutated.ability.transition={status:'specified',maxPhysicalFretsPerSecond:1,minFingerReassignmentMs:0,evidence:'Deliberately slow calibrated test control'};
  // Explicitly assign a previously unused finger so the hand-speed check, not
  // held-finger reuse, must catch the eleven-fret movement at 80 BPM.
  mutated.placements.find((p)=>p.soundId===mutated.sounds[1]!.id)!.finger=2;
  mutated.revision.digest=documentDigest(mutated);
  expect(guitarValidator.validate(source,mutated,{approvedRevisions:[]}).diagnostics.map((d)=>d.message).some((m)=>m.includes('Hand-position movement'))).toBe(true);
  request.ability.transition=mutated.ability.transition;
  expect(guitarEngine.arrange(source,request,plan,literalPlanner).status).toBe('search-exhausted');
});

test('specified transitions unfold and re-finger the performed sequence, including repeat boundaries',()=>{
  const {source,request,plan}=oneBarStudy([['mel',0,0,4,65],['bass',1,0,4,40]]);
  source.form.repeats=[{id:'repeat',fromBarId:'b1',toBarId:'b1',totalPasses:2}];
  source.revision.digest=documentDigest(source);request.sourceRevision.digest=source.revision.digest;request.selection.sourceRevision.digest=source.revision.digest;
  request.ability.transition={status:'specified',maxPhysicalFretsPerSecond:10,minFingerReassignmentMs:0,evidence:'Original technical test limits'};
  const s=candidate(guitarEngine.arrange(source,request,plan,literalPlanner));
  expect(s.occurrences).toHaveLength(2);
  expect(s.performedSounds).toHaveLength(4);
  expect(guitarValidator.validate(source,s,{approvedRevisions:[]}).status).toBe('passed');
  expect(s.performedSounds[0]!.placementId).not.toBe(s.performedSounds[2]!.placementId);
});

import { compare, eventEnd, q } from '../../src/domain';
import type { ScoreV1 } from '../../src/domain';
import { documentDigest } from '../../src/engine/identity';
import { oneBarStudy } from './studies';
import { score as originalScore } from '../fixtures/original';

/** Original one-bar study: a held F# lead, B bass and later A inner tone.
 * B2/A3/F#4 can all use relative fret 2 on distinct strings at capo 0.
 */
export function heldRegisterStudy(order:'bass-first'|'harmony-first'|'boundary'='bass-first') {
  const fixture=oneBarStudy([['lead-a',0,0,2,66],['lead-b',0,2,2,68],['foundation',1,order==='harmony-first'?1:0,order==='harmony-first'?2:order==='boundary'?1:4,35],['inner',2,order==='harmony-first'?0:1,order==='harmony-first'?4:2,69]]);
  fixture.plan.candidates.find((c)=>c.role==='harmony')!.octaveShift=-1;
  return fixture;
}

/** Original E-to-B source bass motion under a two-quarter melody rest. */
export function isolatedRegisterStudy() {
  const fixture=oneBarStudy([['lead-a',0,0,1,65],['lead-b',0,3,1,67],['root-a',1,0,1,28],['root-b',1,1,1,35]]);
  fixture.request.selection.sections[0]!.intentionalRests=[{id:'breath',start:q(1),duration:q(2),reason:'Original melody breath, not a missing selector'}];
  return fixture;
}

/** Literal crossed realization, independent of the current solver. All pitches,
 * contacts, tiling, source audits and fingering are otherwise schema/static valid.
 */
export function crossedRegisterScore(order:'bass-first'|'harmony-first'|'boundary'='bass-first'): {source:ReturnType<typeof heldRegisterStudy>['source'];score:ScoreV1} {
  const {source,request,plan}=heldRegisterStudy(order);
  const score=structuredClone(originalScore);
  score.source={revision:request.sourceRevision,manifest:source.manifest};
  score.selection=request.selection;score.preferences=request.preferences;score.ability=request.ability;
  score.bars=source.bars;score.tempos=source.tempos;score.form=source.form;
  score.occurrences=score.occurrences.slice(0,1);score.performedTempos=score.performedTempos.slice(0,1);
  score.sounds=[
    {id:'lead-a',role:'melody',voiceId:'melody',start:q(0),duration:q(2),soundingMidi:66,spelling:{step:'F',alter:1,octave:4},provenance:{kind:'source',eventIds:['lead-a']}},
    {id:'lead-b',role:'melody',voiceId:'melody',start:q(2),duration:q(2),soundingMidi:68,spelling:{step:'A',alter:-1,octave:4},provenance:{kind:'source',eventIds:['lead-b']}},
    {id:'foundation',role:'bass',voiceId:'bass',start:q(0),duration:q(4),soundingMidi:59,spelling:{step:'B',alter:0,octave:3},provenance:{kind:'generated',strategyVersion:'literal-crossing-study',evidenceEventIds:['foundation'],reason:'Deliberate negative control: B3 above held A3'}},
    {id:'inner',role:'harmony',voiceId:'harmony',start:q(1),duration:q(2),soundingMidi:57,spelling:{step:'A',alter:0,octave:3},provenance:{kind:'generated',strategyVersion:'literal-crossing-study',evidenceEventIds:['inner'],reason:'Original inner-register source pitch class'}},
  ];
  score.rests=[];
  for(const s of score.sounds) {const e=source.events.find((e)=>e.id===s.id)!;s.start=e.start;s.duration=e.duration;}
  score.notation=score.sounds.map((s,i)=>({id:`n${i}`,eventId:s.id,kind:'note',barId:'b1',voiceId:s.voiceId,start:s.start,duration:s.duration,baseDenominator:s.duration.n===4?1:s.duration.n===2?2:4,dots:0,tuplet:null,tie:'none'}));
  score.placements=[{id:'pl-a',soundId:'lead-a',stringIndex:5,fret:2,finger:1},{id:'pl-b',soundId:'lead-b',stringIndex:5,fret:4,finger:1},{id:'pl-bass',soundId:'foundation',stringIndex:4,fret:0,finger:0},{id:'pl-inner',soundId:'inner',stringIndex:3,fret:2,finger:2}];
  score.performedSounds=score.sounds.map((s,i)=>({id:`${s.id}@o1`,soundId:s.id,attackOccurrenceId:'o1',occurrenceIds:['o1'],start:s.start,duration:s.duration,placementId:score.placements[i]!.id}));
  score.contacts=[
    {id:'c-a',performedSoundId:'lead-a@o1',soundId:'lead-a',placementId:'pl-a',start:q(0),release:q(2)},
    {id:'c-b',performedSoundId:'lead-b@o1',soundId:'lead-b',placementId:'pl-b',start:q(2),release:q(4)},
    {id:'c-bass',performedSoundId:'foundation@o1',soundId:'foundation',placementId:'pl-bass',start:q(0),release:q(4)},
    {id:'c-inner',performedSoundId:'inner@o1',soundId:'inner',placementId:'pl-inner',start:q(1),release:q(3)},
  ];
  for(const c of score.contacts) {const s=score.sounds.find((s)=>s.id===c.soundId)!;c.start=s.start;c.release=eventEnd(s);}
  const boundaries=[...new Map(score.contacts.flatMap((c)=>[c.start,c.release]).map((t)=>[`${t.n}/${t.d}`,t])).values()].sort(compare);
  score.handStates=boundaries.map((at)=>{const active=score.contacts.filter((c)=>compare(c.start,at)<=0&&compare(c.release,at)>0),frets=active.map((c)=>score.placements.find((p)=>p.id===c.placementId)!).filter((p)=>p.fret>0).map((p)=>p.fret);return {at,activeContactIds:active.map((c)=>c.id),position:frets.length?{kind:'fretting',anchorPhysicalFret:Math.min(...frets)}:{kind:'released'}};});
  score.plan=plan;
  score.changes=[{id:'bass-register',kind:'bass-register',role:'bass',sourceEventIds:['foundation'],soundIds:['foundation'],before:{soundingMidi:35,duration:q(4)},after:{soundingMidi:59,duration:q(4)},reason:'Literal upward register mutation'}, {id:'inner-register',kind:'bass-register',role:'harmony',sourceEventIds:['inner'],soundIds:['inner'],before:{soundingMidi:69,duration:q(2)},after:{soundingMidi:57,duration:q(2)},reason:'Literal inner register'}];
  for(const change of score.changes) {const s=score.sounds.find((s)=>s.id===change.soundIds[0])!;change.before.duration=s.duration;change.after!.duration=s.duration;}
  score.chords=[];
  score.revision.digest=documentDigest(score);
  return {source,score};
}

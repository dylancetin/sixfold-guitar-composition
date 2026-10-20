import { compare, eventEnd } from '../domain';
import type { AbilityProfile, Instrument, PerformedTempo, Placement, Q, Sound } from '../domain';
import { secondsBetween } from './form';
import { roleOrderConflict } from './roles';

export type BassReference={sourceMidi:number;preferredMidi:number;line:string};
export type SearchItem={id:string;start:Q;role:Sound['role'];required:boolean;variants:Sound[];bassReference?:BassReference};
export type Budget={used:number;limit:number;pruned:boolean};
type Held={sound:Sound;placement:Placement};
type History={fret:number;stringIndex:number;release:Q};
export type SearchState={sounds:Sound[];placements:Placement[];held:Held[];history:Map<number,History>;bass:number;harmony:number;bassRegisterCost:number;lastBass:{sourceMidi:number;soundingMidi:number;line:string}|null;cost:number;lastFret:number;anchor:number|null;anchorAt:Q|null};
export type SearchResult={status:'found';state:SearchState}|{status:'search-exhausted';reason:string};

export function pitchPositions(pitch:number,instrument:Instrument,ability:AbilityProfile):{stringIndex:number;fret:number}[] {
  return instrument.tuning.flatMap((open,stringIndex)=>{
    const fret=pitch-open-instrument.capo;
    return fret>=0&&fret+instrument.capo<=Math.min(instrument.maxPhysicalFret,ability.maxPhysicalFret)?[{stringIndex,fret}]:[];
  });
}
// A bass foundation is not interchangeable with an upper inner/fill voice.
// Preserve bass evidence, then its source-oriented register/contour, before
// optimizing inner-tone density or cheap/open-string fingering.
const rank=(a:SearchState,b:SearchState)=>b.bass-a.bass||a.bassRegisterCost-b.bassRegisterCost||b.harmony-a.harmony||a.cost-b.cost;
export function compareSolutions(a:SearchState,b:SearchState):number { return rank(a,b); }

/** Bounded sequence beam: every branch retains entire held string/finger intervals.
 * Optional source bass/harmony participates before equivalent melody choices are frozen.
 * Finger labels are symmetry-reduced only when movement is explicitly uncalibrated.
 */
export function searchSequence(items:SearchItem[],instrument:Instrument,ability:AbilityProfile,tempos:PerformedTempo[],budget:Budget):SearchResult {
  const width=Math.max(2,Math.min(12,Math.floor((budget.limit-budget.used)/Math.max(items.length*5,1))));
  let states:SearchState[]=[{sounds:[],placements:[],held:[],history:new Map(),bass:0,harmony:0,bassRegisterCost:0,lastBass:null,cost:0,lastFret:0,anchor:null,anchorAt:null}];
  const sorted=[...items].sort((a,b)=>compare(a.start,b.start)||Number(b.required)-Number(a.required)||({melody:0,bass:1,harmony:2}[a.role]-{melody:0,bass:1,harmony:2}[b.role])||a.id.localeCompare(b.id));
  for (const item of sorted) {
    const next:SearchState[]=[];
    for (const state of states) {
      const held=state.held.filter((h)=>compare(eventEnd(h.sound),item.start)>0);
      if (!item.required) {
        if (++budget.used>budget.limit) {budget.used=budget.limit;return {status:'search-exhausted',reason:'State budget reached before a complete melody-safe sequence was established'};}
        next.push({...state,held});
      }
      for (const sound of item.variants) for (const pos of pitchPositions(sound.soundingMidi,instrument,ability)) {
        if (held.some((h)=>h.placement.stringIndex===pos.stringIndex)) continue;
        const available=[1,2,3,4].filter((f)=>!held.some((h)=>h.placement.finger===f));
        const fingers=pos.fret===0?[0]:ability.transition.status==='uncalibrated'?available.slice(0,1):available;
        for (const finger of fingers) {
          if (++budget.used>budget.limit) {budget.used=budget.limit;return {status:'search-exhausted',reason:'State budget reached; truncated beam search is not an impossibility proof'};}
          const stopped=held.filter((h)=>h.placement.fret>0).map((h)=>h.placement.fret);
          if (pos.fret>0) stopped.push(pos.fret);
          if (held.length+1>ability.maxSoundingNotes||stopped.length>ability.maxFrettedContacts||(stopped.length&&Math.max(...stopped)-Math.min(...stopped)>ability.maxStoppedFretSpan)) continue;
          const anchor=stopped.length?Math.min(...stopped)+instrument.capo:state.anchor;
          if (pos.fret>0&&anchor!==null&&state.anchor!==null&&state.anchorAt&&compare(state.anchorAt,sound.start)<0&&ability.transition.status==='specified') {
            const elapsed=secondsBetween(state.anchorAt,sound.start,tempos);
            if (Math.abs(anchor-state.anchor)>elapsed*ability.transition.maxPhysicalFretsPerSecond+1e-9) continue;
          }
          if (sound.role==='bass'&&held.some((h)=>h.sound.role==='bass')) continue;
          // Symmetric at either attack: a later bass cannot cross an already
          // ringing inner voice, and a later inner voice cannot undercut bass.
          if (held.some((h)=>roleOrderConflict(sound,h.sound))) continue;
          // Initial sparse generation uses one inner voice. Explicit locked
          // polyphonic harmony is retained, not silently simplified here.
          if (sound.role==='harmony'&&!item.required&&held.some((h)=>h.sound.role==='harmony')) continue;
          const last=state.history.get(finger);
          if (finger&&last&&ability.transition.status==='specified'&&(last.stringIndex!==pos.stringIndex||last.fret!==pos.fret)) {
            if (compare(last.release,sound.start)>0) continue;
            const seconds=secondsBetween(last.release,sound.start,tempos);
            if (seconds*1000+1e-7<ability.transition.minFingerReassignmentMs||Math.abs(last.fret-pos.fret)>seconds*ability.transition.maxPhysicalFretsPerSecond+1e-9) continue;
          }
          const placement:Placement={id:`pl-${sound.id}`,soundId:sound.id,...pos,finger};
          const history=new Map(state.history);
          if (finger) history.set(finger,{...pos,release:eventEnd(sound)});
          const duration=sound.duration.n/sound.duration.d;
          const weight=1+Math.min(duration,4)/20;
          const reference=sound.role==='bass'?item.bassReference:undefined;
          const sameLine=reference&&state.lastBass?.line===reference.line;
          const registerPenalty=reference?2*Math.abs(sound.soundingMidi-reference.preferredMidi)/12:0;
          const contourPenalty=reference&&sameLine?Math.abs((sound.soundingMidi-state.lastBass!.soundingMidi)-(reference.sourceMidi-state.lastBass!.sourceMidi))/12:0;
          next.push({sounds:[...state.sounds,sound],placements:[...state.placements,placement],held:[...held,{sound,placement}],history,
            bass:state.bass+(sound.role==='bass'?weight:0),harmony:state.harmony+(sound.role==='harmony'?weight:0),
            bassRegisterCost:state.bassRegisterCost+registerPenalty+contourPenalty,lastBass:reference?{sourceMidi:reference.sourceMidi,soundingMidi:sound.soundingMidi,line:reference.line}:state.lastBass,
            cost:state.cost+(pos.fret===0?0:pos.fret*0.08+Math.abs(pos.fret-state.lastFret)*0.1),lastFret:pos.fret||state.lastFret,anchor:pos.fret>0?anchor:state.anchor,anchorAt:pos.fret>0?sound.start:state.anchorAt});
        }
      }
    }
    if (!next.length) return {status:'search-exhausted',reason:'No surviving bounded-search states; this is not an exhaustive unsatisfiability proof'};
    next.sort(rank);
    // Merge only future-equivalent held states; retain source/duration choices.
    const keys=new Set<string>();
    const distinct:SearchState[]=[];
    for (const state of next) {
      const key=state.held.map((h)=>`${h.sound.id}:${h.sound.soundingMidi}:${h.sound.duration.n}/${h.sound.duration.d}:${h.placement.stringIndex}:${h.placement.fret}:${h.placement.finger}`).sort().join('|')+`/last${state.lastFret}/bass${JSON.stringify(state.lastBass)}`+(ability.transition.status==='specified'?JSON.stringify({history:[...state.history],anchor:state.anchor,at:state.anchorAt}):'');
      if (!keys.has(key)) {keys.add(key);distinct.push(state);}
    }
    if (distinct.length>width) budget.pruned=true;
    states=distinct.slice(0,width);
  }
  states.sort(rank);
  return {status:'found',state:states[0]!};
}

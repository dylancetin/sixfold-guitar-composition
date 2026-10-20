import { add, compare, eventEnd, q } from '../domain';
import type { OptionalPlanner, Plan, SourceEvent } from '../domain';

/** Source-evidence selection only. No network and no AI provenance claim. */
export const deterministicPlanner: OptionalPlanner = {
  async plan(source,request,signal) {
    const candidates:Plan['candidates']=[];
    const provenance={mode:'deterministic-fallback',label:'deterministic fallback',plannerVersion:'source-sparse-1',reason:'not-configured',detail:'Local source-grounded sparse bass and inner-tone proposals; no configured model or network call'} as const;
    if (signal?.aborted) return {plan:{version:'source-sparse-1',candidates},provenance:{...provenance,reason:'disabled',detail:'Planning cancelled before source selection'},diagnostics:[]};
    const selected=new Set(request.selection.sections.flatMap((s)=>s.selectors.flatMap((s)=>s.eventIds)));
    const selectedParts=new Set(source.events.filter((e)=>selected.has(e.id)).map((e)=>e.partId));
    type Note=Extract<SourceEvent,{kind:'note'}>;
    const pools=source.parts.filter((p)=>!selectedParts.has(p.id)&&!/percussion|drums?/i.test(p.name)).map((part)=>{
      const notes=source.events.filter((e):e is Note=>e.kind==='note'&&e.partId===part.id&&!e.effects.some((fx)=>fx.affectsMelody));
      const sorted=notes.map((e)=>e.soundingMidi).sort((a,b)=>a-b);
      return {part,notes,median:sorted[Math.floor(sorted.length/2)]??128};
    }).filter((p)=>p.notes.length);
    const bass=[...pools].filter((p)=>p.median<55).sort((a,b)=>(Number(/bass/i.test(b.part.name))-Number(/bass/i.test(a.part.name)))||a.median-b.median||a.part.id-b.part.id)[0];
    const harmony=[...pools].filter((p)=>p!==bass).sort((a,b)=>(Number(/harpsichord|guitar|piano|keys/i.test(b.part.name))-Number(/harpsichord|guitar|piano|keys/i.test(a.part.name)))||b.notes.length-a.notes.length||a.part.id-b.part.id)[0];
    const selectedMelody=source.events.filter((e):e is Note=>e.kind==='note'&&selected.has(e.id));
    const innerRegister=(note:Note)=>{
      const melody=selectedMelody.find((m)=>compare(m.start,note.start)<=0&&compare(eventEnd(m),note.start)>0)?.soundingMidi;
      const ceiling=melody??67;
      let pitch=note.soundingMidi,shift=0;
      while ((pitch>=ceiling||pitch>62)&&shift>-3&&pitch-12>=40) {pitch-=12;shift--;}
      while (pitch<40&&shift<3) {pitch+=12;shift++;}
      return {pitch,shift,ceiling};
    };
    const innerToneCost=(note:Note)=>{
      const {pitch,ceiling}=innerRegister(note);
      // Preserve source pitch class, but propose an explicit octave relocation
      // into an inner register instead of blindly proposing the chord's top note.
      return (pitch>=ceiling?100:0)+Math.abs(pitch-Math.min(62,ceiling-5));
    };
    for (const bar of source.bars) {
      for (const [role,pool,density] of [['bass',bass,request.preferences.bassDensity],['harmony',harmony,request.preferences.harmonyDensity]] as const) {
        if (!pool||density==='none') continue;
        const notes=pool.notes.filter((e)=>compare(e.start,bar.start)>=0&&compare(e.start,add(bar.start,bar.length))<0).sort((a,b)=>compare(a.start,b.start)||(role==='bass'?a.soundingMidi-b.soundingMidi:innerToneCost(a)-innerToneCost(b))||a.id.localeCompare(b.id));
        let last= q(-1000);
        let count=0;
        for (const e of notes) {
          // Structural attacks, not all original chord members or bass doublings.
          if (count >= (density==='regular'?2:1)) break;
          if (count&&compare(e.start,add(last,q(2)))<0) continue;
          candidates.push({id:`p${candidates.length+1}`,role,sourceEventIds:[e.id],octaveShift:role==='harmony'?innerRegister(e).shift:0,density:density==='regular'?'regular':'sparse',reason:`Sparse ${role} from part ${pool.part.id} (${pool.part.name}), source attack ${e.id}; source pitch class retained, register proposal subject to guitar feasibility`});
          last=e.start;count++;
        }
      }
    }
    return {plan:{version:'source-sparse-1',candidates},provenance,diagnostics:[]};
  },
};

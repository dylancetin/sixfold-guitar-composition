import { add, compare, eventEnd, overlaps, q } from '../domain';
import type { ArrangementRequest, Diagnostic, Rest, Sound, SourceEvent, SourceScoreV1 } from '../domain';
import { diagnostic } from './form';
import { same } from './identity';

export function spell(midi: number): Sound['spelling'] {
  const names = [['C',0],['C',1],['D',0],['E',-1],['E',0],['F',0],['F',1],['G',0],['A',-1],['A',0],['B',-1],['B',0]] as const;
  const [step,alter]=names[((midi%12)+12)%12]!;
  return { step,alter,octave:Math.floor(midi/12)-1 };
}

export type Selected = { status:'selected'; sounds:Sound[]; rests:Rest[]; events:SourceEvent[] } | { status:'selection-needed'|'unsupported'; diagnostics:Diagnostic[] };
export function selectMelody(source:SourceScoreV1,request:ArrangementRequest):Selected {
  const errors:Diagnostic[]=[];
  const selected=new Map<string,SourceEvent>();
  const rests:Rest[]=[];
  let cursor=q(0);
  const end=add(source.bars.at(-1)!.start,source.bars.at(-1)!.length);
  for (const section of request.selection.sections) {
    if (!same(section.start,cursor)||compare(section.end,end)>0) errors.push(diagnostic('selection-needed','Sections must cover the full written score without gaps/overlap'));
    cursor=section.end;
    const intervals:{start:typeof cursor;end:typeof cursor}[]=[];
    const ids=new Set<string>();
    for (const selector of section.selectors) for (const id of selector.eventIds) {
      const e=source.events.find((e)=>e.id===id);
      if (!e||e.partId!==selector.partId||e.voiceId!==selector.voiceId||ids.has(id)||!overlaps(e.start,eventEnd(e),section.start,section.end)) {errors.push(diagnostic('selection-needed','Invalid/duplicate source event, selector, or section overlap',[id]));continue;}
      ids.add(id);selected.set(id,e);
      intervals.push({start:compare(e.start,section.start)<0?section.start:e.start,end:compare(eventEnd(e),section.end)>0?section.end:eventEnd(e)});
    }
    for (const r of section.intentionalRests) {
      if (compare(r.start,section.start)<0||compare(eventEnd(r),section.end)>0||rests.some((a)=>a.provenance.kind==='intentional'&&a.provenance.selectionRestId===r.id)) errors.push(diagnostic('selection-needed','Intentional rest outside section or duplicate ID',[r.id]));
      intervals.push({start:r.start,end:eventEnd(r)});
      rests.push({id:`ir${rests.length+1}`,role:'melody',voiceId:'melody',start:r.start,duration:r.duration,provenance:{kind:'intentional',selectionRestId:r.id}});
    }
    let at=section.start;
    for (const interval of intervals.sort((a,b)=>compare(a.start,b.start))) {if (!same(at,interval.start)) errors.push(diagnostic('selection-needed','Incomplete selection or unresolved polyphony'));at=interval.end;}
    if (!same(at,section.end)) errors.push(diagnostic('selection-needed','Uncovered selected melody interval'));
  }
  if (!same(cursor,end)) errors.push(diagnostic('selection-needed','Selection stops before complete source form'));
  for (const e of selected.values()) for (const section of request.selection.sections) if (overlaps(e.start,eventEnd(e),section.start,section.end)&&!section.selectors.some((s)=>s.eventIds.includes(e.id))) errors.push(diagnostic('selection-needed','Cross-section merged event must be selected whole on both sides',[e.id]));
  if (errors.length) return {status:'selection-needed',diagnostics:errors};
  const sounds:Sound[]=[];
  for (const e of [...selected.values()].sort((a,b)=>compare(a.start,b.start)||a.id.localeCompare(b.id))) {
    if (e.kind==='rest') rests.push({id:`mr${rests.length+1}`,role:'melody',voiceId:'melody',start:e.start,duration:e.duration,provenance:{kind:'source',eventIds:[e.id]}});
    else {
      if (e.effects.some((fx)=>fx.affectsMelody)) return {status:'unsupported',diagnostics:[diagnostic('unsupported-construct','Selected melody effect cannot be flattened',[e.id])]};
      const midi=e.soundingMidi+request.preferences.transposition.semitones;
      if (midi<0||midi>127) return {status:'unsupported',diagnostics:[diagnostic('unsupported-construct','Explicit transposition leaves MIDI range',[e.id])]};
      sounds.push({id:`m${sounds.length+1}`,role:'melody',voiceId:'melody',start:e.start,duration:e.duration,soundingMidi:midi,spelling:request.preferences.transposition.semitones===0?e.spelling:spell(midi),provenance:{kind:'source',eventIds:[e.id]}});
    }
  }
  return {status:'selected',sounds,rests,events:[...selected.values()]};
}

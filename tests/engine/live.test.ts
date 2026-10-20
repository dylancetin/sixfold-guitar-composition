import { expect, test } from 'bun:test';
import { add, compare, eventEnd, MelodySelectionSchema, q, SourceScoreV1Schema, subtract } from '../../src/domain';
import type { ScoreV1 } from '../../src/domain';
import { createDefaultRequest, deterministicPlanner, guitarEngine, guitarValidator } from '../../src/engine';
import { documentDigest } from '../../src/engine/identity';
import { requestedSongFacts } from '../fixtures/literal-oracles';

const sourcePath=process.env.ENGINE_LIVE_SOURCE;
const selectionPath=process.env.ENGINE_LIVE_SELECTION;

test.skipIf(!sourcePath||!selectionPath)('optional actual s692866: literal 64-occurrence source oracle, both capos, and independent negative mutations',async()=>{
  const source=SourceScoreV1Schema.parse(await Bun.file(sourcePath!).json());
  const proposal=await Bun.file(selectionPath!).json();
  const selection=MelodySelectionSchema.parse(proposal.selection??proposal);
  expect(source.manifest.identity).toMatchObject({kind:'songsterr',songId:692866});
  expect(source.bars).toHaveLength(46);expect(source.parts).toHaveLength(11);
  const selected=new Set(selection.sections.flatMap((s)=>s.selectors.flatMap((s)=>s.eventIds)));
  const selectedNotes=source.events.filter((e)=>e.kind==='note'&&selected.has(e.id));
  expect(selectedNotes.filter((e)=>e.partId===0)).toHaveLength(141);
  expect(selectedNotes.filter((e)=>e.partId===0).flatMap((e)=>e.refs)).toHaveLength(154);
  // Literal bar-5 control is external to the arranger and canonical importer.
  expect(selectedNotes.filter((e)=>e.partId===0&&compare(e.start,q(16))>=0&&compare(e.start,q(20))<0).map((e)=>e.kind==='note'?e.soundingMidi:0)).toEqual([54,59,61,63,64,63]);
  const request=createDefaultRequest(source,selection);
  const planned=await deterministicPlanner.plan(source,request);
  const expected:{sourceId:string;pitch:number;start:ReturnType<typeof q>;end:ReturnType<typeof q>}[]=[];
  for (const [i,number] of requestedSongFacts.occurrenceWrittenBars.entries()) {
    const bar=source.bars.find((b)=>b.number===number)!;
    for (const note of selectedNotes) if (note.kind==='note'&&compare(note.start,bar.start)>=0&&compare(note.start,add(bar.start,bar.length))<0) {
      const start=add(q(i*4),subtract(note.start,bar.start));
      expected.push({sourceId:note.id,pitch:note.soundingMidi,start,end:add(start,note.duration)});
    }
  }
  const sort=(a:typeof expected[number],b:typeof expected[number])=>compare(a.start,b.start)||a.sourceId.localeCompare(b.sourceId);
  expected.sort(sort);
  const scores:ScoreV1[]=[];
  for (const capo of [0,2]) {
    request.preferences.capo={mode:'chosen',value:capo};
    const result=guitarEngine.arrange(source,request,planned.plan,planned.provenance);
    if (result.status!=='candidate') throw new Error(JSON.stringify(result));
    const score=result.score;scores.push(score);
    expect(score.occurrences.map((o)=>source.bars.find((b)=>b.id===o.writtenBarId)!.number)).toEqual(requestedSongFacts.occurrenceWrittenBars);
    const actual=score.performedSounds.flatMap((ps)=>{
      const s=score.sounds.find((s)=>s.id===ps.soundId)!;
      if(s.role!=='melody') return [];
      return [{sourceId:s.provenance.kind==='source'?s.provenance.eventIds[0]!:'INVALID GENERATED MELODY',pitch:s.soundingMidi,start:ps.start,end:eventEnd(ps)}];
    }).sort(sort);
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(245);
    expect(guitarValidator.validate(source,score,{approvedRevisions:[]}).status).toBe('passed');
    const removed=structuredClone(score);removed.sounds=removed.sounds.filter((s)=>s.id!==score.sounds.filter((s)=>s.role==='melody').at(-1)!.id);removed.revision.digest=documentDigest(removed);
    expect(guitarValidator.validate(source,removed,{approvedRevisions:[]}).diagnostics.map((d)=>d.code)).toContain('melody-mismatch');
    const flat=structuredClone(score);flat.occurrences=flat.occurrences.slice(0,46);flat.revision.digest=documentDigest(flat);
    expect(guitarValidator.validate(source,flat,{approvedRevisions:[]}).diagnostics.map((d)=>d.code)).toContain('form-mismatch');
    const omission=structuredClone(score);omission.changes=omission.changes.filter((c)=>c.kind!=='omission');omission.revision.digest=documentDigest(omission);
    expect(guitarValidator.validate(source,omission,{approvedRevisions:[]}).diagnostics.map((d)=>d.code)).toContain('source-mismatch');
  }
  expect(scores.map((s)=>s.instrument.capo)).toEqual([0,2]);
},30000);

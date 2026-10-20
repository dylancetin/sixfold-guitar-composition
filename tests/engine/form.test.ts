import { expect, test } from 'bun:test';
import { exactTicks, q } from '../../src/domain';
import type { Form, WrittenBar } from '../../src/domain';
import { expandForm, secondsBetween } from '../../src/engine/form';
import { requestedSongFacts, restoreTempoExample } from '../fixtures/literal-oracles';
import { source } from '../fixtures/original';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { documentDigest } from '../../src/engine/identity';
import { literalPlanner, oneBarStudy } from './studies';

const bars = (count: number): WrittenBar[] => Array.from({ length: count }, (_, i) => ({ id: `b${i + 1}`, number: i + 1, start: q(i * 4), length: q(4), meter: { beats: 4, beatUnit: 4 }, kind: 'full' }));
const form: Form = { kind: 'linear-repeats', repeats: [], tempoPolicy: 'restore-written-position', jumpTiePolicy: 'reject-cross-jump' };

test('literal requested-song form: all 64 occurrences, 256 quarters, final four passes', () => {
  const result = expandForm({ bars: bars(46), form: { ...form, repeats: [
    { id: 'r1', fromBarId: 'b5', toBarId: 'b7', totalPasses: 2 },
    { id: 'r2', fromBarId: 'b17', toBarId: 'b19', totalPasses: 2 },
    { id: 'r3', fromBarId: 'b43', toBarId: 'b46', totalPasses: 4 },
  ] }, tempos: requestedSongFacts.writtenTempoPoints.map(({ bar, bpm }) => ({ id: `t${bar}`, barId: `b${bar}`, offset: q(0), quarterBpm: bpm })) });
  expect(result.status).toBe('expanded');
  if (result.status !== 'expanded') return;
  expect(result.occurrences.map((o) => Number(o.writtenBarId.slice(1)))).toEqual(requestedSongFacts.occurrenceWrittenBars);
  expect(result.length).toEqual(q(256));
  expect(result.occurrences.at(-1)?.pass).toBe(4);
  expect(secondsBetween(q(0), result.length, result.performedTempos)).toBeCloseTo(172.405680, 5);
});

test('inherited 80→120 repeat restores 80 at tick 11520: 13s, not 12s', () => {
  const result = expandForm({ bars: bars(3), form: { ...form, repeats: [{ id: 'r', fromBarId: 'b2', toBarId: 'b3', totalPasses: 2 }] }, tempos: [
    { id: 't80', barId: 'b1', offset: q(0), quarterBpm: 80 }, { id: 't120', barId: 'b3', offset: q(0), quarterBpm: 120 },
  ] });
  expect(result.status).toBe('expanded');
  if (result.status !== 'expanded') return;
  expect(result.occurrences.map((o) => o.entryQuarterBpm)).toEqual(restoreTempoExample.correctEntryBpm);
  expect(result.performedTempos).toHaveLength(5);
  expect(exactTicks(result.performedTempos[3]!.start, 960)).toBe(11520);
  expect(secondsBetween(q(0), result.length, result.performedTempos)).toBe(13);
});

test('ordinary cross-bar tie supported; repeated orphan continuation rejected', () => {
  expect(expandForm(source).status).toBe('expanded');
  expect(expandForm({ ...source, form: { ...form, repeats: [{ id: 'r', fromBarId: 'b2', toBarId: 'b2', totalPasses: 2 }] } }).status).toBe('unsupported');
});

test('overlap/nesting and missing tempo are not silently flattened', () => {
  const input = { bars: bars(3), tempos: source.tempos, form: { ...form, repeats: [
    { id: 'a', fromBarId: 'b1', toBarId: 'b3', totalPasses: 2 }, { id: 'b', fromBarId: 'b2', toBarId: 'b3', totalPasses: 2 },
  ] } };
  expect(expandForm(input).status).toBe('unsupported');
  expect(expandForm({ ...input, tempos: [], form }).status).toBe('invalid-input');
});

test('production validator independently rejects carried repeat-end tempo in the 13-second control',()=>{
  const fixture=oneBarStudy([['first',0,0,4,65],['repeat-entry',0,4,4,64],['repeat-end',0,8,4,67]]);
  fixture.source.bars=bars(3);
  fixture.source.form={...form,repeats:[{id:'r',fromBarId:'b2',toBarId:'b3',totalPasses:2}]};
  fixture.source.tempos=[{id:'t80',barId:'b1',offset:q(0),quarterBpm:80},{id:'t120',barId:'b3',offset:q(0),quarterBpm:120}];
  fixture.source.revision.digest=documentDigest(fixture.source);
  fixture.request.sourceRevision.digest=fixture.source.revision.digest;
  fixture.request.selection.sourceRevision.digest=fixture.source.revision.digest;
  fixture.request.selection.sections[0]!.end=q(12);
  const result=guitarEngine.arrange(fixture.source,fixture.request,fixture.plan,literalPlanner);
  if(result.status!=='candidate') throw new Error(JSON.stringify(result));
  expect(guitarValidator.validate(fixture.source,result.score,{approvedRevisions:[]}).status).toBe('passed');
  expect(secondsBetween(q(0),q(20),result.score.performedTempos)).toBe(13);
  result.score.performedTempos[3]!.quarterBpm=120;
  result.score.occurrences[3]!.entryQuarterBpm=120;
  result.score.revision.digest=documentDigest(result.score);
  const report=guitarValidator.validate(fixture.source,result.score,{approvedRevisions:[]});
  expect(report.status).toBe('failed');
  expect(report.diagnostics.map((d)=>d.code)).toContain('tempo-mismatch');
});

test('merged silence across a repeat entry is not an orphan held attack',()=>{
  const silent=source.events.find((e)=>e.kind==='rest')!;
  const input={bars:bars(3),tempos:source.tempos,form:{...form,repeats:[{id:'r',fromBarId:'b2',toBarId:'b3',totalPasses:2}]},events:[{...silent,start:q(1),duration:q(8)}]};
  expect(expandForm(input).status).toBe('expanded');
  expect(expandForm({...input,events:[{...input.events[0]!,kind:'note'}]}).status).toBe('unsupported');
});

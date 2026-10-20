import { expect, test } from 'bun:test';
import { exactTicks, q } from '../../src/domain';
import type { Form, WrittenBar } from '../../src/domain';
import { expandForm, secondsBetween } from '../../src/engine/form';
import { requestedSongFacts, restoreTempoExample } from '../fixtures/literal-oracles';
import { source } from '../fixtures/original';

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

import { expect, test } from 'bun:test';
import { createDefaultRequest } from '../../src/engine';
import { source, score } from '../fixtures/original';

test('large-source elapsed budget scales within a fixed ceiling without changing musical preferences or state limit', () => {
  const small = createDefaultRequest(source, score.selection, 'intermediate');
  expect(small.budget).toEqual({ maxStates: 10000, maxElapsedMs: 5000 });
  const orchestral = { ...source, events: Array.from({ length: 6392 }, () => source.events[0]!) };
  const larger = createDefaultRequest(orchestral, score.selection, 'intermediate');
  expect(larger.budget).toEqual({ maxStates: 10000, maxElapsedMs: 25568 });
  expect(larger.preferences).toEqual(small.preferences);
  expect(larger.ability).toEqual(small.ability);
  expect(createDefaultRequest({ ...source, events: Array.from({ length: 100000 }, () => source.events[0]!) }, score.selection).budget.maxElapsedMs).toBe(30000);
});

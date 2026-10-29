import { expect, test } from 'bun:test';
import { q } from '../../src/domain';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { literalPlanner, oneBarStudy } from './studies';

test('a continuous source bass is preferred to four equal-coverage punches', () => {
  const { source, request, plan } = oneBarStudy([
    ['melody', 0, 0, 4, 64],
    ['held-root', 1, 0, 4, 40],
    ['punch-1', 1, 0, 1, 40], ['punch-2', 1, 1, 1, 40],
    ['punch-3', 1, 2, 1, 40], ['punch-4', 1, 3, 1, 40],
  ]);
  const result = guitarEngine.arrange(source, request, plan, literalPlanner);
  if (result.status !== 'candidate') throw new Error(JSON.stringify(result));
  const bass = result.score.sounds.filter(s => s.role === 'bass');
  expect(bass).toHaveLength(1);
  expect(bass[0]!.duration).toEqual(q(4));
  expect(bass[0]!.provenance).toEqual({ kind: 'source', eventIds: ['held-root'] });
  expect(guitarValidator.validate(source, result.score, { approvedRevisions: [] }).status).toBe('passed');
});

test('capo and hand positions prefer an open-string bass held under the moving melody', () => {
  const { source, request, plan } = oneBarStudy([
    ['melody-a', 0, 0, 1, 66], ['melody-b', 0, 1, 3, 68], ['bass', 1, 0, 4, 42],
  ]);
  request.ability.maxStoppedFretSpan = 1;
  request.maxPhysicalFret = 4;
  request.preferences.capo = { mode: 'recommend', compare: [0, 2] };
  const result = guitarEngine.arrange(source, request, plan, literalPlanner);
  if (result.status !== 'candidate') throw new Error(JSON.stringify(result));
  expect(result.score.instrument.capo).toBe(2);
  const bass = result.score.sounds.find(s => s.role === 'bass')!;
  expect(bass.duration).toEqual(q(4));
  expect(result.score.placements.find(p => p.soundId === bass.id)).toMatchObject({ stringIndex: 0, fret: 0, finger: 0 });
  expect(result.score.sounds.filter(s => s.role === 'melody').map(s => [s.soundingMidi, s.start, s.duration])).toEqual([
    [66, q(0), q(1)], [68, q(1), q(3)],
  ]);
  expect(result.score.capoComparison.alternatives.every(a => a.outcome === 'candidate')).toBe(true);
  expect(guitarValidator.validate(source, result.score, { approvedRevisions: [] }).status).toBe('passed');
});

test('sustain preference respects source releases and never fills an intentional bass gap', () => {
  const { source, request, plan } = oneBarStudy([
    ['melody', 0, 0, 4, 64], ['root', 1, 0, 1, 40], ['next-chord', 1, 3, 1, 45],
  ]);
  const result = guitarEngine.arrange(source, request, plan, literalPlanner);
  if (result.status !== 'candidate') throw new Error(JSON.stringify(result));
  expect(result.score.sounds.filter(s => s.role === 'bass').map(s => [s.start, s.duration])).toEqual([
    [q(0), q(1)], [q(3), q(1)],
  ]);
  expect(guitarValidator.validate(source, result.score, { approvedRevisions: [] }).status).toBe('passed');
});

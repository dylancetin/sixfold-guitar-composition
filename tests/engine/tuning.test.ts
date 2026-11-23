import { expect, test } from 'bun:test';
import { ArrangementRequestSchema, GUITAR_TUNINGS, guitarTuningId, InstrumentSchema, preferredTuning } from '../../src/domain';
import type { ArrangeResult, ScoreV1 } from '../../src/domain';
import { guitarEngine, guitarValidator } from '../../src/engine';
import { literalPlanner, oneBarStudy } from './studies';
import { documentDigest } from '../../src/engine/identity';

const stamped = (s: ScoreV1): ScoreV1 => { s.revision.digest = documentDigest(s); return s; };

function candidate(result: ArrangeResult): ScoreV1 {
  if (result.status !== 'candidate') throw new Error(JSON.stringify(result));
  return result.score;
}
// Original one-bar study: melody includes D2 (MIDI 38), only reachable in whole-step-down tuning.
const study = () => oneBarStudy([['m1', 0, 0, 2, 38], ['m2', 0, 2, 2, 62]]);

test('tuning table, id pairing and absent preference default to standard', () => {
  expect(guitarTuningId([40, 45, 50, 55, 59, 64])).toBe('standard');
  expect(guitarTuningId([38, 43, 48, 53, 57, 62])).toBe('whole-step-down');
  expect(guitarTuningId([38, 45, 50, 55, 59, 64])).toBeUndefined();
  const base = { stringOrder: 'low-to-high', capo: 0, maxPhysicalFret: 12, writtenOctaveOffset: 12 };
  expect(InstrumentSchema.safeParse({ ...base, id: GUITAR_TUNINGS['whole-step-down'].instrumentId, tuning: [...GUITAR_TUNINGS['whole-step-down'].midi] }).success).toBe(true);
  expect(InstrumentSchema.safeParse({ ...base, id: GUITAR_TUNINGS.standard.instrumentId, tuning: [...GUITAR_TUNINGS['whole-step-down'].midi] }).success).toBe(false);
  expect(preferredTuning(study().request.preferences)).toBe('standard');
});

test('standard tuning cannot place D2; whole-step-down places it on the open low string and validates', () => {
  const { source, request, plan } = study();
  expect(guitarEngine.arrange(source, request, plan, literalPlanner).status).toBe('proven-unsatisfiable');
  const down = ArrangementRequestSchema.parse({ ...request, preferences: { ...request.preferences, tuning: 'whole-step-down' } });
  const score = candidate(guitarEngine.arrange(source, down, plan, literalPlanner));
  expect(score.instrument.id).toBe('whole-step-down-six-string-guitar-v1');
  expect(score.instrument.tuning).toEqual([38, 43, 48, 53, 57, 62]);
  const lowSound = score.sounds.find((s) => s.soundingMidi === 38)!;
  const low = score.performedSounds.find((p) => p.soundId === lowSound.id)!;
  expect(score.placements.find((p) => p.id === low.placementId)).toMatchObject({ stringIndex: 0, fret: 0 });
  expect(guitarValidator.validate(source, score, { approvedRevisions: [] }).status).toBe('passed');
});

test('validator rejects an instrument tuning that disagrees with the requested tuning', () => {
  const { source, request, plan } = study();
  const down = ArrangementRequestSchema.parse({ ...request, preferences: { ...request.preferences, tuning: 'whole-step-down' } });
  const score = structuredClone(candidate(guitarEngine.arrange(source, down, plan, literalPlanner)));
  delete (score.preferences as { tuning?: string }).tuning;
  const report = guitarValidator.validate(source, stamped(score), { approvedRevisions: [] });
  expect(report.status).not.toBe('passed');
  expect(report.diagnostics.some((d) => d.message.includes('requested tuning preference'))).toBe(true);
});

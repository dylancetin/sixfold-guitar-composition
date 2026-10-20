import { describe, expect, test } from 'bun:test';
import {
  add, ArrangeResultSchema, canonicalJson, compare, contentDigest, DurationSchema, exactTicks,
  HeldContactSchema, multiply, NotationSegmentSchema, overlaps, PlacementSchema, PlannerProvenanceSchema,
  q, QSchema, revisionDigest, ScoreV1Schema, SourceScoreV1Schema, subtract, ExportRequestSchema, ImportResultSchema,
  TimeSchema, ValidatedScoreV1Schema, verifyRevisionDigest,
} from '../../src/domain';
import { score, source } from './original';

describe('exact rational quarter-time and JSON boundaries', () => {
  test('reduces, normalizes zero/sign, and performs exact arithmetic', () => {
    expect(q(2, 6)).toEqual({ n: 1, d: 3 });
    expect(q(0, 12)).toEqual({ n: 0, d: 1 });
    expect(q(1, -2)).toEqual({ n: -1, d: 2 });
    expect(add(q(1, 3), q(1, 6))).toEqual({ n: 1, d: 2 });
    expect(subtract(q(1), q(4, 3))).toEqual({ n: -1, d: 3 });
    expect(multiply(q(3, 2), q(2, 3))).toEqual({ n: 1, d: 1 });
    expect(compare(q(5, 3), q(7, 3))).toBe(-1);
  });
  test('BigInt intermediates do not introduce rounding; unsafe results fail', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(multiply(q(max, 2), q(2, max))).toEqual({ n: 1, d: 1 });
    expect(() => add(q(max), q(1))).toThrow(RangeError);
    expect(compare(q(max, 2), q(max - 1, 2))).toBe(1);
  });
  test('runtime parser rejects unreduced, noninteger, unsafe and nonpositive denominator input', () => {
    for (const value of [{ n: 2, d: 6 }, { n: 0, d: 2 }, { n: -0, d: 1 }, { n: 1, d: 0 }, { n: 1, d: -2 }, { n: 0.5, d: 1 }, { n: 2 ** 53, d: 1 }, { n: NaN, d: 1 }, { n: 1, d: 1, extra: true }]) {
      expect(QSchema.safeParse(value).success).toBe(false);
    }
    expect(DurationSchema.safeParse(q(0)).success).toBe(false);
    expect(TimeSchema.safeParse(q(-1)).success).toBe(false);
    expect(() => q(1, 0)).toThrow();
  });
  test('boundary equality is non-overlap; unsupported PPQ is rejected, never rounded', () => {
    expect(overlaps(q(0), q(1), q(1), q(2))).toBe(false);
    expect(exactTicks(q(2, 3), 960)).toBe(640);
    expect(() => exactTicks(q(1, 7), 960)).toThrow('without rounding');
    expect(() => exactTicks(q(1), 0)).toThrow();
  });
});

describe('V1 structural runtime schemas (not independent musical validation)', () => {
  test('complete original source and three-role score survive JSON round-trip', () => {
    expect(SourceScoreV1Schema.parse(JSON.parse(JSON.stringify(source)))).toEqual(source);
    expect(ScoreV1Schema.parse(JSON.parse(JSON.stringify(score)))).toEqual(score);
    expect(new Set(score.sounds.map((s) => s.role)).size).toBe(3);
    expect(score.approvals.stage).toBe('sourceReady');
  });
  test('unknown fields/version and missing finger/held-state data are not accepted', () => {
    expect(ScoreV1Schema.safeParse({ ...score, schemaVersion: 2 }).success).toBe(false);
    expect(ScoreV1Schema.safeParse({ ...score, nativeRenderer: {} }).success).toBe(false);
    const { finger: _finger, ...missingFinger } = score.placements[0]!;
    expect(PlacementSchema.safeParse(missingFinger).success).toBe(false);
    expect(PlacementSchema.safeParse({ ...score.placements[0], fret: 1, finger: 0 }).success).toBe(false);
    const { release: _release, ...missingRelease } = score.contacts[0]!;
    expect(HeldContactSchema.safeParse(missingRelease).success).toBe(false);
    expect(ScoreV1Schema.safeParse({ ...score, ability: { ...score.ability, barre: 'allowed' } }).success).toBe(false);
  });
  test('concrete tuplets, dotted rests and cross-bar ties; no sound retrigger encoded by splitting', () => {
    expect(score.notation.filter((n) => n.eventId === 'm4').map((n) => n.tie)).toEqual(['start', 'end']);
    expect(score.performedSounds.filter((s) => s.soundId === 'm4')).toHaveLength(1);
    expect(score.performedSounds.find((s) => s.soundId === 'm4')?.occurrenceIds).toEqual(['o1', 'o2']);
    expect(NotationSegmentSchema.safeParse({ ...score.notation[1], duration: q(1) }).success).toBe(false);
    expect(NotationSegmentSchema.safeParse({ ...score.notation[6], tie: 'start' }).success).toBe(false);
  });
  test('candidate/exhausted/proven-unsatisfiable cannot be conflated', () => {
    const diagnostic = { code: 'search-budget', severity: 'error', message: 'Fixture only', barIds: ['b1'], eventIds: ['m0'], occurrenceIds: ['o1'] };
    expect(ArrangeResultSchema.safeParse({ status: 'candidate', score, diagnostics: [] }).success).toBe(true);
    expect(ArrangeResultSchema.safeParse({ status: 'search-exhausted', diagnostics: [diagnostic] }).success).toBe(true);
    expect(ArrangeResultSchema.safeParse({ status: 'proven-unsatisfiable', diagnostics: [diagnostic] }).success).toBe(false);
    expect(ArrangeResultSchema.safeParse({ status: 'candidate', diagnostics: [] }).success).toBe(false);
  });
  test('a structurally bound validated draft can remain musically unreviewed; stale binding rejected', () => {
    const ref = { id: score.revision.id, digest: score.revision.digest };
    const validation = { status: 'passed', scoreRevision: ref, sourceRevision: score.source.revision, validatorVersion: 'test-schema-only',
      checks: ['source-identity', 'melody', 'form-tempo', 'physical', 'approval-locks'], transitions: 'uncalibrated', diagnostics: [] };
    const envelope = { status: 'validatedDraft', score, validation };
    expect(ValidatedScoreV1Schema.parse(envelope).score.musicalReview.status).toBe('pending');
    expect(ValidatedScoreV1Schema.safeParse({ ...envelope, validation: { ...validation, scoreRevision: { ...ref, id: 'stale' } } }).success).toBe(false);
  });
  test('fallback cannot masquerade as a configured provider call', () => {
    expect(PlannerProvenanceSchema.safeParse(score.planner).success).toBe(true);
    expect(PlannerProvenanceSchema.safeParse({ ...score.planner, mode: 'configured-llm' }).success).toBe(false);
    expect(PlannerProvenanceSchema.safeParse({ ...score.planner, provider: 'invented' }).success).toBe(false);
  });
  test('API/export boundaries require revision identity; restricted import is not empty success', () => {
    const request = { projectId: score.projectId, expectedHead: { id: score.revision.id, digest: score.revision.digest }, format: 'midi' as const };
    expect(ExportRequestSchema.parse(request)).toEqual(request);
    expect(ExportRequestSchema.safeParse({ ...request, expectedHead: { id: score.revision.id } }).success).toBe(false);
    expect(ImportResultSchema.safeParse({ status: 'source-ready', diagnostics: [] }).success).toBe(false);
    expect(ImportResultSchema.safeParse({ status: 'restricted', diagnostics: [] }).success).toBe(false);
    expect(ImportResultSchema.safeParse({ status: 'restricted', diagnostics: [{ code: 'restricted-source', severity: 'error', message: 'Explicit access restriction', barIds: [], eventIds: [], occurrenceIds: [] }] }).success).toBe(true);
  });
});

describe('full immutable revision identity', () => {
  test('committed original artifact and complete source/score digests are real and reproducible', async () => {
    const raw = Bun.file(new URL('./original-raw.json', import.meta.url));
    const rawDigest = new Bun.CryptoHasher('sha256').update(await raw.arrayBuffer()).digest('hex');
    expect(source.manifest.artifacts[0]!.sha256).toBe(rawDigest);
    expect(source.manifest.artifacts[0]!.byteLength).toBe(raw.size);
    expect(await verifyRevisionDigest(source)).toBe(true);
    expect(await verifyRevisionDigest(score)).toBe(true);
  });
  test('canonical object ordering, array identity, invalid JSON values', async () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(await contentDigest({ a: 1, b: 2 })).toBe(await contentDigest({ b: 2, a: 1 }));
    expect(await contentDigest(['a', 'b'])).not.toBe(await contentDigest(['b', 'a']));
    expect(() => canonicalJson({ x: Infinity })).toThrow();
    expect(() => canonicalJson({ x: -0 })).toThrow();
    expect(() => canonicalJson(new Date() as never)).toThrow();
    expect(() => canonicalJson([undefined] as never)).toThrow();
  });
  test('binds content, IDs, approvals and source revision, not merely notes or a URL', async () => {
    const digest = await revisionDigest(score);
    const sealed = { ...score, revision: { ...score.revision, digest } };
    expect(await verifyRevisionDigest(sealed)).toBe(true);
    for (const changed of [
      { ...sealed, revision: { ...sealed.revision, id: 'different-r1' } },
      { ...sealed, instrument: { ...sealed.instrument, capo: 2 } },
      { ...sealed, preferences: { ...sealed.preferences, difficulty: 'advanced' } },
      { ...sealed, source: { ...sealed.source, revision: { ...sealed.source.revision, id: 'upstream-changed' } } },
      { ...sealed, musicalReview: { status: 'pending', reason: 'Modified review' } },
    ]) expect(await verifyRevisionDigest(changed)).toBe(false);
    expect(await verifyRevisionDigest({ ...sealed, revision: { ...sealed.revision, digest: 'f'.repeat(64) } })).toBe(false);
  });
});

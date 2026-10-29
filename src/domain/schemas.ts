import { z } from 'zod';
import { add, compare, DurationSchema, multiply, q, TimeSchema } from './rational';

export const IdSchema = z.string().min(1).max(160);
export const DigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const Version = z.string().min(1).max(100);
const Midi = z.number().int().min(0).max(127);
const NonnegativeInt = z.number().int().safe().nonnegative();
const PositiveInt = z.number().int().safe().positive();
const Role = z.enum(['melody', 'bass', 'harmony']);

export const RevisionRefSchema = z.strictObject({ id: IdSchema, digest: DigestSchema });
export const RevisionSchema = RevisionRefSchema.extend({ parentId: IdSchema.nullable() });

const SongsterrIdentitySchema = z.strictObject({ kind: z.literal('songsterr'), url: z.url(), songId: PositiveInt, upstreamRevisionId: PositiveInt, formatVersion: PositiveInt });
export const SourceManifestSchema = z.strictObject({
  identity: z.union([
    SongsterrIdentitySchema,
    SongsterrIdentitySchema.extend({
      // The declared version applies only to versioned parts. These exceptions
      // were parsed structurally, without assigning them an upstream version.
      unversionedPartIds: z.array(NonnegativeInt).min(1).max(32).refine((ids) => new Set(ids).size === ids.length, 'Duplicate unversioned part IDs'),
    }),
    z.strictObject({ kind: z.literal('upload'), filename: z.string().min(1).max(200), format: z.enum(['musicxml', 'guitar-pro', 'midi']) }),
    z.strictObject({ kind: z.literal('original-fixture'), name: z.string().min(1), author: z.string().min(1) }),
  ]),
  retrievedAt: z.iso.datetime(),
  parser: z.strictObject({ name: IdSchema, version: Version }),
  artifacts: z.array(z.strictObject({ id: IdSchema, sha256: DigestSchema, byteLength: PositiveInt, mediaType: z.string().min(1) })).min(1),
});

export const MeterSchema = z.strictObject({
  beats: PositiveInt.max(32), beatUnit: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32)]),
});
export const KeySchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('identified'), tonicPitchClass: NonnegativeInt.max(11), mode: z.enum(['major', 'minor', 'modal']), evidence: z.string().min(1), certainty: z.enum(['source-declared', 'inferred', 'user-confirmed']) }),
  z.strictObject({ status: z.literal('unknown'), reason: z.string().min(1) }),
]);
export const WrittenBarSchema = z.strictObject({
  id: IdSchema, number: PositiveInt, start: TimeSchema, length: DurationSchema, meter: MeterSchema,
  kind: z.enum(['full', 'pickup', 'partial']),
}).refine((bar) => bar.kind !== 'full' || compare(bar.length, q(bar.meter.beats * 4, bar.meter.beatUnit)) === 0, 'Full bar length must match meter');

export const TempoPointSchema = z.strictObject({
  id: IdSchema, barId: IdSchema, offset: TimeSchema, quarterBpm: z.number().finite().positive().max(400),
});
export const FormSchema = z.strictObject({
  kind: z.literal('linear-repeats'),
  repeats: z.array(z.strictObject({ id: IdSchema, fromBarId: IdSchema, toBarId: IdSchema, totalPasses: PositiveInt.min(2).max(16) })),
  tempoPolicy: z.literal('restore-written-position'), jumpTiePolicy: z.literal('reject-cross-jump'),
});
export const OccurrenceSchema = z.strictObject({
  id: IdSchema, writtenBarId: IdSchema, pass: PositiveInt, start: TimeSchema, length: DurationSchema,
  entryQuarterBpm: z.number().finite().positive().max(400), meter: MeterSchema,
  entry: z.enum(['start', 'contiguous', 'repeat-jump']),
});
export const PerformedTempoSchema = z.strictObject({
  occurrenceId: IdSchema, start: TimeSchema, quarterBpm: z.number().finite().positive().max(400),
  origin: z.enum(['written-point', 'entry-restore']), sourceTempoId: IdSchema,
});

export const SpellingSchema = z.strictObject({
  step: z.enum(['C', 'D', 'E', 'F', 'G', 'A', 'B']), alter: z.number().int().min(-2).max(2), octave: z.number().int().min(-1).max(9),
});
export const SourceRefSchema = z.strictObject({
  sourceNoteId: IdSchema, partId: NonnegativeInt, barId: IdSchema, voiceId: IdSchema, beatId: IdSchema, noteIndex: NonnegativeInt,
  rawWholeNoteDuration: DurationSchema,
  sourcePosition: z.strictObject({ stringIndex: NonnegativeInt, fret: NonnegativeInt }).nullable(),
});
const SourceEventBase = {
  id: IdSchema, partId: NonnegativeInt, voiceId: IdSchema, start: TimeSchema, duration: DurationSchema,
  refs: z.array(SourceRefSchema).min(1),
};
export const SourceEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...SourceEventBase, kind: z.literal('note'), soundingMidi: Midi, spelling: SpellingSchema, tieChainId: IdSchema.nullable(),
    effects: z.array(z.strictObject({ code: IdSchema, description: z.string().min(1), affectsMelody: z.boolean() })) }),
  z.strictObject({ ...SourceEventBase, kind: z.literal('rest') }),
]);
export const PartSchema = z.strictObject({
  id: NonnegativeInt, name: z.string().min(1), program: NonnegativeInt.max(127).nullable(),
  voices: z.array(IdSchema).min(1),
  sourceTuning: z.strictObject({ order: z.enum(['low-to-high', 'high-to-low']), soundingMidi: z.array(Midi).min(1).max(16) }).nullable(),
});

export const SourceScoreV1Schema = z.strictObject({
  schemaVersion: z.literal(1), revision: RevisionSchema, manifest: SourceManifestSchema, key: KeySchema,
  parts: z.array(PartSchema).min(1), bars: z.array(WrittenBarSchema).min(1),
  tempos: z.array(TempoPointSchema).min(1), form: FormSchema, events: z.array(SourceEventSchema).min(1),
});

export const MelodySectionSchema = z.strictObject({
  id: IdSchema, label: z.string().min(1), start: TimeSchema, end: TimeSchema,
  selectors: z.array(z.strictObject({ partId: NonnegativeInt, voiceId: IdSchema, eventIds: z.array(IdSchema).min(1) })),
  intentionalRests: z.array(z.strictObject({ id: IdSchema, start: TimeSchema, duration: DurationSchema, reason: z.string().min(1) })),
}).refine(({ start, end }) => compare(start, end) < 0, 'Section end must follow start');
export const MelodySelectionSchema = z.strictObject({
  id: IdSchema, sourceRevision: RevisionRefSchema, sections: z.array(MelodySectionSchema).min(1),
});

export const InstrumentSchema = z.strictObject({
  id: z.literal('standard-six-string-guitar-v1'),
  tuning: z.tuple([z.literal(40), z.literal(45), z.literal(50), z.literal(55), z.literal(59), z.literal(64)]),
  stringOrder: z.literal('low-to-high'), capo: NonnegativeInt.max(12), maxPhysicalFret: PositiveInt.max(24),
  writtenOctaveOffset: z.literal(12),
}).refine(({ capo, maxPhysicalFret }) => capo <= maxPhysicalFret, 'Capo exceeds neck');

export const AbilityProfileSchema = z.strictObject({
  id: IdSchema, version: Version, difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  calibration: z.enum(['synthetic-only', 'provisional', 'guitarist-reviewed']),
  maxPhysicalFret: PositiveInt.max(24), maxStoppedFretSpan: NonnegativeInt.max(12),
  maxSoundingNotes: PositiveInt.max(6), maxFrettedContacts: PositiveInt.max(4), barre: z.literal('unsupported'),
  transition: z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('uncalibrated'), reason: z.string().min(1) }),
    z.strictObject({ status: z.literal('specified'), maxPhysicalFretsPerSecond: z.number().finite().positive(), minFingerReassignmentMs: z.number().finite().nonnegative(), evidence: z.string().min(1) }),
  ]),
});

export const PreferencesSchema = z.strictObject({
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']), ability: z.strictObject({ id: IdSchema, version: Version }),
  capo: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('chosen'), value: NonnegativeInt.max(12) }),
    z.strictObject({ mode: z.literal('recommend'), compare: z.tuple([z.literal(0), z.literal(2)]) }),
  ]),
  transposition: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('preserve'), semitones: z.literal(0) }),
    z.strictObject({ mode: z.literal('explicit'), semitones: z.number().int().min(-24).max(24), authorizationId: IdSchema, reason: z.string().min(1) }),
  ]),
  tempoScale: z.number().finite().min(0.5).max(1.25), bassDensity: z.enum(['none', 'sparse', 'regular']), harmonyDensity: z.enum(['none', 'sparse']),
});
export const CapoComparisonSchema = z.strictObject({
  selected: NonnegativeInt.max(12), reason: z.string().min(1),
  alternatives: z.array(z.strictObject({ capo: NonnegativeInt.max(12), outcome: z.enum(['candidate', 'unsatisfied', 'search-exhausted', 'not-evaluated']), reason: z.string().min(1) })).min(1),
});

export const EventProvenanceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('source'), eventIds: z.array(IdSchema).min(1) }),
  z.strictObject({ kind: z.literal('generated'), strategyVersion: Version, evidenceEventIds: z.array(IdSchema).min(1), reason: z.string().min(1) }),
]);
export const SoundSchema = z.strictObject({
  id: IdSchema, role: Role, voiceId: IdSchema, start: TimeSchema, duration: DurationSchema,
  soundingMidi: Midi, spelling: SpellingSchema, provenance: EventProvenanceSchema,
});
export const RestSchema = z.strictObject({
  id: IdSchema, role: Role, voiceId: IdSchema, start: TimeSchema, duration: DurationSchema,
  provenance: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('source'), eventIds: z.array(IdSchema).min(1) }),
    z.strictObject({ kind: z.literal('intentional'), selectionRestId: IdSchema }),
  ]),
});

export const NotationSegmentSchema = z.strictObject({
  id: IdSchema, eventId: IdSchema, kind: z.enum(['note', 'rest']), barId: IdSchema, voiceId: IdSchema,
  start: TimeSchema, duration: DurationSchema, baseDenominator: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32), z.literal(64)]),
  dots: NonnegativeInt.max(3),
  tuplet: z.strictObject({ groupId: IdSchema, actual: PositiveInt.max(16), normal: PositiveInt.max(16), index: NonnegativeInt }).nullable(),
  tie: z.enum(['none', 'start', 'continue', 'end']),
}).superRefine((segment, ctx) => {
  let duration = q(4, segment.baseDenominator);
  duration = multiply(duration, q(2 ** (segment.dots + 1) - 1, 2 ** segment.dots));
  if (segment.tuplet) {
    duration = multiply(duration, q(segment.tuplet.normal, segment.tuplet.actual));
    if (segment.tuplet.index >= segment.tuplet.actual) ctx.addIssue({ code: 'custom', message: 'Tuplet index exceeds group' });
  }
  if (compare(duration, segment.duration) !== 0) ctx.addIssue({ code: 'custom', message: 'Notation duration disagrees with base/dots/tuplet' });
  if (segment.kind === 'rest' && segment.tie !== 'none') ctx.addIssue({ code: 'custom', message: 'Rest cannot be tied' });
});

export const PlacementSchema = z.strictObject({
  id: IdSchema, soundId: IdSchema, stringIndex: NonnegativeInt.max(5), fret: NonnegativeInt.max(24), finger: NonnegativeInt.max(4),
}).refine(({ fret, finger }) => (fret === 0) === (finger === 0), 'Open uses finger 0; stopped uses finger 1–4');
export const PerformedSoundSchema = z.strictObject({
  id: IdSchema, soundId: IdSchema, attackOccurrenceId: IdSchema, occurrenceIds: z.array(IdSchema).min(1),
  start: TimeSchema, duration: DurationSchema, placementId: IdSchema,
});
export const HeldContactSchema = z.strictObject({
  id: IdSchema, performedSoundId: IdSchema, soundId: IdSchema, placementId: IdSchema, start: TimeSchema, release: TimeSchema,
}).refine(({ start, release }) => compare(start, release) < 0, 'Contact release must follow attack');
export const HandStateSchema = z.strictObject({
  at: TimeSchema, activeContactIds: z.array(IdSchema),
  position: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('released') }),
    z.strictObject({ kind: z.literal('fretting'), anchorPhysicalFret: PositiveInt.max(24) }),
  ]),
});

export const ChordSpanSchema = z.strictObject({
  id: IdSchema, start: TimeSchema, duration: DurationSchema,
  chord: z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('known'), symbol: z.string().min(1), pitchClasses: z.array(NonnegativeInt.max(11)).min(1), bassPitchClass: NonnegativeInt.max(11).nullable() }),
    z.strictObject({ status: z.literal('unknown'), reason: z.string().min(1) }),
  ]),
  evidenceEventIds: z.array(IdSchema), basis: z.enum(['source-derived', 'user-confirmed', 'unresolved']),
});
export const ChangeSchema = z.strictObject({
  id: IdSchema, kind: z.enum(['bass-register', 'omission', 'shortened-sustain', 'explicit-transposition']),
  role: Role, sourceEventIds: z.array(IdSchema).min(1), soundIds: z.array(IdSchema),
  before: z.strictObject({ soundingMidi: Midi, duration: DurationSchema }),
  after: z.strictObject({ soundingMidi: Midi, duration: DurationSchema }).nullable(), reason: z.string().min(1),
});

export const PlanSchema = z.strictObject({
  version: Version,
  candidates: z.array(z.strictObject({ id: IdSchema, role: z.enum(['bass', 'harmony']), sourceEventIds: z.array(IdSchema).min(1), octaveShift: z.number().int().min(-3).max(3), density: z.enum(['sparse', 'regular']), reason: z.string().min(1) })),
});
export const PlannerProvenanceSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('deterministic-fallback'), label: z.literal('deterministic fallback'), plannerVersion: Version,
    reason: z.enum(['not-configured', 'timeout', 'invalid-output', 'refusal', 'provider-error', 'disabled']), detail: z.string().min(1) }),
  z.strictObject({ mode: z.literal('configured-llm'), provider: z.string().min(1), model: z.string().min(1), plannerVersion: Version,
    callId: IdSchema, calledAt: z.iso.datetime(), responseDigest: DigestSchema, acceptedCandidateIds: z.array(IdSchema) }),
]);

const ApprovalRecord = z.strictObject({
  id: IdSchema, approvedFrom: RevisionRefSchema, scopeDigest: DigestSchema, reviewer: z.string().min(1), approvedAt: z.iso.datetime(),
});
export const ApprovalStateSchema = z.discriminatedUnion('stage', [
  z.strictObject({ stage: z.literal('sourceReady') }),
  z.strictObject({ stage: z.literal('melodyApproved'), melody: ApprovalRecord }),
  z.strictObject({ stage: z.literal('bassApproved'), melody: ApprovalRecord, bass: ApprovalRecord }),
  z.strictObject({ stage: z.literal('arrangementApproved'), melody: ApprovalRecord, bass: ApprovalRecord, harmony: ApprovalRecord }),
]);
export const ApprovedLockSchema = z.strictObject({
  role: Role, approvedFrom: RevisionRefSchema, scopeDigest: DigestSchema,
  sounds: z.array(SoundSchema), rests: z.array(RestSchema),
});
export const MusicalReviewSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('pending'), reason: z.string().min(1) }),
  z.strictObject({ status: z.literal('reviewed'), reviewedRevision: RevisionRefSchema, reviewer: z.string().min(1), reviewedAt: z.iso.datetime(),
    abilityId: IdSchema, abilityVersion: Version, tempoScale: z.number().finite().positive(), verdict: z.enum(['accepted', 'objections']), objections: z.array(z.string().min(1)) }),
]);

export const DiagnosticSchema = z.strictObject({
  code: z.enum(['invalid-input', 'restricted-source', 'source-mismatch', 'unsupported-construct', 'selection-needed', 'melody-mismatch', 'form-mismatch', 'tempo-mismatch', 'pitch-placement', 'string-collision', 'finger-collision', 'profile-limit', 'transition-unverified', 'approval-stale', 'revision-stale', 'search-budget', 'unsatisfied', 'artifact-mismatch']),
  severity: z.enum(['error', 'warning', 'info']), message: z.string().min(1),
  barIds: z.array(IdSchema), eventIds: z.array(IdSchema), occurrenceIds: z.array(IdSchema),
});

export const ScoreV1Schema = z.strictObject({
  schemaVersion: z.literal(1), projectId: IdSchema, revision: RevisionSchema,
  source: z.strictObject({ revision: RevisionRefSchema, manifest: SourceManifestSchema }),
  key: KeySchema, selection: MelodySelectionSchema, preferences: PreferencesSchema,
  instrument: InstrumentSchema, ability: AbilityProfileSchema, capoComparison: CapoComparisonSchema,
  bars: z.array(WrittenBarSchema).min(1), tempos: z.array(TempoPointSchema).min(1), form: FormSchema,
  occurrences: z.array(OccurrenceSchema).min(1), performedTempos: z.array(PerformedTempoSchema).min(1),
  sounds: z.array(SoundSchema).min(1), rests: z.array(RestSchema), notation: z.array(NotationSegmentSchema).min(1),
  placements: z.array(PlacementSchema).min(1), performedSounds: z.array(PerformedSoundSchema).min(1),
  contacts: z.array(HeldContactSchema).min(1), handStates: z.array(HandStateSchema).min(2),
  chords: z.array(ChordSpanSchema), changes: z.array(ChangeSchema),
  plan: PlanSchema, planner: PlannerProvenanceSchema, locks: z.array(ApprovedLockSchema), approvals: ApprovalStateSchema, musicalReview: MusicalReviewSchema,
});

export const ArrangementRequestSchema = z.strictObject({
  sourceRevision: RevisionRefSchema, selection: MelodySelectionSchema, preferences: PreferencesSchema,
  ability: AbilityProfileSchema, maxPhysicalFret: PositiveInt.max(24),
  locks: z.array(ApprovedLockSchema),
  budget: z.strictObject({ maxStates: PositiveInt, maxElapsedMs: PositiveInt }),
});
export const ArrangeResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('candidate'), score: ScoreV1Schema, diagnostics: z.array(DiagnosticSchema) }),
  z.strictObject({ status: z.enum(['selection-needed', 'unsupported', 'invalid-input', 'invalid-candidate', 'search-exhausted', 'reapproval-needed']), diagnostics: z.array(DiagnosticSchema).min(1) }),
  z.strictObject({ status: z.literal('proven-unsatisfiable'), proof: z.strictObject({ method: z.literal('exhaustive-finite-domain'), checkedStates: NonnegativeInt, domainDigest: DigestSchema }), diagnostics: z.array(DiagnosticSchema).min(1) }),
]);

export const ValidationReportSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('passed'), scoreRevision: RevisionRefSchema, sourceRevision: RevisionRefSchema, validatorVersion: Version,
    checks: z.tuple([z.literal('source-identity'), z.literal('melody'), z.literal('form-tempo'), z.literal('physical'), z.literal('approval-locks')]),
    transitions: z.enum(['specified-limits-passed', 'uncalibrated']), diagnostics: z.array(DiagnosticSchema) }),
  z.strictObject({ status: z.literal('failed'), scoreRevision: RevisionRefSchema, sourceRevision: RevisionRefSchema, validatorVersion: Version, diagnostics: z.array(DiagnosticSchema).min(1) }),
]);
export const ValidatedScoreV1Schema = z.strictObject({
  status: z.literal('validatedDraft'), score: ScoreV1Schema,
  validation: ValidationReportSchema.options[0],
}).superRefine(({ score, validation }, ctx) => {
  if (score.revision.id !== validation.scoreRevision.id || score.revision.digest !== validation.scoreRevision.digest ||
      score.source.revision.id !== validation.sourceRevision.id || score.source.revision.digest !== validation.sourceRevision.digest) {
    ctx.addIssue({ code: 'custom', message: 'Validation is bound to another revision' });
  }
  if (validation.diagnostics.some((d) => d.severity === 'error')) ctx.addIssue({ code: 'custom', message: 'Passed validation cannot contain errors' });
});

export const ArtifactManifestSchema = z.strictObject({
  schemaVersion: z.literal(1), scoreRevision: RevisionRefSchema, sourceRevision: RevisionRefSchema,
  ability: z.strictObject({ id: IdSchema, version: Version }), adapter: z.strictObject({ name: IdSchema, version: Version }),
  format: z.enum(['pdf', 'midi']), artifactDigest: DigestSchema, byteLength: PositiveInt,
  occurrenceCount: PositiveInt, soundingAttackCount: PositiveInt, notationSegmentCount: PositiveInt,
  review: z.enum(['unreviewed-draft', 'musically-reviewed']), validationVersion: Version,
  tuning: InstrumentSchema.shape.tuning, capo: NonnegativeInt.max(12), midiPitchPolicy: z.literal('already-sounding-no-capo-offset'),
});

export type SourceScoreV1 = z.infer<typeof SourceScoreV1Schema>;
export type ScoreV1 = z.infer<typeof ScoreV1Schema>;
export type ArrangementRequest = z.infer<typeof ArrangementRequestSchema>;
export type ArrangeResult = z.infer<typeof ArrangeResultSchema>;
export type ValidationReport = z.infer<typeof ValidationReportSchema>;
export type ValidatedScoreV1 = z.infer<typeof ValidatedScoreV1Schema>;
export type Diagnostic = z.infer<typeof DiagnosticSchema>;
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type PlannerProvenance = z.infer<typeof PlannerProvenanceSchema>;
export type RevisionRef = z.infer<typeof RevisionRefSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type Sound = z.infer<typeof SoundSchema>;
export type Placement = z.infer<typeof PlacementSchema>;
export type HeldContact = z.infer<typeof HeldContactSchema>;
export type Occurrence = z.infer<typeof OccurrenceSchema>;
export type SourceManifest = z.infer<typeof SourceManifestSchema>;
export type Meter = z.infer<typeof MeterSchema>;
export type WrittenBar = z.infer<typeof WrittenBarSchema>;
export type TempoPoint = z.infer<typeof TempoPointSchema>;
export type Form = z.infer<typeof FormSchema>;
export type PerformedTempo = z.infer<typeof PerformedTempoSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type SourceEvent = z.infer<typeof SourceEventSchema>;
export type MelodySelection = z.infer<typeof MelodySelectionSchema>;
export type Instrument = z.infer<typeof InstrumentSchema>;
export type AbilityProfile = z.infer<typeof AbilityProfileSchema>;
export type Rest = z.infer<typeof RestSchema>;
export type NotationSegment = z.infer<typeof NotationSegmentSchema>;
export type PerformedSound = z.infer<typeof PerformedSoundSchema>;
export type HandState = z.infer<typeof HandStateSchema>;
export type ApprovedLock = z.infer<typeof ApprovedLockSchema>;
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;

export function eventEnd(event: { start: z.infer<typeof TimeSchema>; duration: z.infer<typeof DurationSchema> }) {
  return add(event.start, event.duration);
}

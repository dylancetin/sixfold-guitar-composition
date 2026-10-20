import { z } from 'zod';
import {
  ArrangementRequestSchema, ArtifactManifestSchema, DiagnosticSchema, IdSchema,
  RevisionRefSchema, ScoreV1Schema, SourceScoreV1Schema, ValidatedScoreV1Schema,
} from './schemas';
import type {
  ArrangementRequest, ArrangeResult, ArtifactManifest, Diagnostic, Plan, PlannerProvenance,
  RevisionRef, ScoreV1, SourceScoreV1, ValidatedScoreV1, ValidationReport,
} from './schemas';
import { DurationSchema, TimeSchema } from './rational';

export type ImportInput =
  | { kind: 'songsterr-url'; url: string }
  | { kind: 'upload'; filename: string; bytes: Uint8Array; format: 'musicxml' | 'guitar-pro' | 'midi' };

export const ImportResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('source-ready'), source: SourceScoreV1Schema, diagnostics: z.array(DiagnosticSchema) }),
  z.strictObject({ status: z.enum(['invalid-input', 'unsupported', 'restricted', 'unavailable', 'selection-needed']), diagnostics: z.array(DiagnosticSchema).min(1) }),
]);
export type ImportResult = z.infer<typeof ImportResultSchema>;

export interface SourceAdapter {
  import(input: ImportInput, signal?: AbortSignal): Promise<ImportResult>;
}
export interface OptionalPlanner {
  plan(source: SourceScoreV1, request: ArrangementRequest, signal?: AbortSignal): Promise<{ plan: Plan; provenance: PlannerProvenance; diagnostics: Diagnostic[] }>;
}
export interface Engine {
  arrange(source: SourceScoreV1, request: ArrangementRequest, plan: Plan, planner: PlannerProvenance): ArrangeResult;
}
export const ValidationContextSchema = z.strictObject({ approvedRevisions: z.array(ScoreV1Schema).max(3) });
export type ValidationContext = z.infer<typeof ValidationContextSchema>;
export interface Validator {
  validate(source: SourceScoreV1, score: ScoreV1, context: ValidationContext): ValidationReport;
}

export const AdapterProjectionSchema = z.strictObject({
  schemaVersion: z.literal(1), scoreRevision: RevisionRefSchema,
  form: z.literal('unfolded-no-repeat-commands'),
  engraving: z.strictObject({
    partCount: z.literal(1), staffAndTab: z.literal(true), writtenOctaveOffset: z.literal(12),
    bars: z.array(z.strictObject({ occurrenceId: IdSchema, writtenBarId: IdSchema, pass: z.number().int().positive(), label: z.string().min(1) })).min(1),
  }),
  mapping: z.array(z.strictObject({
    eventId: IdSchema, segmentId: IdSchema, occurrenceId: IdSchema,
    nativeBeatId: IdSchema, nativeNoteId: IdSchema.nullable(),
  })).min(1),
  playback: z.strictObject({
    activeProjection: z.literal('role-separated-only'),
    tracks: z.tuple([
      z.strictObject({ role: z.literal('melody'), channel: z.literal(0), program: z.literal(24) }),
      z.strictObject({ role: z.literal('bass'), channel: z.literal(1), program: z.literal(24) }),
      z.strictObject({ role: z.literal('harmony'), channel: z.literal(2), program: z.literal(24) }),
    ]),
    events: z.array(z.strictObject({
      performedSoundId: IdSchema, soundId: IdSchema, occurrenceId: IdSchema,
      role: z.enum(['melody', 'bass', 'harmony']), soundingMidi: z.number().int().min(0).max(127), start: TimeSchema, duration: DurationSchema,
    })).min(1),
  }),
});
export type AdapterProjection = z.infer<typeof AdapterProjectionSchema>;
export type Artifact = { bytes: Uint8Array; mediaType: 'application/pdf' | 'audio/midi'; filename: string; manifest: ArtifactManifest };
export interface ScoreAdapter {
  project(score: ValidatedScoreV1): Promise<AdapterProjection>;
  exportArtifact(source: SourceScoreV1, score: ValidatedScoreV1, format: 'pdf' | 'midi', signal?: AbortSignal): Promise<Artifact>;
}

export const RevisionMutationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('create'), expectedHead: z.null(), replacement: ScoreV1Schema.refine((score) => score.revision.parentId === null, 'Create requires a parentless revision') }),
  z.strictObject({ kind: z.literal('source-edit'), expectedHead: RevisionRefSchema, replacement: ScoreV1Schema }),
  z.strictObject({ kind: z.literal('melody-edit'), expectedHead: RevisionRefSchema, replacement: ScoreV1Schema }),
  z.strictObject({ kind: z.literal('bass-edit'), expectedHead: RevisionRefSchema, replacement: ScoreV1Schema }),
  z.strictObject({ kind: z.literal('harmony-edit'), expectedHead: RevisionRefSchema, replacement: ScoreV1Schema }),
  z.strictObject({ kind: z.literal('preferences-edit'), expectedHead: RevisionRefSchema, replacement: ScoreV1Schema }),
  z.strictObject({ kind: z.literal('approve'), stage: z.enum(['melody', 'bass', 'harmony']), expectedHead: RevisionRefSchema, replacement: ScoreV1Schema }),
]);
export const ExportRequestSchema = z.strictObject({
  projectId: IdSchema, expectedHead: RevisionRefSchema, format: z.enum(['pdf', 'midi']),
});
export const LocalDownloadPathSchema = z.string().startsWith('/').refine(
  (path) => !path.startsWith('//') && !/[\\\u0000-\u001f\u007f-\u009f]/u.test(path),
  'Download path must be root-relative without an authority, backslashes or control characters',
);
export function resolveLocalDownloadUrl(path: string, baseOrigin: string): URL {
  const base = new URL(baseOrigin);
  if (base.protocol !== 'https:' && base.protocol !== 'http:') throw new TypeError('Expected an HTTP(S) application origin');
  const resolved = new URL(LocalDownloadPathSchema.parse(path), base.origin);
  if (resolved.origin !== base.origin) throw new TypeError('Download URL must be same-origin');
  return resolved;
}
export const ExportResponseSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ready'), manifest: ArtifactManifestSchema, downloadPath: LocalDownloadPathSchema, filename: z.string().min(1), mediaType: z.enum(['application/pdf', 'audio/midi']) }),
  z.strictObject({ status: z.enum(['stale-revision', 'validation-failed', 'unsupported', 'unavailable']), diagnostics: z.array(DiagnosticSchema).min(1) }),
]);
export const SaveResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('saved'), revision: RevisionRefSchema }),
  z.strictObject({ status: z.literal('conflict'), currentHead: RevisionRefSchema.nullable() }),
  z.strictObject({ status: z.literal('invalid'), diagnostics: z.array(DiagnosticSchema).min(1) }),
]);
export interface RevisionStore {
  get(projectId: string, revisionId: string): Promise<ScoreV1 | null>;
  commit(projectId: string, mutation: z.infer<typeof RevisionMutationSchema>): Promise<z.infer<typeof SaveResultSchema>>;
}
export interface Api {
  import(input: ImportInput, signal?: AbortSignal): Promise<ImportResult>;
  arrange(source: RevisionRef, request: z.infer<typeof ArrangementRequestSchema>, signal?: AbortSignal): Promise<ArrangeResult>;
  getRevision(projectId: string, revisionId: string): Promise<ScoreV1 | null>;
  commit(projectId: string, mutation: z.infer<typeof RevisionMutationSchema>): Promise<z.infer<typeof SaveResultSchema>>;
  validate(projectId: string, expectedHead: RevisionRef): Promise<ValidationReport>;
  exportArtifact(request: z.infer<typeof ExportRequestSchema>, signal?: AbortSignal): Promise<z.infer<typeof ExportResponseSchema>>;
}

export type ExportableDraft = z.infer<typeof ValidatedScoreV1Schema>;

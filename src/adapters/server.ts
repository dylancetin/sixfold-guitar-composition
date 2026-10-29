// Node-only entry. Never re-export this module from the browser barrel.
import { ArtifactManifestSchema, contentDigest, ScoreV1Schema, SourceScoreV1Schema, ValidatedScoreV1Schema, ValidationContextSchema, ValidationReportSchema, verifyRevisionDigest } from '../domain';
import type { Artifact, RevisionRef, ScoreAdapter, ScoreV1, SourceScoreV1, ValidationContext, Validator } from '../domain';
import { createAlphaTabScore } from './alpha-tab';
import { AdapterError, checkAbort } from './errors';
import { encodeMidi } from './midi';
import { encodePdf } from './pdf';
import type { PdfPageSize } from './pdf';
import { PdfLayoutSettingsSchema } from './pdf-settings';
import type { PdfLayoutSettings } from './pdf-settings';
import { compileTimeline } from './timeline';
import type { NotationMode } from './notation-schedule';

export const ADAPTER_VERSION = 'canonical-guitar-1.1.0';
export type ScoreAdapterOptions = {
  validator: Validator;
  /** Server-owned loader, never a context supplied in the download request body. */
  getValidationContext(source: SourceScoreV1, score: ScoreV1): ValidationContext | Promise<ValidationContext>;
  /** API owns head/CAS authority; use this hook or check head before calling exportArtifact. */
  assertCurrentRevision?(score: RevisionRef, source: RevisionRef): void | Promise<void>;
  pdfPageSize?: PdfPageSize;
  pdfLayout?: PdfLayoutSettings;
  pdfTitle?: string;
  notationMode?: NotationMode;
};
const ref = (revision: RevisionRef): RevisionRef => ({ id: revision.id, digest: revision.digest });
const same = (a: RevisionRef, b: RevisionRef) => a.id === b.id && a.digest === b.digest;
const reviewContent = (score: ScoreV1) => {
  const { revision: _revision, musicalReview: _review, approvals: _approvals, ...content } = score;
  return content;
};

export function createScoreAdapter(options: ScoreAdapterOptions): ScoreAdapter {
  const pdfLayout = options.pdfLayout ? PdfLayoutSettingsSchema.parse(options.pdfLayout) : undefined;
  return {
    async project(input) {
      const draft = ValidatedScoreV1Schema.parse(input);
      if (!await verifyRevisionDigest(draft.score)) throw new AdapterError('revision-stale', 'Score digest does not match content');
      // Projection is not an authorization token. Export always validates afresh below.
      return createAlphaTabScore(draft.score, { ...(options.notationMode ? { notationMode: options.notationMode } : {}) }).projection;
    },
    async exportArtifact(sourceInput, draftInput, format, signal) {
      checkAbort(signal);
      if (format !== 'pdf' && format !== 'midi') throw new AdapterError('unsupported-construct', 'Unknown artifact format');
      const source = SourceScoreV1Schema.parse(sourceInput);
      // Ignore the supplied envelope/report completely; only the immutable score is input.
      const score = ScoreV1Schema.parse(draftInput.score);
      if (!await verifyRevisionDigest(source) || !await verifyRevisionDigest(score)) throw new AdapterError('revision-stale', 'Source or score digest does not match content');
      if (!same(score.source.revision, source.revision) || await contentDigest(score.source.manifest) !== await contentDigest(source.manifest)) throw new AdapterError('revision-stale', 'Score references another source revision/manifest');
      await options.assertCurrentRevision?.(ref(score.revision), ref(source.revision));
      const context = ValidationContextSchema.parse(await options.getValidationContext(source, score));
      for (const approved of context.approvedRevisions) if (!await verifyRevisionDigest(approved)) throw new AdapterError('revision-stale', 'Approved revision digest mismatch');
      checkAbort(signal);
      const report = ValidationReportSchema.parse(options.validator.validate(source, score, context));
      if (report.status !== 'passed' || !same(report.scoreRevision, score.revision) || !same(report.sourceRevision, source.revision) || report.diagnostics.some(d => d.severity === 'error')) throw new AdapterError('validation-failed', 'Independent injected validator rejected this revision or returned a stale report');
      const timeline = compileTimeline(score);
      // Engraving representability is checked even for MIDI: downloadable revision must support both.
      const notation = createAlphaTabScore(score, { ...(options.notationMode ? { notationMode: options.notationMode } : {}), ...(format === 'pdf' ? { ...pdfLayout, ...(options.pdfTitle ? { title: options.pdfTitle, hideTitle: !!pdfLayout } : {}) } : {}) });
      const musicalReview = score.musicalReview;
      const reviewedFrom = musicalReview.status === 'reviewed' ? context.approvedRevisions.find(r => same(r.revision, musicalReview.reviewedRevision)) : undefined;
      const review = score.approvals.stage === 'arrangementApproved' && musicalReview.status === 'reviewed' && musicalReview.verdict === 'accepted' && musicalReview.objections.length === 0 && musicalReview.abilityId === score.ability.id && musicalReview.abilityVersion === score.ability.version && musicalReview.tempoScale === score.preferences.tempoScale && reviewedFrom && await contentDigest(reviewContent(reviewedFrom)) === await contentDigest(reviewContent(score)) ? 'musically-reviewed' : 'unreviewed-draft';
      // Inverse render width makes Size a real print-size change, not a scale
      // subsequently cancelled by fitting the same engraving back to the page.
      const bytes = format === 'midi' ? encodeMidi(timeline) : (await encodePdf(await notation.renderSvg(750 / (pdfLayout?.scale ?? 1), signal), `${review} | ${score.revision.id} | Capo ${score.instrument.capo} | ${score.revision.digest}`, options.pdfPageSize ?? 'A4', signal, { layout: pdfLayout, title: options.pdfTitle, form: notation.projection.form })).bytes;
      checkAbort(signal);
      // Head may have changed during rendering. The API should also gate binary response delivery.
      await options.assertCurrentRevision?.(ref(score.revision), ref(source.revision));
      const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
      const artifactDigest = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      const manifest = ArtifactManifestSchema.parse({
        schemaVersion: 1, scoreRevision: ref(score.revision), sourceRevision: ref(source.revision),
        ability: { id: score.ability.id, version: score.ability.version }, adapter: { name: 'canonical-guitar', version: ADAPTER_VERSION }, format, artifactDigest, byteLength: bytes.byteLength,
        occurrenceCount: score.occurrences.length, soundingAttackCount: timeline.notes.length, notationSegmentCount: notation.projection.mapping.length,
        review, validationVersion: report.validatorVersion, tuning: score.instrument.tuning, capo: score.instrument.capo, midiPitchPolicy: 'already-sounding-no-capo-offset',
      });
      const safeId = score.revision.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const artifact: Artifact = { bytes, manifest, filename: `${safeId}-${score.revision.digest.slice(0, 12)}-${review}.${format === 'pdf' ? 'pdf' : 'mid'}`, mediaType: format === 'pdf' ? 'application/pdf' : 'audio/midi' };
      return artifact;
    },
  };
}

export { AdapterError } from './errors';
export type { PdfPageSize } from './pdf';

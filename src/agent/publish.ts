import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AdapterProjectionSchema, contentDigest, ValidatedScoreV1Schema, revisionDigest, ScoreV1Schema, verifyRevisionDigest } from '../domain';
import type { Artifact, Engine, ScoreAdapter, Validator } from '../domain';
import { guitarValidator } from '../engine';
import { PublicationManifestSchema, publicationId, publicationLinks } from '../publication';
import { checkArtifactManifest, PublicationStore } from '../publication/store';
import type { PublicationBundle } from '../publication/store';
import { arrangeBounded } from './engine';
import { jsonBytes, readJson, sha256 } from './files';
import { acceptAgentPlan, AgentDelegationSchema } from './plan';
import { loadPreparedRun } from './prepare';

export type PublishOptions = {
  runDirectory: string; baseUrl: string; storeRoot?: string; planPath?: string; delegationPath?: string;
  baseline?: boolean; signal?: AbortSignal;
};
export type PublishDependencies = { scoreAdapter: ScoreAdapter; engine?: Engine; validator?: Validator; store?: PublicationStore };

export async function publishArrangement(options: PublishOptions, dependencies: PublishDependencies) {
  // Reject invalid origins before any expensive work or publication side effects.
  publicationLinks(options.baseUrl, publicationId('0'.repeat(64)));
  if (options.baseline ? !!options.planPath || !!options.delegationPath : !options.planPath || !options.delegationPath) throw new Error('Choose --baseline OR both --plan and --delegation (never inferred AI authorship)');
  options.signal?.throwIfAborted();
  const prepared = await loadPreparedRun(options.runDirectory);
  const { run, source, request, baseline, baselineProvenance } = prepared;
  const accepted = options.baseline ? null : await acceptAgentPlan({
    bytes: new Uint8Array(await readFile(options.planPath!)), delegation: await readJson(options.delegationPath!),
    source, requestDigest: run.requestDigest, baseline,
  });
  const plan = accepted?.plan ?? baseline;
  const provenance = accepted?.provenance ?? baselineProvenance;
  const result = dependencies.engine ? dependencies.engine.arrange(source, request, plan, provenance) : await arrangeBounded(source, request, plan, provenance, options.signal);
  if (result.status !== 'candidate') throw new Error(`Arrangement ${result.status}: ${result.diagnostics.map((d) => d.message).join('; ')}`);
  if (!await verifyRevisionDigest(result.score)) throw new Error('Engine candidate digest mismatch; refusing to stamp corrupt score');
  for (const [actual, expected] of [[result.score.selection, request.selection], [result.score.preferences, request.preferences], [result.score.ability, request.ability], [result.score.plan, plan], [result.score.planner, provenance], [result.score.locks, request.locks]] as const) {
    if (await contentDigest(actual) !== await contentDigest(expected)) throw new Error('Engine returned a score for a different request/plan/provenance');
  }
  const score = ScoreV1Schema.parse({ ...result.score, projectId: run.projectId, revision: { id: run.scoreRevisionId, parentId: null, digest: '0'.repeat(64) } });
  score.revision.digest = await revisionDigest(score);
  const validator = dependencies.validator ?? guitarValidator;
  const report = validator.validate(source, score, { approvedRevisions: [] });
  if (report.status !== 'passed') throw new Error(`Independent validation failed: ${report.diagnostics.map((d) => d.message).join('; ')}`);
  const draft = ValidatedScoreV1Schema.parse({ status: 'validatedDraft', score, validation: report });
  async function assertInputsUnchanged() {
    const reloaded = await loadPreparedRun(options.runDirectory);
    if (await contentDigest(reloaded.run) !== await contentDigest(run)) throw new Error('Prepared run changed during export');
    if (accepted && (sha256(await readFile(options.planPath!)) !== accepted.delegation.responseDigest || await contentDigest(AgentDelegationSchema.parse(await readJson(options.delegationPath!))) !== await contentDigest(accepted.delegation))) throw new Error('Agent output/receipt changed during export');
    if (!await verifyRevisionDigest(source) || !await verifyRevisionDigest(score)) throw new Error('Adapter mutated the immutable source/score during export');
    options.signal?.throwIfAborted();
  }
  const store = dependencies.store ?? new PublicationStore(options.storeRoot);
  const id = publicationId(score.revision.digest);
  const previous = await store.get(id);
  if (previous) {
    await assertInputsUnchanged();
    const m = previous.manifest;
    if (sha256(previous.score) !== sha256(jsonBytes(score)) || m.title !== run.title || m.sourceUrl !== run.sourceUrl || m.createdAt !== run.createdAt || m.agent?.taskId !== accepted?.delegation.taskId || m.agent?.model !== accepted?.delegation.model) throw new Error('Existing publication does not match this exact prepared run');
    // Reuse the verified immutable bytes, not a fresh time-dependent PDF under the same ID.
    return { id, status: m.status, revision: m.revision, directory: join(store.root, id), reused: true, links: publicationLinks(options.baseUrl, id), manifestPath: join(store.root, id, 'manifest.json') };
  }
  options.signal?.throwIfAborted();
  const projection = AdapterProjectionSchema.parse(await dependencies.scoreAdapter.project(draft));
  if (projection.scoreRevision.id !== score.revision.id || projection.scoreRevision.digest !== score.revision.digest) throw new Error('Adapter projected a stale/wrong score revision');
  const artifacts = {} as Record<'pdf' | 'midi', Artifact>;
  for (const format of ['pdf', 'midi'] as const) {
    options.signal?.throwIfAborted();
    const artifact = await dependencies.scoreAdapter.exportArtifact(source, draft, format, options.signal);
    await checkArtifactManifest(artifact.manifest, score, format, artifact.bytes, projection.mapping.length);
    if (artifact.mediaType !== (format === 'pdf' ? 'application/pdf' : 'audio/midi')) throw new Error('Artifact MIME mismatch');
    if (artifact.manifest.validationVersion !== report.validatorVersion || artifact.manifest.review !== 'unreviewed-draft') throw new Error('Unexpected validator/review claim from adapter');
    artifacts[format] = artifact;
  }
  // Close source/request/plan file races after the potentially lengthy exports.
  await assertInputsUnchanged();
  // This entry point creates unapproved drafts only; no human-review receipt is invented.
  const label = 'unreviewed-draft';
  const notes = [
    `# ${run.title}`, '', `Status: ${label}. Human melody audition, movement calibration and guitarist review remain pending.`,
    `Source: ${run.sourceUrl}`, `Source revision: ${source.revision.id} / ${source.revision.digest}`,
    `Score revision: ${score.revision.id} / ${score.revision.digest}`,
    `Difficulty: ${score.preferences.difficulty}; standard tuning; capo ${score.instrument.capo}; sounding key preserved.`,
    `Form: ${score.bars.length} written bars / ${score.occurrences.length} performed occurrences / ${score.performedSounds.length} attacks.`,
    `Capo comparison: ${JSON.stringify(score.capoComparison)}`,
    accepted ? `Agent: ${accepted.delegation.provider}/${accepted.delegation.model}; task ${accepted.delegation.taskId}; call ${accepted.delegation.callId}; transport project-subagent (not an HTTP planner); called ${accepted.delegation.calledAt}; exact response SHA-256 ${accepted.delegation.responseDigest}.` : 'Planner: deterministic fallback. No model-authored arrangement claim.',
    '', '## Plan decisions', ...plan.candidates.map((c) => `- ${c.id} (${c.role}, ${c.sourceEventIds.join(', ')}): ${c.reason}`),
    '', '## Engine adaptation audit', ...score.changes.map((c) => `- ${c.kind} (${c.role}, ${c.sourceEventIds.join(', ')}): ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}. ${c.reason}`),
    '', '## Validation / limitations', ...[...result.diagnostics, ...report.diagnostics].map((d) => `- ${d.severity}: ${d.message}`),
    'Software hard checks and PDF/MIDI export integrity are not human musical approval or independent full-song artifact acceptance.', '',
  ].join('\n');
  const files = { score: jsonBytes(score), pdf: artifacts.pdf.bytes, midi: artifacts.midi.bytes, notes: new TextEncoder().encode(notes) };
  const manifest = PublicationManifestSchema.parse({
    schemaVersion: 1, id: publicationId(score.revision.digest), title: run.title, sourceUrl: run.sourceUrl, createdAt: run.createdAt,
    revision: { id: score.revision.id, digest: score.revision.digest },
    files: { score: 'score.json', pdf: 'arrangement.pdf', midi: 'arrangement.mid', notes: 'notes.md' }, status: label,
    agent: accepted ? { model: accepted.delegation.model, taskId: accepted.delegation.taskId } : null,
    integrity: { score: sha256(files.score), pdf: sha256(files.pdf), midi: sha256(files.midi), notes: sha256(files.notes) },
    artifacts: { pdf: artifacts.pdf.manifest, midi: artifacts.midi.manifest },
  });
  const bundle: PublicationBundle = { manifest, ...files };
  const installed = await store.install(bundle, options.signal ? { signal: options.signal } : {});
  return { id: manifest.id, status: manifest.status, revision: manifest.revision, directory: installed.directory, reused: installed.reused, links: publicationLinks(options.baseUrl, manifest.id), manifestPath: join(installed.directory, 'manifest.json') };
}

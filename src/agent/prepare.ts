import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { ArrangementRequestSchema, contentDigest, DigestSchema, ImportResultSchema, MelodySelectionSchema, PlannerProvenanceSchema, PlanSchema, RevisionRefSchema, revisionDigest, SourceScoreV1Schema, verifyRevisionDigest } from '../domain';
import type { Preferences, SourceAdapter } from '../domain';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../source';
import { createDefaultRequest, deterministicPlanner } from '../engine';
import { musicianBrief } from './brief';
import { hasCode, jsonBytes, privateDirectory, readJson, sha256 } from './files';
import { validatePlan } from './plan';

export const PreparedRunSchema = z.strictObject({
  schemaVersion: z.literal(1), runId: z.string().uuid(), projectId: z.string().min(1), scoreRevisionId: z.string().min(1),
  createdAt: z.iso.datetime(), title: z.string().trim().min(1).max(300), sourceUrl: z.url(),
  sourceRevision: RevisionRefSchema, requestDigest: DigestSchema, baselinePlanDigest: DigestSchema, briefDigest: DigestSchema,
});
export type PreparedRun = z.infer<typeof PreparedRunSchema>;
export type PrepareOptions = {
  sourceUrl: string; difficulty: Preferences['difficulty']; capo: Preferences['capo'];
  title?: string; runsRoot?: string; signal?: AbortSignal;
};
export type PrepareDependencies = { sourceAdapter?: SourceAdapter; now?: () => Date };

export async function prepareArrangement(options: PrepareOptions, dependencies: PrepareDependencies = {}) {
  const root = resolve(options.runsRoot ?? '.agent-runs');
  await privateDirectory(root);
  const runId = randomUUID();
  const staging = join(root, `.preparing-${runId}`);
  const directory = join(root, runId);
  await mkdir(staging, { mode: 0o700 });
  try {
    await mkdir(join(staging, 'raw'), { mode: 0o700 });
    const adapter = dependencies.sourceAdapter ?? createSongsterrSourceAdapter({
      saveArtifact: async ({ descriptor, bytes }) => {
        if (sha256(bytes) !== descriptor.sha256 || bytes.byteLength !== descriptor.byteLength) throw new Error('Raw artifact digest/length mismatch');
        const path = join(staging, 'raw', DigestSchema.parse(descriptor.sha256));
        try { await writeFile(path, bytes, { flag: 'wx', mode: 0o600 }); }
        catch (error) { if (!hasCode(error, 'EEXIST')) throw error; }
      },
    });
    const imported = ImportResultSchema.parse(await adapter.import({ kind: 'songsterr-url', url: options.sourceUrl }, options.signal));
    if (imported.status !== 'source-ready') throw new Error(`Import ${imported.status}: ${imported.diagnostics.map((d) => d.message).join('; ')}`);
    if (!await verifyRevisionDigest(imported.source)) throw new Error('Imported source digest mismatch; refusing to stamp corrupt source');
    options.signal?.throwIfAborted();
    // Orchestration, not the provider/engine, allocates canonical identity.
    const source = SourceScoreV1Schema.parse({ ...imported.source, revision: { id: `source-${randomUUID()}`, parentId: null, digest: '0'.repeat(64) } });
    source.revision.digest = await revisionDigest(source);
    const proposal = createDefaultMelodySelection(source);
    if (proposal.status !== 'proposed') throw new Error(`selection-needed: ${proposal.diagnostics.map((d) => d.message).join('; ')}`);
    const defaults = createDefaultRequest(source, proposal.selection, options.difficulty);
    const request = ArrangementRequestSchema.parse({ ...defaults, preferences: { ...defaults.preferences, capo: options.capo } });
    const baseline = await deterministicPlanner.plan(source, request, options.signal);
    validatePlan(baseline.plan, source);
    const brief = musicianBrief(source, request, baseline.plan);
    const identity = source.manifest.identity;
    const sourceUrl = identity.kind === 'songsterr' ? identity.url : options.sourceUrl;
    const title = options.title ?? new URL(sourceUrl).pathname.split('/').at(-1)!.replace(/-tab-s\d+.*$/i, '').replaceAll('-', ' ');
    const run = PreparedRunSchema.parse({
      schemaVersion: 1, runId, projectId: `project-${randomUUID()}`, scoreRevisionId: `revision-${randomUUID()}`,
      createdAt: (dependencies.now?.() ?? new Date()).toISOString(), title, sourceUrl,
      sourceRevision: { id: source.revision.id, digest: source.revision.digest },
      requestDigest: await contentDigest(request), baselinePlanDigest: await contentDigest(baseline.plan), briefDigest: sha256(brief),
    });
    const documents = { 'run.json': run, 'source.json': source, 'selection.json': proposal.selection, 'request.json': request, 'baseline-plan.json': baseline.plan, 'baseline-provenance.json': baseline.provenance, 'selection-proposal.json': proposal, 'import-diagnostics.json': imported.diagnostics };
    for (const [name, document] of Object.entries(documents)) await writeFile(join(staging, name), jsonBytes(document), { flag: 'wx', mode: 0o600 });
    await writeFile(join(staging, 'brief.md'), brief, { flag: 'wx', mode: 0o600 });
    options.signal?.throwIfAborted();
    await rename(staging, directory);
    return { directory, run, briefPath: join(directory, 'brief.md'), baselinePlanPath: join(directory, 'baseline-plan.json') };
  } catch (error) {
    await rm(staging, { recursive: true, force: true }); // Only this invocation's owned staging directory.
    throw error;
  }
}

export async function loadPreparedRun(directory: string) {
  const run = PreparedRunSchema.parse(await readJson(join(directory, 'run.json')));
  const source = SourceScoreV1Schema.parse(await readJson(join(directory, 'source.json')));
  const request = ArrangementRequestSchema.parse(await readJson(join(directory, 'request.json')));
  const selection = MelodySelectionSchema.parse(await readJson(join(directory, 'selection.json')));
  const baseline = PlanSchema.parse(await readJson(join(directory, 'baseline-plan.json')));
  const baselineProvenance = PlannerProvenanceSchema.parse(await readJson(join(directory, 'baseline-provenance.json')));
  if (!await verifyRevisionDigest(source) || source.revision.id !== run.sourceRevision.id || source.revision.digest !== run.sourceRevision.digest) throw new Error('Prepared source revision/digest mismatch');
  if (request.sourceRevision.id !== source.revision.id || request.sourceRevision.digest !== source.revision.digest || await contentDigest(request) !== run.requestDigest || await contentDigest(selection) !== await contentDigest(request.selection)) throw new Error('Prepared request/selection mismatch; prepare again after changing preferences or melody');
  if (await contentDigest(baseline) !== run.baselinePlanDigest || sha256(await readFile(join(directory, 'brief.md'))) !== run.briefDigest) throw new Error('Prepared baseline/brief mismatch');
  if (source.manifest.identity.kind === 'songsterr' && source.manifest.identity.url !== run.sourceUrl) throw new Error('Prepared source URL mismatch');
  // Recompute instead of trusting a locally relabeled baseline provenance or changed plan.
  const deterministic = await deterministicPlanner.plan(source, request);
  if (await contentDigest(deterministic.plan) !== run.baselinePlanDigest || await contentDigest(deterministic.provenance) !== await contentDigest(baselineProvenance)) throw new Error('Deterministic baseline provenance/content mismatch');
  validatePlan(baseline, source);
  return { run, source, request, baseline, baselineProvenance };
}

export type LoadedRun = Awaited<ReturnType<typeof loadPreparedRun>>;

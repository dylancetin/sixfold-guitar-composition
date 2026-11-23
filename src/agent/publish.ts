import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AdapterProjectionSchema, contentDigest, GUITAR_TUNINGS, guitarTuningId, ValidatedScoreV1Schema, revisionDigest, ScoreV1Schema, verifyRevisionDigest } from '../domain';
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
  const selectedSourceIds = new Set(request.selection.sections.flatMap((section) => section.selectors.flatMap((selector) => selector.eventIds)));
  const selectedArticulations = [...new Set(source.events.flatMap((event) => event.kind === 'note' && selectedSourceIds.has(event.id) ? event.effects.filter((effect) => effect.code.startsWith('articulation-')).map((effect) => effect.code) : []))].sort();
  const simplifiedBendIds = source.events.filter((event) => selectedSourceIds.has(event.id) && event.kind === 'note' && event.effects.some((effect) => effect.code === 'source-bend-simplified')).map((event) => event.id);
  // Opt-in ornament simplifications and display-only spelling hints on every source note this arrangement uses.
  const usedSourceIds = new Set([...selectedSourceIds, ...score.sounds.flatMap((sound) => sound.provenance.kind === 'source' ? sound.provenance.eventIds : sound.provenance.evidenceEventIds)]);
  const simplifiedOrnaments = new Map<string, { melody: string[]; accompaniment: string[] }>();
  const spellingHintIds: string[] = [];
  for (const event of source.events) {
    if (event.kind !== 'note' || !usedSourceIds.has(event.id)) continue;
    for (const effect of event.effects) {
      if (effect.code === 'source-ornament-simplified') {
        const field = (() => { try { return String((JSON.parse(effect.description) as { field?: unknown }).field ?? 'ornament'); } catch { return 'ornament'; } })();
        const entry = simplifiedOrnaments.get(field) ?? { melody: [], accompaniment: [] };
        (selectedSourceIds.has(event.id) ? entry.melody : entry.accompaniment).push(event.id);
        simplifiedOrnaments.set(field, entry);
      }
    }
    if (event.effects.some((effect) => effect.code.startsWith('source-notation-spn') || effect.code.startsWith('source-notation-courtesyAccidental'))) spellingHintIds.push(event.id);
  }
  const ornamentNames: Record<string, string> = { slide: 'slide-in/slide-out glides', leftHandVibrato: 'vibrato', vibratoWithTremoloBar: 'tremolo-bar vibrato', letRing: 'let-ring sustain beyond the written duration' };
  const sourceGraceIds = new Set(source.events.filter((event) => event.kind === 'note' && event.effects.some((effect) => effect.code === 'source-grace')).map((event) => event.id));
  const retainedGraceSoundIds = new Set(score.sounds.filter((sound) => (sound.provenance.kind === 'source' ? sound.provenance.eventIds : sound.provenance.evidenceEventIds).some((id) => sourceGraceIds.has(id))).map((sound) => sound.id));
  const retainedGraceAttacks = score.performedSounds.filter((sound) => retainedGraceSoundIds.has(sound.soundId)).length;
  const sourceCapoParts = source.parts.filter((part) => source.events.some((event) => event.partId === part.id && event.kind === 'note' && event.effects.some((effect) => effect.code === 'source-capo')));
  const notes = [
    `# ${run.title}`, '', `Status: ${label}. Human melody audition, movement calibration and guitarist review remain pending.`,
    `Source: ${run.sourceUrl}`, `Source revision: ${source.revision.id} / ${source.revision.digest}`,
    `Score revision: ${score.revision.id} / ${score.revision.digest}`,
    `Difficulty: ${score.preferences.difficulty}; ${GUITAR_TUNINGS[guitarTuningId(score.instrument.tuning) ?? 'standard'].label.toLowerCase()} (${GUITAR_TUNINGS[guitarTuningId(score.instrument.tuning) ?? 'standard'].strings}); capo ${score.instrument.capo}; sounding key preserved.`,
    `Form: ${score.bars.length} written bars / ${score.occurrences.length} performed occurrences / ${score.performedSounds.length} attacks.`,
    `Capo comparison: ${JSON.stringify(score.capoComparison)}`,
    accepted ? `Agent: ${accepted.delegation.provider}/${accepted.delegation.model}; task ${accepted.delegation.taskId}; call ${accepted.delegation.callId}; transport project-subagent (not an HTTP planner); called ${accepted.delegation.calledAt}; exact response SHA-256 ${accepted.delegation.responseDigest}.` : 'Planner: deterministic fallback. No model-authored arrangement claim.',
    '', '## Source interpretation / melody selection',
    ...(simplifiedBendIds.length ? [`- EXPLICIT SIMPLIFIED MELODY: bent source notes ${simplifiedBendIds.join(', ')} retain only their notated starting pitch and exact metrical duration. Vocal scoop/bend pitch motion is intentionally omitted for this practical draft, not reproduced in notation or MIDI. Raw curves remain in the private source. Software checks preserve this disclosed simplified interpretation, not the full expressive original.`] : []),
    ...('unversionedPartIds' in source.manifest.identity ? [`- Source parts ${source.manifest.identity.unversionedPartIds.join(', ')} omit upstream format-version metadata. Their full musical structure was validated without inventing a version; the manifest's declared formatVersion applies to the other versioned parts. Exact raw artifacts remain private.`] : []),
    ...(sourceCapoParts.length ? [`- Source capo offsets in parts ${sourceCapoParts.map((part) => part.id).join(', ')} are already materialized once in canonical sounding pitches. Original tuning/capo/relative frets remain in private raw source artifacts. The arrangement capo ${score.instrument.capo} is a separate fingering choice, not an additional source-pitch transposition.`] : []),
    ...request.selection.sections.map((section) => `- ${section.label}: ${section.selectors.length ? section.selectors.map((selector) => `part ${selector.partId}/${selector.voiceId} (${source.parts.find((part) => part.id === selector.partId)?.name ?? 'source identity'})`).join(', ') : 'explicit source-grounded silence'}.`),
    ...(request.selection.sections.some((section) => section.label.includes('fallback line')) ? ['- Instrumental fallback is an unapproved choice of an existing source line, not established orchestral-foreground fidelity. Its contour and grace timing can differ materially from another instrument. Selected-voice silence does not establish ensemble silence. Audition these choices; no high line was transposed to manufacture a replacement.'] : []),
    ...(sourceGraceIds.size ? [`- Imported source: ${sourceGraceIds.size} grace attacks preserved in the private source using source-player bounded time borrowing, with raw nominal fractions and separate pitches retained. This arrangement retains ${retainedGraceAttacks} source-derived grace attacks across its performed roles. Retained grace-derived attacks are engraved as realized note values, not small-note ornamental glyphs; any accompaniment adaptations are audited below.`] : []),
    ...[...simplifiedOrnaments].sort(([a], [b]) => a.localeCompare(b)).map(([field, ids]) => `- EXPLICIT SIMPLIFIED DRAFT (--simplify-ornaments): ${ornamentNames[field] ?? field} NOT reproduced on ${ids.melody.length} melody and ${ids.accompaniment.length} accompaniment source notes used here${ids.melody.length ? ` (melody: ${ids.melody.slice(0, 12).join(', ')}${ids.melody.length > 12 ? ', …' : ''})` : ''}. Notated pitch, onset and exact metrical duration are preserved; this is not exact expressive source fidelity.`),
    ...(spellingHintIds.length ? [`- Source display spelling hints (spn/courtesyAccidental) on ${spellingHintIds.length} used source notes (${spellingHintIds.slice(0, 8).join(', ')}${spellingHintIds.length > 8 ? ', …' : ''}) are retained privately but not reproduced in engraving; sounding pitch is unaffected.`] : []),
    ...(selectedArticulations.length ? [`- Selected source articulations retained in the private source: ${selectedArticulations.join(', ')}. Draft engraving/audio preserve nominal metrical pitches/durations but do not reproduce expressive legato/staccato/velocity/ghost articulation. This is not an expressive source-performance transcription.`] : []),
    ...(selectedArticulations.includes('articulation-closed-slide') ? ['- Closed legato/shift slides are a nominal endpoint transcription: the explicit contiguous source-note pitches and metrical onsets/releases are preserved. Continuous glides and slide glyphs are not reproduced. Unknown/open-ended slides remain unsupported and are not silently flattened.'] : []),
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

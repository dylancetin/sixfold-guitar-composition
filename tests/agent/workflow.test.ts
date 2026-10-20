import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AdapterProjectionSchema, canonicalJson, contentDigest, revisionDigest } from '../../src/domain';
import type { Artifact, Plan, ScoreAdapter, SourceAdapter } from '../../src/domain';
import { guitarEngine } from '../../src/engine';
import { acceptAgentPlan, loadPreparedRun, prepareArrangement, publishArrangement } from '../../src/agent';
import { arrangeBounded } from '../../src/agent/engine';
import { jsonBytes, sha256 } from '../../src/agent/files';
import { PublicationIdSchema, PublicationManifestSchema, publicationLinks } from '../../src/publication';
import { PublicationStore, readPublication, validatePublicationBundle } from '../../src/publication/store';
import { source as original } from '../fixtures/original';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function root() { const directory = await mkdtemp('/tmp/opencode/agent-workflow-test-'); directories.push(directory); return directory; }
const sourceAdapter: SourceAdapter = { async import() { return { status: 'source-ready', source: structuredClone(original), diagnostics: [] }; } };
async function prepared(directory: string) {
  return prepareArrangement({ sourceUrl: 'https://example.test/original-study', title: 'Original storage test study', difficulty: 'intermediate', capo: { mode: 'recommend', compare: [0, 2] }, runsRoot: join(directory, 'runs') }, { sourceAdapter });
}

/** Deliberate STORAGE test double. These bytes are NOT renderer/PDF/MIDI acceptance evidence. */
function storageAdapterDouble(options: { failMidi?: boolean; wrongDigest?: boolean; wrongScore?: boolean } = {}): ScoreAdapter {
  return {
    async project({ score }) {
      return AdapterProjectionSchema.parse({
        schemaVersion: 1, scoreRevision: { id: score.revision.id, digest: score.revision.digest }, form: 'unfolded-no-repeat-commands',
        engraving: { partCount: 1, staffAndTab: true, writtenOctaveOffset: 12, bars: score.occurrences.map((o) => ({ occurrenceId: o.id, writtenBarId: o.writtenBarId, pass: o.pass, label: o.id })) },
        mapping: score.notation.flatMap((n) => score.occurrences.filter((o) => o.writtenBarId === n.barId).map((o) => ({ eventId: n.eventId, segmentId: n.id, occurrenceId: o.id, nativeBeatId: `test-${n.id}-${o.id}`, nativeNoteId: null }))),
        playback: { activeProjection: 'role-separated-only', tracks: [{ role: 'melody', channel: 0, program: 24 }, { role: 'bass', channel: 1, program: 24 }, { role: 'harmony', channel: 2, program: 24 }], events: score.performedSounds.map((p) => { const s = score.sounds.find((s) => s.id === p.soundId)!; return { performedSoundId: p.id, soundId: p.soundId, occurrenceId: p.attackOccurrenceId, role: s.role, soundingMidi: s.soundingMidi, start: p.start, duration: p.duration }; }) },
      });
    },
    async exportArtifact(source, draft, format) {
      if (format === 'midi' && options.failMidi) throw new Error('Injected interrupted MIDI export');
      const score = draft.score;
      const bytes = new TextEncoder().encode(format === 'pdf' ? '%PDF-1.4\nSTORAGE TEST DOUBLE ONLY\n%%EOF\n' : 'MThd000000STORAGE TEST DOUBLE ONLY MTrk');
      const artifact: Artifact = {
        bytes, mediaType: format === 'pdf' ? 'application/pdf' : 'audio/midi', filename: `test.${format}`,
        manifest: { schemaVersion: 1, scoreRevision: { id: options.wrongScore ? 'different-score' : score.revision.id, digest: score.revision.digest }, sourceRevision: { id: source.revision.id, digest: source.revision.digest }, ability: { id: score.ability.id, version: score.ability.version }, adapter: { name: 'storage-test-double-NOT-renderer', version: '1' }, format, artifactDigest: options.wrongDigest ? '0'.repeat(64) : sha256(bytes), byteLength: bytes.byteLength, occurrenceCount: score.occurrences.length, soundingAttackCount: score.performedSounds.length, notationSegmentCount: (await this.project(draft)).mapping.length, review: 'unreviewed-draft', validationVersion: draft.validation.validatorVersion, tuning: score.instrument.tuning, capo: score.instrument.capo, midiPitchPolicy: 'already-sounding-no-capo-offset' },
      };
      return artifact;
    },
  };
}

test('prepare stamps canonical source before selection and emits actual intervals, source evidence and honest baseline', async () => {
  const directory = await root();
  const result = await prepared(directory);
  const loaded = await loadPreparedRun(result.directory);
  expect(loaded.source.revision.id).not.toBe(original.revision.id);
  expect(loaded.source.revision.digest).toBe(await revisionDigest(loaded.source));
  expect(loaded.request.selection.sourceRevision).toEqual(loaded.run.sourceRevision);
  expect(loaded.request.preferences).toMatchObject({ difficulty: 'intermediate', capo: { mode: 'recommend', compare: [0, 2] }, transposition: { mode: 'preserve', semitones: 0 } });
  expect(loaded.baselineProvenance.mode).toBe('deterministic-fallback');
  const brief = await readFile(result.briefPath, 'utf8');
  expect(brief).toContain('src-m1'); expect(brief).toContain('5/3'); expect(brief).toContain('src-b0: 40'); expect(brief).toContain('src-h0: 59'); expect(brief).toContain('human playability');
  expect(await readFile(join(directory, 'runs', '.gitignore'), 'utf8')).toBe('*\n');
});

test('corrupt source is not laundered by canonical identity stamping; failed imports leave no ready run', async () => {
  const directory = await root();
  const corrupt = structuredClone(original); corrupt.events[0]!.duration = { n: 2, d: 1 };
  const bad: SourceAdapter = { async import() { return { status: 'source-ready', source: corrupt, diagnostics: [] }; } };
  await expect(prepareArrangement({ sourceUrl: 'https://example.test/study', difficulty: 'intermediate', capo: { mode: 'chosen', value: 0 }, runsRoot: directory }, { sourceAdapter: bad })).rejects.toThrow('Imported source digest mismatch');
  expect((await readdir(directory)).filter((name) => name !== '.gitignore')).toEqual([]);
});

test('plan boundary rejects unknown source IDs and fake response digest, and accepts exact-byte synthetic receipt only as a unit test', async () => {
  const directory = await root();
  const run = await prepared(directory);
  const loaded = await loadPreparedRun(run.directory);
  const plan: Plan = { version: 'storage-boundary-fixture', candidates: [{ id: 'bass-subset', role: 'bass', sourceEventIds: ['src-b0'], octaveShift: 0, density: 'sparse', reason: 'Original fixture: E bass retained under held E melody; testing a strict subset, not live musical authorship.' }] };
  const bytes = jsonBytes(plan);
  const receipt = { schemaVersion: 1, transport: 'project-subagent', provider: 'test-fixture-NOT-live', model: 'synthetic-receipt-NOT-a-model-call', taskId: 'fixture-task-NOT-live', callId: 'fixture-call-NOT-live', calledAt: '2026-10-20T00:00:00Z', responseDigest: sha256(bytes), sourceRevision: loaded.run.sourceRevision, requestDigest: loaded.run.requestDigest };
  const accepted = await acceptAgentPlan({ bytes, delegation: receipt, source: loaded.source, requestDigest: loaded.run.requestDigest, baseline: loaded.baseline });
  expect(accepted.provenance).toMatchObject({ mode: 'configured-llm', responseDigest: sha256(bytes), acceptedCandidateIds: ['bass-subset'] });
  await expect(acceptAgentPlan({ bytes: new TextEncoder().encode(`${JSON.stringify(plan)}\n\n`), delegation: receipt, source: loaded.source, requestDigest: loaded.run.requestDigest, baseline: loaded.baseline })).rejects.toThrow('exact raw');
  const bad = jsonBytes({ ...plan, candidates: [{ ...plan.candidates[0], sourceEventIds: ['invented-note'] }] });
  await expect(acceptAgentPlan({ bytes: bad, delegation: { ...receipt, responseDigest: sha256(bad) }, source: loaded.source, requestDigest: loaded.run.requestDigest, baseline: loaded.baseline })).rejects.toThrow('Unknown/non-note');
  const renamed = jsonBytes({ ...loaded.baseline, version: 'pretend-ai', candidates: loaded.baseline.candidates.map((c) => ({ ...c, id: `renamed-${c.id}`, reason: 'AI renamed this' })) });
  await expect(acceptAgentPlan({ bytes: renamed, delegation: { ...receipt, responseDigest: sha256(renamed) }, source: loaded.source, requestDigest: loaded.run.requestDigest, baseline: loaded.baseline })).rejects.toThrow('Baseline-equivalent');
  await expect(acceptAgentPlan({ bytes, delegation: { ...receipt, requestDigest: '0'.repeat(64) }, source: loaded.source, requestDigest: loaded.run.requestDigest, baseline: loaded.baseline })).rejects.toThrow('different source/request');
});

test('immutable storage publication is complete, digest-bound, replay-safe and returns absolute deep links (test-double exports)', async () => {
  const directory = await root();
  const run = await prepared(directory);
  const options = { runDirectory: run.directory, baseUrl: 'https://guitar.example.test', storeRoot: join(directory, 'published'), baseline: true };
  const result = await publishArrangement(options, { scoreAdapter: storageAdapterDouble() });
  expect(result.status).toBe('unreviewed-draft');
  expect(result.links.pdf).toBe(`https://guitar.example.test/arrangements/${result.id}/arrangement.pdf`);
  const bundle = await readPublication(options.storeRoot, result.id);
  expect(bundle.manifest.agent).toBeNull();
  expect((await validatePublicationBundle(bundle)).projectId).toBe(run.run.projectId);
  expect((await readdir(result.directory)).sort()).toEqual(['arrangement.mid', 'arrangement.pdf', 'manifest.json', 'notes.md', 'score.json']);
  const replay = await publishArrangement(options, { scoreAdapter: storageAdapterDouble({ failMidi: true }) });
  expect(replay.reused).toBe(true); expect(replay.id).toBe(result.id);
  expect(await readFile(join(result.directory, 'arrangement.pdf'))).toEqual(Buffer.from(bundle.pdf));
  const altered = structuredClone(bundle); altered.manifest.title = 'Do not overwrite immutable metadata';
  await expect(new PublicationStore(options.storeRoot).install(altered)).rejects.toThrow('Immutable publication');
  expect(await readPublication(options.storeRoot, result.id)).toEqual(bundle);
});

test('failed/partial/wrong-score/wrong-digest exports never install a bundle', async () => {
  const directory = await root();
  const run = await prepared(directory);
  const options = { runDirectory: run.directory, baseUrl: 'http://localhost:3000', storeRoot: join(directory, 'published'), baseline: true };
  for (const flags of [{ failMidi: true }, { wrongScore: true }, { wrongDigest: true }]) {
    await expect(publishArrangement(options, { scoreAdapter: storageAdapterDouble(flags), engine: guitarEngine })).rejects.toThrow();
    expect(await new PublicationStore(options.storeRoot).get(`arr-${'0'.repeat(64)}`)).toBeNull();
  }
  expect(await Bun.file(join(options.storeRoot, '.gitignore')).exists()).toBe(false);
});

test('publisher binds the actual model-file branch to its exact synthetic test receipt without claiming a live call', async () => {
  const directory = await root(); const run = await prepared(directory); const loaded = await loadPreparedRun(run.directory);
  const plan: Plan = { version: 'synthetic-agent-branch-test', candidates: [{ id: 'test-e-bass', role: 'bass', sourceEventIds: ['src-b0'], octaveShift: 0, density: 'sparse', reason: 'Original technical study unit test only: retain E bass, omit other candidates; not live AI musical evidence.' }] };
  const bytes = jsonBytes(plan);
  const planPath = join(run.directory, 'test-plan.json'), delegationPath = join(run.directory, 'test-delegation.json');
  await writeFile(planPath, bytes);
  await writeFile(delegationPath, jsonBytes({ schemaVersion: 1, transport: 'project-subagent', provider: 'test-only-NOT-live', model: 'test-only-NOT-live', taskId: 'synthetic-test-task-NOT-live', callId: 'synthetic-test-call-NOT-live', calledAt: '2026-10-20T00:00:00Z', responseDigest: sha256(bytes), sourceRevision: loaded.run.sourceRevision, requestDigest: loaded.run.requestDigest }));
  const result = await publishArrangement({ runDirectory: run.directory, baseUrl: 'https://viewer.test', planPath, delegationPath, storeRoot: join(directory, 'published') }, { scoreAdapter: storageAdapterDouble(), engine: guitarEngine });
  const bundle = await readPublication(join(directory, 'published'), result.id);
  expect(bundle.manifest.agent).toEqual({ model: 'test-only-NOT-live', taskId: 'synthetic-test-task-NOT-live' });
  expect((await validatePublicationBundle(bundle)).planner).toMatchObject({ mode: 'configured-llm', responseDigest: sha256(bytes), callId: 'synthetic-test-call-NOT-live' });
  expect(new TextDecoder().decode(bundle.notes)).toContain('transport project-subagent (not an HTTP planner)');
});

test('independent validation rejects a restamped physically corrupt engine candidate', async () => {
  const directory = await root(); const run = await prepared(directory);
  const engine: typeof guitarEngine = { arrange(...args) {
    const result = guitarEngine.arrange(...args);
    if (result.status === 'candidate') {
      result.score.placements.find((p) => p.fret > 0)!.fret += 1;
      // Synchronous digest helper is the engine's own canonical algorithm, not validator logic.
      const { digest: _digest, ...revision } = result.score.revision;
      result.score.revision.digest = createHash('sha256').update(canonicalJson({ ...result.score, revision })).digest('hex');
    }
    return result;
  } };
  await expect(publishArrangement({ runDirectory: run.directory, baseUrl: 'https://viewer.test', baseline: true, storeRoot: join(directory, 'published') }, { scoreAdapter: storageAdapterDouble(), engine })).rejects.toThrow('Independent validation failed');
  expect(await Bun.file(join(directory, 'published', '.gitignore')).exists()).toBe(false);
});

test('prepared input races during export cannot publish stale output and preserve an earlier valid revision', async () => {
  const directory = await root(); const first = await prepared(directory); const store = new PublicationStore(join(directory, 'published'));
  const result = await publishArrangement({ runDirectory: first.directory, baseUrl: 'https://viewer.test', baseline: true }, { scoreAdapter: storageAdapterDouble(), store, engine: guitarEngine });
  const before = await readPublication(store.root, result.id);
  const next = await prepared(directory);
  const adapter = storageAdapterDouble();
  const raced: ScoreAdapter = { project: (draft) => adapter.project(draft), async exportArtifact(source, draft, format, signal) {
    const artifact = await adapter.exportArtifact(source, draft, format, signal);
    if (format === 'midi') {
      const loaded = await loadPreparedRun(next.directory); loaded.request.preferences.tempoScale = 0.75;
      await writeFile(join(next.directory, 'request.json'), jsonBytes(loaded.request));
    }
    return artifact;
  } };
  await expect(publishArrangement({ runDirectory: next.directory, baseUrl: 'https://viewer.test', baseline: true }, { scoreAdapter: raced, store, engine: guitarEngine })).rejects.toThrow('request/selection');
  expect(await readPublication(store.root, result.id)).toEqual(before);
  expect((await readdir(store.root)).filter((name) => name.startsWith('arr-'))).toEqual([result.id]);
});

test('interrupted durable staging preserves last published revision and exposes no partial directory', async () => {
  const directory = await root(); const run = await prepared(directory);
  const store = new PublicationStore(join(directory, 'published'));
  const result = await publishArrangement({ runDirectory: run.directory, baseUrl: 'http://localhost:3000', baseline: true }, { scoreAdapter: storageAdapterDouble(), store, engine: guitarEngine });
  const previous = await readPublication(store.root, result.id);
  const candidate = structuredClone(previous);
  const score = JSON.parse(new TextDecoder().decode(candidate.score));
  score.revision.id = 'second-owned-revision'; score.revision.digest = await revisionDigest(score);
  candidate.score = jsonBytes(score); candidate.manifest.revision = { id: score.revision.id, digest: score.revision.digest }; candidate.manifest.id = `arr-${score.revision.digest}`;
  candidate.manifest.integrity!.score = sha256(candidate.score);
  for (const format of ['pdf', 'midi'] as const) candidate.manifest.artifacts![format].scoreRevision = candidate.manifest.revision;
  await expect(store.install(candidate, { beforeCommit: async () => { throw new Error('Injected interruption after staging'); } })).rejects.toThrow('Injected interruption');
  expect(await store.get(candidate.manifest.id)).toBeNull();
  expect(await readdir(store.root)).toEqual(expect.arrayContaining([result.id]));
  expect((await readdir(store.root)).filter((name) => name.startsWith('.staging') || name.startsWith('.lock'))).toEqual([]);
  expect(await readPublication(store.root, result.id)).toEqual(previous);
});

test('unsafe IDs, wrong path IDs, tampered artifacts, stale manifests and symlink files fail closed', async () => {
  const directory = await root(); const run = await prepared(directory);
  const result = await publishArrangement({ runDirectory: run.directory, baseUrl: 'https://viewer.test', storeRoot: join(directory, 'published'), baseline: true }, { scoreAdapter: storageAdapterDouble(), engine: guitarEngine });
  const bundle = await readPublication(join(directory, 'published'), result.id);
  for (const id of ['../x', 'arr-../../x', '%2e%2e', '/etc/passwd', `arr-${'a'.repeat(64)}/score.json`]) {
    expect(PublicationIdSchema.safeParse(id).success).toBe(false);
    await expect(readPublication(join(directory, 'published'), id)).rejects.toThrow();
  }
  expect(PublicationManifestSchema.safeParse({ ...bundle.manifest, id: `arr-${'0'.repeat(64)}` }).success).toBe(false);
  const stale = structuredClone(bundle); stale.manifest.revision.id = 'wrong-score';
  await expect(validatePublicationBundle(stale)).rejects.toThrow('revision/digest');
  const dishonest = structuredClone(bundle); dishonest.manifest.agent = { model: 'imaginary-AI', taskId: 'invented' };
  await expect(validatePublicationBundle(dishonest)).rejects.toThrow('provenance');
  await writeFile(join(result.directory, 'arrangement.mid'), 'corrupt');
  await expect(readPublication(join(directory, 'published'), result.id)).rejects.toThrow('integrity');
  await rm(join(result.directory, 'arrangement.mid'));
  const external = join(directory, 'external.mid'); await writeFile(external, bundle.midi); await symlink(external, join(result.directory, 'arrangement.mid'));
  await expect(readPublication(join(directory, 'published'), result.id)).rejects.toThrow('Unsafe');
});

test('tampered requests/briefs invalidate prepared runs; model provenance is never inferred by publish', async () => {
  const directory = await root(); const run = await prepared(directory);
  const loaded = await loadPreparedRun(run.directory);
  await expect(publishArrangement({ runDirectory: run.directory, baseUrl: 'https://viewer.test' }, { scoreAdapter: storageAdapterDouble() })).rejects.toThrow('--baseline');
  loaded.request.preferences.capo = { mode: 'chosen', value: 2 };
  await writeFile(join(run.directory, 'request.json'), jsonBytes(loaded.request));
  await expect(loadPreparedRun(run.directory)).rejects.toThrow('request/selection');
  const second = await prepared(directory);
  await writeFile(join(second.directory, 'brief.md'), 'invented musical detail');
  await expect(loadPreparedRun(second.directory)).rejects.toThrow('baseline/brief');
});

test('URL construction refuses secrets/off-origin schemes and path bases', () => {
  const id = `arr-${'a'.repeat(64)}`;
  for (const origin of ['file:///tmp', 'javascript:alert(1)', 'https://user:secret@host', 'https://host/path', 'https://host/?token=secret']) expect(() => publicationLinks(origin, id)).toThrow();
  expect(publicationLinks('http://localhost:3000', id).viewer).toBe(`http://localhost:3000/arrangements/${id}`);
});

test('actual pure engine works through bounded worker; pre-aborted work does not start', async () => {
  const directory = await root(); const run = await prepared(directory); const loaded = await loadPreparedRun(run.directory);
  expect((await arrangeBounded(loaded.source, loaded.request, loaded.baseline, loaded.baselineProvenance)).status).toBe('candidate');
  const signal = AbortSignal.abort(new Error('Unit cancelled'));
  expect(() => arrangeBounded(loaded.source, loaded.request, loaded.baseline, loaded.baselineProvenance, signal)).toThrow('Unit cancelled');
  expect(await contentDigest(loaded.request)).toBe(loaded.run.requestDigest);
});

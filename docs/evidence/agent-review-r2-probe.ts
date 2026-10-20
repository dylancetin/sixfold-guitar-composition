import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rename, rm, rmdir, mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { contentDigest, revisionDigest, AdapterProjectionSchema, canonicalJson } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/src/domain';
import type { ScoreAdapter, Plan } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/src/domain';
import { source as original } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/tests/fixtures/original';
import { prepareArrangement, loadPreparedRun, publishArrangement, acceptAgentPlan } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/src/agent';
import { arrangeBounded } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/src/agent/engine';
import { guitarEngine } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/src/engine';
import { jsonBytes, sha256, privateDirectory } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/src/agent/files';
import { PublicationIdSchema, PublicationManifestSchema, publicationLinks } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/src/publication';
import { PublicationStore, readPublication, validatePublicationBundle } from '/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/new/src/publication/store';

const directory = await mkdtemp('/tmp/opencode/guitar-a02-independent-r2-');
const results: { id: string; outcome: string; detail?: string }[] = [];
const rejects = async (id: string, fn: () => Promise<unknown>, pattern?: RegExp) => {
  try { await fn(); } catch (error) {
    const detail = String(error);
    if (pattern) assert.match(detail, pattern);
    results.push({ id, outcome: 'rejected', detail }); return;
  }
  throw new Error(`Control unexpectedly accepted: ${id}`);
};
const prepared = await prepareArrangement({ sourceUrl: 'https://example.test/original', title: 'Independent original technical study — NOT LIVE MODEL / NOT RENDERER', difficulty: 'intermediate', capo: { mode: 'recommend', compare: [0, 2] }, runsRoot: join(directory, 'runs') }, { sourceAdapter: { async import() { return { status: 'source-ready', source: structuredClone(original), diagnostics: [] }; } } });
const run = await loadPreparedRun(prepared.directory);
assert.notEqual(run.source.revision.id, original.revision.id);
assert.deepEqual(run.source.manifest, original.manifest);
assert.deepEqual(run.request.selection.sourceRevision, run.run.sourceRevision);
assert.deepEqual(run.request.locks, []);
assert.equal(run.baselineProvenance.mode, 'deterministic-fallback');
results.push({ id: 'canonical-source-stamped-before-selection-provider-identity-unchanged', outcome: 'passed' });

// Independently authored storage doubles. Signatures deliberately do NOT prove renderer success.
let exports = 0;
const adapter: ScoreAdapter = {
  async project({ score }) {
    return AdapterProjectionSchema.parse({ schemaVersion: 1, scoreRevision: { id: score.revision.id, digest: score.revision.digest }, form: 'unfolded-no-repeat-commands', engraving: { partCount: 1, staffAndTab: true, writtenOctaveOffset: 12, bars: score.occurrences.map(o => ({ occurrenceId: o.id, writtenBarId: o.writtenBarId, pass: o.pass, label: o.id })) }, mapping: score.notation.flatMap(n => score.occurrences.filter(o => o.writtenBarId === n.barId).map(o => ({ eventId: n.eventId, segmentId: n.id, occurrenceId: o.id, nativeBeatId: `not-renderer-${n.id}-${o.id}`, nativeNoteId: null }))), playback: { activeProjection: 'role-separated-only', tracks: [{ role: 'melody', channel: 0, program: 24 }, { role: 'bass', channel: 1, program: 24 }, { role: 'harmony', channel: 2, program: 24 }], events: score.performedSounds.map(p => ({ performedSoundId: p.id, soundId: p.soundId, occurrenceId: p.attackOccurrenceId, role: score.sounds.find(s => s.id === p.soundId)!.role, soundingMidi: score.sounds.find(s => s.id === p.soundId)!.soundingMidi, start: p.start, duration: p.duration })) } });
  },
  async exportArtifact(source, draft, format) {
    exports++;
    const bytes = new TextEncoder().encode(format === 'pdf' ? `%PDF-1.4\nNOT RENDERER; independent storage control ${exports}\n` : `MThdNOT MIDI; independent storage control ${exports}`);
    const score = draft.score;
    return { bytes, mediaType: format === 'pdf' ? 'application/pdf' : 'audio/midi', filename: 'not-real-export', manifest: { schemaVersion: 1, scoreRevision: { id: score.revision.id, digest: score.revision.digest }, sourceRevision: { id: source.revision.id, digest: source.revision.digest }, ability: { id: score.ability.id, version: score.ability.version }, adapter: { name: 'independent-storage-double-NOT-renderer', version: '1' }, format, artifactDigest: sha256(bytes), byteLength: bytes.byteLength, occurrenceCount: score.occurrences.length, soundingAttackCount: score.performedSounds.length, notationSegmentCount: (await this.project(draft)).mapping.length, review: 'unreviewed-draft', validationVersion: draft.validation.validatorVersion, tuning: score.instrument.tuning, capo: score.instrument.capo, midiPitchPolicy: 'already-sounding-no-capo-offset' } };
  },
};

async function corruptFile(name: string, change: (value: any) => void, id: string) {
  const path = join(prepared.directory, name);
  const before = await readFile(path);
  try { const value = JSON.parse(before.toString()); change(value); await writeFile(path, jsonBytes(value)); await rejects(id, () => loadPreparedRun(prepared.directory)); }
  finally { await writeFile(path, before); }
}
await corruptFile('run.json', x => x.sourceRevision.id = 'wrong-source', 'corrupt-run-source-reference');
await corruptFile('run.json', x => x.requestDigest = '0'.repeat(64), 'corrupt-run-request-digest');
await corruptFile('run.json', x => x.createdAt = 'not-a-date', 'corrupt-run-structural');
await corruptFile('source.json', x => x.events[0].duration = { n: 100, d: 1 }, 'corrupt-source-not-restamped');
await corruptFile('request.json', x => x.preferences.capo = { mode: 'chosen', value: 2 }, 'corrupt-request-preferences');
await corruptFile('request.json', x => x.locks = [{ role: 'melody' }], 'corrupt-request-locks');
await corruptFile('selection.json', x => x.sourceRevision.id = 'wrong-source', 'corrupt-selection-binding');
await corruptFile('baseline-plan.json', x => x.version = 'laundered', 'corrupt-baseline-plan');
await corruptFile('baseline-provenance.json', x => x.detail = 'fabricated metadata', 'corrupt-baseline-provenance');

const subset: Plan = { version: 'independent-fixture-NOT-live', candidates: [{ id: 'review-e-bass', role: 'bass', sourceEventIds: ['src-b0'], octaveShift: 0, density: 'sparse', reason: 'Original two-bar technical fixture only; source E bass beneath E melody. NOT a live musician task.' }] };
const receiptFor = (bytes: Uint8Array) => ({ schemaVersion: 1, transport: 'project-subagent', provider: 'independent-test-NOT-live', model: 'synthetic-NOT-a-model-call', taskId: 'independent-control-NOT-live', callId: 'independent-control-NOT-live', calledAt: '2026-10-20T00:00:00Z', responseDigest: sha256(bytes), sourceRevision: run.run.sourceRevision, requestDigest: run.run.requestDigest });
async function accept(plan: unknown, receiptChange: (value: any) => void = () => {}) {
  const bytes = jsonBytes(plan); const receipt = receiptFor(bytes); receiptChange(receipt);
  return acceptAgentPlan({ bytes, delegation: receipt, source: run.source, requestDigest: run.run.requestDigest, baseline: run.baseline });
}
for (const [id, change] of [
  ['unknown-source-id', (x: any) => x.candidates[0].sourceEventIds = ['no-such-note']],
  ['rest-source-id', (x: any) => x.candidates[0].sourceEventIds = [run.source.events.find(e => e.kind === 'rest')!.id]],
  ['duplicate-candidate-id', (x: any) => x.candidates.push(structuredClone(x.candidates[0]))],
  ['duplicate-source-ref', (x: any) => x.candidates[0].sourceEventIds.push(x.candidates[0].sourceEventIds[0])],
  ['illegal-octave', (x: any) => x.candidates[0].octaveShift = 4],
  ['melody-role', (x: any) => x.candidates[0].role = 'melody'],
  ['plan-melody-edit-field', (x: any) => x.transposition = 12],
] as const) { const p = structuredClone(subset); change(p); await rejects(id, () => accept(p)); }
for (const [id, change] of [
  ['receipt-wrong-plan-digest', (x: any) => x.responseDigest = '0'.repeat(64)],
  ['receipt-wrong-source-id', (x: any) => x.sourceRevision = { ...x.sourceRevision, id: 'wrong-source' }],
  ['receipt-wrong-source-digest', (x: any) => x.sourceRevision = { ...x.sourceRevision, digest: '0'.repeat(64) }],
  ['receipt-wrong-request', (x: any) => x.requestDigest = '0'.repeat(64)],
  ['receipt-missing-task', (x: any) => delete x.taskId],
  ['receipt-extra-http-field', (x: any) => x.httpRequestId = 'invented'],
] as const) await rejects(id, () => accept(subset, change));
const raw = jsonBytes(subset);
await rejects('exact-raw-response-whitespace', () => acceptAgentPlan({ bytes: new TextEncoder().encode(new TextDecoder().decode(raw) + '\n'), delegation: receiptFor(raw), source: run.source, requestDigest: run.run.requestDigest, baseline: run.baseline }), /exact raw/);

// This is a counterfactual unit fixture, NOT a receipt for the pending actual musician task.
const retained = { ...run.baseline, version: 'source-reviewed-baseline-fixture', candidates: run.baseline.candidates.map(c => ({ ...c, id: `review-${c.id}`, reason: `After inspecting original fixture source ${c.sourceEventIds.join(',')}, retain this baseline choice; fixture for permissible independent model agreement, NOT live evidence.` })) };
const retainedAccepted = await accept(retained);
assert.deepEqual(retainedAccepted.plan, retained);
assert.equal(retainedAccepted.provenance.mode, 'configured-llm');
results.push({ id: 'FIXED-baseline-equivalent-reviewed-choices-accepted-with-bound-synthetic-receipt', outcome: 'passed', detail: 'Synthetic boundary fixture only, not actual task evidence or newly composed material.' });
const exactBaselineAccepted = await accept(run.baseline);
assert.deepEqual(exactBaselineAccepted.plan, run.baseline);
assert.deepEqual(exactBaselineAccepted.provenance.acceptedCandidateIds, run.baseline.candidates.map(c => c.id));
results.push({ id: 'exact-unchanged-baseline-accepted-with-bound-synthetic-receipt', outcome: 'passed' });
const tokenChanged = structuredClone(retained);
assert(tokenChanged.candidates.length > 0);
tokenChanged.candidates[0]!.density = tokenChanged.candidates[0]!.density === 'sparse' ? 'regular' : 'sparse';
const tokenAccepted = await accept(tokenChanged);
assert.equal(tokenAccepted.provenance.mode, 'configured-llm');
results.push({ id: 'one-density-token-no-longer-has-special-authorship-significance', outcome: 'passed', detail: 'Receipt remains necessary; note-choice inequality is not evidence of a model task.' });
for (const [label, plan] of [['exact-baseline', run.baseline], ['renamed-equivalent', retained], ['density-changed', tokenChanged]] as const) {
  for (const [kind, delegation] of [['undefined', undefined], ['null', null], ['empty', {}]] as const) {
    await rejects(`no-model-claim-with-${kind}-receipt-${label}`, () => acceptAgentPlan({ bytes: jsonBytes(plan), delegation, source: run.source, requestDigest: run.run.requestDigest, baseline: run.baseline }));
  }
}

const bounded = await arrangeBounded(run.source, run.request, run.baseline, run.baselineProvenance);
assert.equal(bounded.status, 'candidate');
await rejects('worker-real-elapsed-time-budget', () => arrangeBounded(run.source, { ...run.request, budget: { ...run.request.budget, maxElapsedMs: 1 } }, run.baseline, run.baselineProvenance), /search-exhausted/);
const controller = new AbortController();
const cancelled = arrangeBounded(run.source, run.request, run.baseline, run.baselineProvenance, controller.signal);
controller.abort(new Error('independent-midflight-abort'));
await rejects('worker-inflight-cancellation', () => cancelled, /independent-midflight-abort/);
results.push({ id: 'real-engine-worker-candidate', outcome: 'passed' });

const store = new PublicationStore(join(directory, 'publications'));
const options = { runDirectory: prepared.directory, baseUrl: 'https://viewer.example.test', baseline: true };
const published = await publishArrangement(options, { scoreAdapter: adapter, store });
const bundle = await readPublication(store.root, published.id);
assert.equal(bundle.manifest.agent, null);
assert.equal(JSON.parse(new TextDecoder().decode(bundle.score)).planner.mode, 'deterministic-fallback');
assert.match(new TextDecoder().decode(bundle.notes), /Planner: deterministic fallback\. No model-authored arrangement claim\./);
assert.equal(exports, 2);
const repeated = await publishArrangement(options, { scoreAdapter: { project() { throw new Error('must not rerender'); }, exportArtifact() { throw new Error('must not rerender'); } }, store });
assert(repeated.reused);
assert.equal(exports, 2);
assert.deepEqual(await readPublication(store.root, published.id), bundle);
results.push({ id: 'idempotent-original-byte-reuse-no-rerender', outcome: 'passed' });
// End-to-end model-file branch with exactly retained choices, original fixture and
// loudly synthetic receipt/export doubles only. This is not the pending A04 song.
const planPath = join(prepared.directory, 'synthetic-r2-baseline-review.json');
const delegationPath = join(prepared.directory, 'synthetic-r2-receipt-NOT-live.json');
await writeFile(planPath, jsonBytes(run.baseline));
await rejects('publish-plan-without-delegation-never-infers-model-involvement', () => publishArrangement({ runDirectory: prepared.directory, baseUrl: options.baseUrl, planPath }, { scoreAdapter: adapter, store }));
await rejects('publish-neither-baseline-nor-plan-never-infers-model-involvement', () => publishArrangement({ runDirectory: prepared.directory, baseUrl: options.baseUrl }, { scoreAdapter: adapter, store }));
await rejects('publish-explicit-baseline-with-plan-never-mixes-provenance', () => publishArrangement({ ...options, planPath }, { scoreAdapter: adapter, store }));
await writeFile(delegationPath, jsonBytes(receiptFor(jsonBytes(run.baseline))));
const syntheticStore = new PublicationStore(join(directory, 'synthetic-model-publications-NOT-live'));
const modelResult = await publishArrangement({ runDirectory: prepared.directory, baseUrl: options.baseUrl, planPath, delegationPath }, { scoreAdapter: adapter, store: syntheticStore });
const modelBundle = await readPublication(syntheticStore.root, modelResult.id);
const modelScore = await validatePublicationBundle(modelBundle);
assert.deepEqual(modelScore.plan, run.baseline);
assert.equal(modelScore.planner.mode, 'configured-llm');
assert.equal(modelBundle.manifest.agent!.taskId, 'independent-control-NOT-live');
assert.equal(modelBundle.manifest.status, 'unreviewed-draft');
assert.match(new TextDecoder().decode(modelBundle.notes), /independent-control-NOT-live/);
assert.doesNotMatch(new TextDecoder().decode(modelBundle.notes), /newly composed/i);
results.push({ id: 'end-to-end-retained-baseline-model-file-publication-synthetic-only', outcome: 'passed', detail: 'Real engine/validator/worker and five-file storage, but synthetic receipt and export doubles: no actual musician attestation or real exports.' });
for (const [id, change] of [
  ['manifest-wrong-revision-id', (x: any) => x.manifest.revision.id = 'wrong-id'],
  ['manifest-wrong-id', (x: any) => x.manifest.id = `arr-${'0'.repeat(64)}`],
  ['manifest-escape-path', (x: any) => x.manifest.files.score = '../source.json'],
  ['manifest-extra-source-file', (x: any) => x.manifest.files.raw = 'source.json'],
  ['manifest-fake-model', (x: any) => x.manifest.agent = { model: 'imaginary', taskId: 'imaginary' }],
  ['manifest-fake-review', (x: any) => x.manifest.status = 'musically-reviewed'],
  ['manifest-missing-integrity', (x: any) => delete x.manifest.integrity],
  ['manifest-artifact-wrong-source', (x: any) => x.manifest.artifacts.pdf.sourceRevision.id = 'wrong-id'],
  ['manifest-artifact-wrong-capo', (x: any) => x.manifest.artifacts.pdf.capo = 12],
  ['manifest-artifact-wrong-attacks', (x: any) => x.manifest.artifacts.pdf.soundingAttackCount++],
  ['manifest-artifact-different-adapter', (x: any) => x.manifest.artifacts.pdf.adapter.version = 'unrelated'],
  ['manifest-artifact-different-validation', (x: any) => x.manifest.artifacts.pdf.validationVersion = 'unrelated'],
  ['manifest-artifact-wrong-digest', (x: any) => x.manifest.artifacts.midi.artifactDigest = '0'.repeat(64)],
  ['corrupt-artifact-bytes', (x: any) => x.midi = new TextEncoder().encode('bad')],
] as const) { const b = structuredClone(bundle); change(b); await rejects(id, () => validatePublicationBundle(b)); }
const changedMetadata = structuredClone(bundle); changedMetadata.manifest.title = 'changed but same score';
await rejects('immutable-metadata-replacement', () => store.install(changedMetadata), /Immutable publication/);
assert.deepEqual(await readPublication(store.root, published.id), bundle);

const second = structuredClone(bundle);
const score = JSON.parse(new TextDecoder().decode(second.score));
score.revision.id = 'independent-second-revision'; score.revision.digest = await revisionDigest(score);
second.score = jsonBytes(score); second.manifest.id = `arr-${score.revision.digest}`; second.manifest.revision = { id: score.revision.id, digest: score.revision.digest }; second.manifest.integrity!.score = sha256(second.score);
for (const format of ['pdf', 'midi'] as const) second.manifest.artifacts![format].scoreRevision = second.manifest.revision;
let sawDurableFiles = false;
await rejects('interrupt-after-durable-stage-before-atomic-visibility', () => store.install(second, { beforeCommit: async () => {
  assert.equal(await store.get(second.manifest.id), null);
  const stagingName = (await readdir(store.root)).find(x => x.startsWith('.staging-'))!;
  assert.equal((await readdir(join(store.root, stagingName))).length, 5);
  sawDurableFiles = true; throw new Error('independent-stage-interruption');
} }), /independent-stage-interruption/);
assert(sawDurableFiles);
assert.deepEqual(await readPublication(store.root, published.id), bundle);
assert.equal(await store.get(second.manifest.id), null);
assert.deepEqual((await readdir(store.root)).filter(x => x.startsWith('.lock-') || x.startsWith('.staging-')), []);
results.push({ id: 'interrupted-stage-cleanup-old-bytes-preserved', outcome: 'passed' });

// A leftover lock belongs to an unknown process and must not be destroyed by a retry.
const lock = join(store.root, `.lock-${second.manifest.id}`); await mkdir(lock);
await rejects('leftover-lock-fails-closed', () => store.install(second), /busy or interrupted/);
assert((await readdir(store.root)).includes(`.lock-${second.manifest.id}`));
await rmdir(lock); // This judge created and owns this particular fixture lock.
const installed = await store.install(second);
assert.equal(installed.reused, false);
await rename(installed.directory, join(store.root, `arr-${'1'.repeat(64)}`));
await rejects('directory-manifest-id-disagreement', () => readPublication(store.root, `arr-${'1'.repeat(64)}`), /path\/manifest/);
await rename(join(store.root, `arr-${'1'.repeat(64)}`), installed.directory);
await writeFile(join(installed.directory, 'source.json'), '{}');
await rejects('unexpected-source-file-in-publication', () => readPublication(store.root, second.manifest.id), /unexpected/);
await rm(join(installed.directory, 'source.json'));
await rm(join(installed.directory, 'notes.md'));
await rejects('partial-publication-not-treated-as-absent', () => store.get(second.manifest.id), /Incomplete/);
await symlink(join(published.directory, 'notes.md'), join(installed.directory, 'notes.md'));
await rejects('publication-file-symlink', () => store.get(second.manifest.id), /Unsafe/);
for (const id of ['../x', 'arr-../../x', '%2e%2e', '%61rr-' + 'a'.repeat(64), `arr-${'a'.repeat(64)}/score.json`, `arr-${'A'.repeat(64)}`, `arr-${'a'.repeat(64)}\0`, 'manifest.json']) {
  assert(!PublicationIdSchema.safeParse(id).success); await rejects(`unsafe-id-${JSON.stringify(id)}`, () => readPublication(store.root, id));
}
assert.equal(await store.get(`arr-${'a'.repeat(64)}`), null);

const corruptEngine = { arrange(...args: Parameters<typeof guitarEngine.arrange>) { const output = guitarEngine.arrange(...args); if (output.status === 'candidate') { output.score.placements.find(p => p.fret > 0)!.fret++; const { digest: _, ...revision } = output.score.revision; output.score.revision.digest = createHash('sha256').update(canonicalJson({ ...output.score, revision })).digest('hex'); } return output; } };
await rejects('schema-valid-restamped-physical-corruption', () => publishArrangement(options, { scoreAdapter: adapter, engine: corruptEngine, store }), /Independent validation failed/);
for (const base of ['https://user:secret@example.test', 'https://example.test/token', 'https://example.test/?secret=token', 'https://example.test/#x', 'file:///tmp/']) assert.throws(() => publicationLinks(base, published.id));
assert(!PublicationManifestSchema.safeParse({ ...bundle.manifest, files: { ...bundle.manifest.files, pdf: '/absolute' } }).success);
const notDedicated = join(directory, 'existing-root'); await mkdir(notDedicated); await writeFile(join(notDedicated, '.gitignore'), 'user contents\n');
await rejects('private-root-must-not-overwrite-user-ignore', () => privateDirectory(notDedicated), /dedicated/);
assert.equal(await readFile(join(notDedicated, '.gitignore'), 'utf8'), 'user contents\n');
results.push({ id: 'local-root-user-ignore-preserved', outcome: 'passed' });

const actualTaskId = 'node:delegated-task:command%3Amcp%3A6402f533-82cb-4de9-b53f-d4ed4f0055a5%3Adelegate-task%3Aguitar-musician-arrangement-r1';
assert(actualTaskId.length <= 160);
const summary = { checkedAt: new Date().toISOString(), reviewedCommits: ['4a039f301fbf76f45c255b7afaebeb32754d4ae1', 'fa60798622215e917445e217c7d9dac3dd3a8625'], rootAtStart: '665d98d750852daaaf1a6d5d09b17790a31dc413', directory, scope: 'Independent R2 boundary review using original fixture, real engine/validator/worker; export doubles explicitly NOT renderer proof. No actual musician-task receipt generated. Historical R1 script/output preserved.', knownBlocker: null, controls: results.length, results };
await writeFile('/tmp/opencode/guitar-a02-independent-r2.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, results: undefined }, null, 2));

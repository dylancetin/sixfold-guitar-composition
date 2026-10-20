// Rerunnable A04 check; full-song inputs/results must stay outside version control.
// RUN_DIR, AUTHOR_DIR, REVIEW_DIR are required. INSTALL_RECEIPT=1 is an explicit,
// additive-only administrative copy of the parent-attested round-2 output.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { contentDigest, revisionDigest } from '../../src/domain';
import { acceptAgentPlan, AgentDelegationSchema } from '../../src/agent/plan';
import { arrangeBounded } from '../../src/agent/engine';
import { loadPreparedRun } from '../../src/agent/prepare';
import { guitarValidator } from '../../src/engine';
import { createScoreAdapter } from '../../src/adapters/server';

const required = (k: string) => { assert(process.env[k], `Set ${k}`); return process.env[k]!; };
const runDir = required('RUN_DIR'), author = required('AUTHOR_DIR'), out = required('REVIEW_DIR');
await mkdir(out, { recursive: true });
const json = async (p: string) => JSON.parse(await readFile(p, 'utf8'));
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const prepared = await loadPreparedRun(runDir);
const { run, source, request, baseline } = prepared;
const bytes = await readFile(join(author, 'plan.json'));
const receipt = AgentDelegationSchema.parse(await json(join(author, 'agent-metadata.json')));
// These facts are supplied explicitly by the parent, not inferred from a plan name.
assert.equal(receipt.provider, 'opencode');
assert.equal(receipt.model, 'openai/gpt-6.1-sol');
assert.equal(receipt.taskId, 'node:delegated-task:command%3Amcp%3A6402f533-82cb-4de9-b53f-d4ed4f0055a5%3Athread-send%3Aguitar-musician-correction-r2');
assert.equal(receipt.callId, receipt.taskId);
assert.equal(receipt.calledAt, '2026-10-20T23:13:43.840Z');
assert.deepEqual(receipt.sourceRevision, { id: 'source-2f02d677-7bfc-4abc-a1ad-8eb78506451c', digest: '20cc8fa7721fb6b3b3473bcb9f3c509fd2a389bfa9f9718ec6f5f771ef163813' });
assert.equal(receipt.requestDigest, '935eadf3e14ee40368e4d5735a355d2a718ec8a4c54163dfb6f5e46d9193ac26');
assert.equal(hash(bytes), '1c867ff80d1ddeb63e618054b5505ca9ba53b752b8e2569f876844ed8e7eb0f3');
for (const f of ['model-response.json', 'original-model-plan.json']) assert.deepEqual(await readFile(join(author, f)), bytes);
assert.deepEqual(receipt.sourceRevision, run.sourceRevision);
assert.equal(receipt.requestDigest, run.requestDigest);
const accepted = await acceptAgentPlan({ bytes, delegation: receipt, source, requestDigest: run.requestDigest, baseline });
const retained = await json(join(author, 'retained-plan.json'));
const omission = 'harmony-bar35-p7-bt4-n0';
assert.deepEqual(accepted.plan.candidates, retained.candidates.filter((c: any) => c.id !== omission));
assert.equal(retained.candidates.length - accepted.plan.candidates.length, 1);
const decisions = await json(join(author, 'author-decisions.json'));
assert.equal(decisions.candidateRemoved.id, omission);
assert.equal(decisions.authorOmissionCount, 1);
const copies: string[] = [];
if (process.env.INSTALL_RECEIPT === '1') {
  for (const [name, data] of [['plan.json', bytes], ['delegation.json', Buffer.from(JSON.stringify(receipt, null, 2) + '\n')]] as const) {
    const path = join(runDir, name);
    try { await writeFile(path, data, { flag: 'wx' }); copies.push(name); }
    catch (e: any) { if (e.code !== 'EEXIST') throw e; assert.deepEqual(await readFile(path), data, `Refuse differing existing ${path}`); }
  }
}
const trials: any[] = [];
// Real root outer worker, unchanged 5000ms limit; never imports the author's worker.
for (const [name, plan] of [['retained-plan', retained], ['m2-omission-plan', accepted.plan]] as const) {
  for (const capo of [0, 2, 'compare'] as const) {
    const prior = await json(join(author, `${name}-capo${capo}-result.json`));
    const trialRequest = structuredClone(request);
    if (capo !== 'compare') trialRequest.preferences.capo = { mode: 'chosen', value: capo };
    const start = performance.now();
    const result = await arrangeBounded(source, trialRequest, plan, prior.score.planner);
    const elapsedMs = Math.round(performance.now() - start);
    assert.equal(result.status, 'candidate', JSON.stringify(result.diagnostics));
    if (result.status !== 'candidate') throw new Error('No candidate');
    // A true root reproduction, including the exact original candidate header.
    assert.deepEqual(result.score, prior.score);
    const validation = guitarValidator.validate(source, result.score, { approvedRevisions: [] });
    assert.equal(validation.status, 'passed');
    assert.equal(validation.transitions, 'uncalibrated');
    await writeFile(join(out, `${name}-capo${capo}.json`), JSON.stringify(result.score) + '\n');
    trials.push({ plan: name, capo, elapsedMs, maxElapsedMs: trialRequest.budget.maxElapsedMs, validation });
  }
}
const negatives: any[] = [];
for (const kind of ['wrong-raw-plan-digest', 'wrong-source', 'wrong-request']) {
  const bad = structuredClone(receipt);
  if (kind === 'wrong-raw-plan-digest') bad.responseDigest = '0'.repeat(64);
  if (kind === 'wrong-source') bad.sourceRevision.digest = '0'.repeat(64);
  if (kind === 'wrong-request') bad.requestDigest = '0'.repeat(64);
  await assert.rejects(() => acceptAgentPlan({ bytes, delegation: bad, source, requestDigest: run.requestDigest, baseline }));
  negatives.push({ kind, rejected: true });
}
const score = await json(join(out, 'm2-omission-plan-capocompare.json'));
const ids = (s: any) => s.provenance.eventIds ?? s.provenance.evidenceEventIds;
let roleBad: any;
for (const kind of ['melody-octave', 'melody-onset', 'held-role-crossing']) {
  const bad = structuredClone(score);
  const note = bad.sounds.find((s: any) => s.role === 'melody' && ids(s)[0] === 'p0:b5:v0:bt1:n0');
  assert(note);
  if (kind === 'melody-octave') { note.soundingMidi += 12; note.spelling.octave += 1; }
  if (kind === 'melody-onset') note.start = { n: 205, d: 12 };
  if (kind === 'held-role-crossing') {
    const bass = bad.sounds.find((s: any) => s.role === 'bass' && ids(s)[0] === 'p8:b8:v0:bt2:n0');
    assert.equal(bass.soundingMidi, 47); bass.soundingMidi = 59; bass.spelling.octave += 1;
  }
  bad.revision.digest = await revisionDigest(bad);
  const report = guitarValidator.validate(source, bad, { approvedRevisions: [] });
  assert.equal(report.status, 'failed');
  assert(!report.diagnostics.some(d => d.code === 'revision-stale'));
  assert(report.diagnostics.some(d => d.severity === 'error' && (kind === 'held-role-crossing' ? d.message.includes('[role-order-v1]') : d.code === 'melody-mismatch')));
  negatives.push({ kind, rejected: true, errors: report.diagnostics.filter(d => d.severity === 'error') });
  if (kind === 'held-role-crossing') roleBad = bad;
}
const adapter = createScoreAdapter({ validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }) });
const forged = { ...trials.at(-1).validation, scoreRevision: { id: roleBad.revision.id, digest: roleBad.revision.digest } };
await assert.rejects(() => adapter.exportArtifact(source, { status: 'validatedDraft', score: roleBad, validation: forged }, 'midi'), (e: any) => e.code === 'validation-failed');
negatives.push({ kind: 'forged-passed-envelope', rejected: true });
const report = { status: 'VERIFIED', createdAt: new Date().toISOString(), rawPlanSha256: hash(bytes), canonicalPlanDigest: await contentDigest(accepted.plan), receipt, copies, trials, negatives, humanAcceptance: 'INCONCLUSIVE; not a human-playability claim' };
await writeFile(join(out, 'root-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, copies, trials: trials.map(t => ({ plan: t.plan, capo: t.capo, elapsedMs: t.elapsedMs })), negatives: negatives.map(n => n.kind) }, null, 2));

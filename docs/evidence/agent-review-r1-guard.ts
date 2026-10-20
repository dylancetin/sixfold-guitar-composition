// Historical independent failure reproducer for 4a039f3, not an acceptance gate.
// All receipt values below are synthetic; no actual task receipt is written.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { contentDigest } from '../../src/domain';
import { source } from '../../tests/fixtures/original';

const checkout = process.env.A02_REVIEW_CHECKOUT ?? '/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-bfbeaaab';
const { acceptAgentPlan } = await import(pathToFileURL(`${checkout}/src/agent/plan.ts`).href);
const { createDefaultRequest, deterministicPlanner } = await import(pathToFileURL(`${checkout}/src/engine/index.ts`).href);
const { createDefaultMelodySelection } = await import(pathToFileURL(`${checkout}/src/source/index.ts`).href);
const selection = createDefaultMelodySelection(source);
assert.equal(selection.status, 'proposed');
const request = createDefaultRequest(source, selection.selection, 'intermediate');
const baseline = (await deterministicPlanner.plan(source, request)).plan;
const retained = { ...baseline, version: 'reviewed-baseline-SYNTHETIC-fixture', candidates: baseline.candidates.map((c: any) => ({ ...c, id: `review-${c.id}`, reason: `Fixture for permissible source-reviewed agreement on ${c.sourceEventIds.join(',')}; NOT a live musician task.` })) };
async function accept(plan: unknown) {
  const bytes = new TextEncoder().encode(`${JSON.stringify(plan, null, 2)}\n`);
  return acceptAgentPlan({ bytes, source, baseline, requestDigest: await contentDigest(request), delegation: {
    schemaVersion: 1, transport: 'project-subagent', provider: 'independent-fixture-NOT-live', model: 'synthetic-NOT-model-call',
    taskId: 'synthetic-task-NOT-live', callId: 'synthetic-task-NOT-live', calledAt: '2026-10-20T00:00:00Z',
    responseDigest: createHash('sha256').update(bytes).digest('hex'),
    sourceRevision: { id: source.revision.id, digest: source.revision.digest }, requestDigest: await contentDigest(request),
  } });
}
await assert.rejects(accept(retained), /Baseline-equivalent/);
const tokenChange = structuredClone(retained);
assert(tokenChange.candidates.length > 0);
tokenChange.candidates[0].density = tokenChange.candidates[0].density === 'sparse' ? 'regular' : 'sparse';
assert.equal((await accept(tokenChange)).provenance.mode, 'configured-llm');
console.log(JSON.stringify({ reviewedCommit: '4a039f3', verdict: 'NOT VERIFIED', equivalentReviewedChoices: 'rejected (blocker)', oneDensityTokenChange: 'accepted; not authorship proof', evidence: 'Synthetic boundary fixture only; actual musician task pending; no actual receipt generated.' }, null, 2));

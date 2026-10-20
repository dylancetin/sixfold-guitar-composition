import { z } from 'zod';
import { contentDigest, DigestSchema, PlanSchema, PlannerProvenanceSchema, RevisionRefSchema } from '../domain';
import type { Plan, PlannerProvenance, SourceScoreV1 } from '../domain';
import { sha256 } from './files';

/** A factual receipt written by the orchestrator AFTER an actual delegated model task. */
export const AgentDelegationSchema = z.strictObject({
  schemaVersion: z.literal(1), transport: z.literal('project-subagent'),
  provider: z.string().min(1), model: z.string().min(1),
  taskId: z.string().min(1).max(160), callId: z.string().min(1).max(160), calledAt: z.iso.datetime(),
  responseDigest: DigestSchema, sourceRevision: RevisionRefSchema, requestDigest: DigestSchema,
});
export type AgentDelegation = z.infer<typeof AgentDelegationSchema>;

export function validatePlan(input: unknown, source: SourceScoreV1): Plan {
  const plan = PlanSchema.parse(input);
  const ids = new Set<string>();
  for (const candidate of plan.candidates) {
    if (ids.has(candidate.id)) throw new Error(`Duplicate candidate ID: ${candidate.id}`);
    ids.add(candidate.id);
    for (const id of candidate.sourceEventIds) {
      if (!source.events.some((event) => event.id === id && event.kind === 'note')) throw new Error(`Unknown/non-note source event: ${id}`);
    }
    if (new Set(candidate.sourceEventIds).size !== candidate.sourceEventIds.length) throw new Error('Repeated source references in candidate');
  }
  return plan;
}

const musicalChoices = (plan: Plan) => plan.candidates.map((c) => JSON.stringify({ role: c.role, sourceEventIds: [...c.sourceEventIds].sort(), octaveShift: c.octaveShift, density: c.density })).sort();

export async function acceptAgentPlan(options: {
  bytes: Uint8Array; delegation: unknown; source: SourceScoreV1; requestDigest: string; baseline: Plan;
}): Promise<{ plan: Plan; provenance: PlannerProvenance; delegation: AgentDelegation }> {
  const delegation = AgentDelegationSchema.parse(options.delegation);
  if (delegation.responseDigest !== sha256(options.bytes)) throw new Error('Delegation responseDigest must hash the exact raw plan-file bytes');
  if (delegation.sourceRevision.id !== options.source.revision.id || delegation.sourceRevision.digest !== options.source.revision.digest || delegation.requestDigest !== options.requestDigest) throw new Error('Delegation is bound to a different source/request');
  const plan = validatePlan(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(options.bytes)), options.source);
  if (await contentDigest(musicalChoices(plan)) === await contentDigest(musicalChoices(options.baseline))) throw new Error('Baseline-equivalent choices cannot be relabeled AI-authored; publish the deterministic fallback or author a substantive source-grounded plan');
  const provenance = PlannerProvenanceSchema.parse({
    mode: 'configured-llm', provider: delegation.provider, model: delegation.model,
    plannerVersion: plan.version, callId: delegation.callId, calledAt: delegation.calledAt,
    responseDigest: delegation.responseDigest, acceptedCandidateIds: plan.candidates.map((c) => c.id),
  });
  return { plan, provenance, delegation };
}

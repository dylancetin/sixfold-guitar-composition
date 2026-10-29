import { z } from 'zod';
import type { SourceEvent } from '../domain';
import { fail } from './common';

// Opt-in simplification, NOT a bend-performance decoder. Raw curves remain intact.
const BendSchema = z.strictObject({
  tone: z.number().finite().min(-1200).max(1200),
  points: z.array(z.strictObject({
    position: z.number().finite().min(0).max(60),
    tone: z.number().finite().min(-1200).max(1200),
  })).min(2).max(128),
}).refine(({ points }) => points.length >= 2 && points[0]!.position === 0 && points.at(-1)!.position === 60
  && points.every((point, i) => i === 0 || point.position > points[i - 1]!.position));

export function simplifiedBend(value: unknown, sourceNoteId: string): Extract<SourceEvent, { kind: 'note' }>['effects'][number] {
  const parsed = BendSchema.safeParse(value);
  if (!parsed.success) fail(`Malformed/unknown bend at ${sourceNoteId}; even an opted-in notated-pitch draft cannot silently discard unknown bend data.`);
  return {
    code: 'source-bend-simplified', affectsMelody: false,
    description: JSON.stringify({ sourceNoteId, policy: 'explicit-notated-pitch-draft', curve: parsed.data,
      limitation: 'Bend pitch motion intentionally NOT reproduced. Only the notated starting pitch and exact metrical duration are preserved; this is a simplified melody, not exact expressive source fidelity.' }),
  };
}

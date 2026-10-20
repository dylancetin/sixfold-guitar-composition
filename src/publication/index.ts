import { z } from 'zod';
import { ArtifactManifestSchema, DigestSchema, RevisionRefSchema } from '../domain';

/** Browser-safe publication contract. Filesystem authority lives in ./store.ts. */
export const PublicationIdSchema = z.string().regex(/^arr-[a-f0-9]{64}$/);
const PublicSourceUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
}, 'Source URL must be public HTTP(S), without credentials or query/fragment secrets');
export const PublicationManifestSchema = z.strictObject({
  schemaVersion: z.literal(1), id: PublicationIdSchema,
  title: z.string().trim().min(1).max(300), sourceUrl: PublicSourceUrlSchema, createdAt: z.iso.datetime(),
  revision: RevisionRefSchema,
  files: z.strictObject({ score: z.literal('score.json'), pdf: z.literal('arrangement.pdf'), midi: z.literal('arrangement.mid'), notes: z.literal('notes.md') }),
  status: z.enum(['unreviewed-draft', 'musically-reviewed']),
  agent: z.strictObject({ model: z.string().min(1), taskId: z.string().min(1).max(160) }).nullable(),
  // Optional for readers of the shared V1 contract; always emitted by this publisher.
  integrity: z.strictObject({ score: DigestSchema, pdf: DigestSchema, midi: DigestSchema, notes: DigestSchema }).optional(),
  artifacts: z.strictObject({ pdf: ArtifactManifestSchema, midi: ArtifactManifestSchema }).optional(),
}).refine((m) => m.id === publicationId(m.revision.digest), 'Publication ID must bind the complete score digest');
export type PublicationManifest = z.infer<typeof PublicationManifestSchema>;

export function publicationId(digest: string): string {
  return `arr-${DigestSchema.parse(digest)}`;
}

export function publicationLinks(baseUrl: string, id: string) {
  PublicationIdSchema.parse(id);
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('--base-url must be an absolute HTTP(S) viewer origin without credentials, path, query or fragment');
  }
  const viewer = new URL(`/arrangements/${id}`, base.origin).href;
  return { viewer, pdf: `${viewer}/arrangement.pdf`, midi: `${viewer}/arrangement.mid`, score: `${viewer}/score.json`, notes: `${viewer}/notes.md` };
}

import { z } from 'zod';
import { PublicationManifestSchema } from '../publication';
export { PreviewLyricsSchema } from '../lyrics';
export type { PreviewLyrics } from '../lyrics';
export { PublicationIdSchema as PublishedIdSchema, PublicationManifestSchema as PublishedManifestSchema } from '../publication';
export type { PublicationManifest as PublishedManifest } from '../publication';

/** Viewer wire additions only. Canonical manifest/ID validation belongs to publication. */
export const LibraryEntrySchema = z.strictObject({
  manifest: PublicationManifestSchema,
  summary: z.strictObject({ difficulty: z.enum(['beginner', 'intermediate', 'advanced']), capo: z.number().int().min(0).max(12), writtenBars: z.number().int().positive(), performedMeasures: z.number().int().positive(), notes: z.number().int().positive() }),
});
export const LibraryResponseSchema = z.strictObject({ arrangements: z.array(LibraryEntrySchema), unavailableCount: z.number().int().nonnegative() });
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;

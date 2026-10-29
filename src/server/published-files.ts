import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ScoreV1Schema } from '../domain';
import { PublicationIdSchema } from '../publication';
import { readPublication } from '../publication/store';
import type { LibraryEntry, PublishedManifest } from './published-schema';
import type { ScoreV1 } from '../domain';

export const publishedFiles = ['manifest.json', 'score.json', 'arrangement.pdf', 'arrangement.mid', 'notes.md'] as const;
export type PublishedFilename = typeof publishedFiles[number];
export class PublicationUnavailable extends Error {}
export type PublishedBundle = { manifest: PublishedManifest; score: ScoreV1; bytes: Record<PublishedFilename, Uint8Array> };

/** Read-only facade over the publication worker's authoritative integrity/path reader. */
export class PublishedFiles {
  constructor(readonly directory: string) {}
  async load(id: string): Promise<PublishedBundle | null> {
    if (!PublicationIdSchema.safeParse(id).success) return null;
    try { await lstat(join(this.directory, id)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new PublicationUnavailable(); }
    try {
      const bundle = await readPublication(this.directory, id);
      const score = ScoreV1Schema.parse(JSON.parse(new TextDecoder().decode(bundle.score)));
      return { manifest: bundle.manifest, score, bytes: {
        'manifest.json': new TextEncoder().encode(JSON.stringify(bundle.manifest)),
        'score.json': bundle.score, 'arrangement.pdf': bundle.pdf,
        'arrangement.mid': bundle.midi, 'notes.md': bundle.notes,
      } };
    } catch { throw new PublicationUnavailable('Published bundle is incomplete or failed its integrity checks.'); }
  }
  async library() {
    let names;
    try { names = await readdir(this.directory, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { arrangements: [], unavailableCount: 0 }; throw error; }
    const arrangements: LibraryEntry[] = [];
    const projects = new Map<string, string>();
    let unavailableCount = 0;
    for (const entry of names) {
      if (entry.name.startsWith('.') || !PublicationIdSchema.safeParse(entry.name).success) continue;
      try {
        const bundle = await this.load(entry.name);
        if (!bundle) { unavailableCount++; continue; }
        projects.set(bundle.manifest.id, bundle.score.projectId);
        arrangements.push({ manifest: bundle.manifest, summary: { difficulty: bundle.score.preferences.difficulty, capo: bundle.score.instrument.capo, writtenBars: bundle.score.bars.length, performedMeasures: bundle.score.occurrences.length, notes: bundle.score.performedSounds.length } });
      } catch { unavailableCount++; }
    }
    arrangements.sort((a, b) => b.manifest.createdAt.localeCompare(a.manifest.createdAt) || a.manifest.id.localeCompare(b.manifest.id));
    // Show the newest valid edition of each project; older immutable IDs remain
    // directly loadable for existing viewer and download links.
    const seen = new Set<string>();
    return { arrangements: arrangements.filter(entry => {
      const project = projects.get(entry.manifest.id)!;
      if (seen.has(project)) return false;
      seen.add(project);
      return true;
    }), unavailableCount };
  }
}

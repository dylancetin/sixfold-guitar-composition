import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { contentDigest, verifyRevisionDigest } from '../domain';
import type { ScoreV1, SourceScoreV1 } from '../domain';
import { checkRestrictions } from '../source/raw';
import { anchorSourceLyrics, LyricPartSchema } from '../source/lyrics';
import { mapLyricsToScore } from '../lyrics';
import type { SourceSyllable } from '../lyrics';
import { PreviewLyricsSchema } from './published-schema';
import type { PreviewLyrics } from './published-schema';
import { loadPublishedSource } from './published-source';
import { readSupplementalLyrics } from './supplemental-lyrics';

export class LyricsSourceUnavailable extends Error {}
export function extractSourceLyrics(value: unknown, source: SourceScoreV1, partId: number): SourceSyllable[] {
  const identity = source.manifest.identity;
  const part = source.parts.find(part => part.id === partId);
  if (identity.kind !== 'songsterr' || !part) throw new LyricsSourceUnavailable();
  checkRestrictions(value);
  const raw = LyricPartSchema.parse(value);
  if (raw.songId !== identity.songId || raw.revisionId !== identity.upstreamRevisionId || raw.partId !== partId) throw new LyricsSourceUnavailable();
  const unversioned = 'unversionedPartIds' in identity && identity.unversionedPartIds.includes(partId);
  if (unversioned ? raw.version !== undefined : raw.version !== identity.formatVersion) throw new LyricsSourceUnavailable();
  return anchorSourceLyrics(raw, source);
}

export async function readPublishedLyrics(score: ScoreV1, sourceDirectory: string): Promise<PreviewLyrics> {
  try {
    const { source, runDirectory } = await loadPublishedSource(sourceDirectory, score);
    if (!await verifyRevisionDigest(source) || await contentDigest(source.manifest) !== await contentDigest(score.source.manifest)) throw new LyricsSourceUnavailable();
    const result: PreviewLyrics = { sourceRevision: { ...score.source.revision }, scoreRevision: { id: score.revision.id, digest: score.revision.digest }, syllables: [] };
    if (source.manifest.identity.kind !== 'songsterr') return result;
    const rawDirectory = join(runDirectory, 'raw');
    const directory = await lstat(rawDirectory);
    if (!directory.isDirectory() || directory.isSymbolicLink() || source.parts.length > 32) throw new LyricsSourceUnavailable();
    let total = 0;
    const selectedParts = new Set(score.selection.sections.flatMap(section => section.selectors.map(selector => selector.partId)));
    for (const part of source.parts.filter(part => selectedParts.has(part.id))) {
      const artifacts = source.manifest.artifacts.filter(artifact => artifact.id === `part-${part.id}`);
      const artifact = artifacts[0];
      if (artifacts.length !== 1 || !artifact || artifact.mediaType !== 'application/json' || artifact.byteLength > 8 * 1024 * 1024) throw new LyricsSourceUnavailable();
      total += artifact.byteLength;
      if (total > 32 * 1024 * 1024) throw new LyricsSourceUnavailable();
      const path = join(rawDirectory, artifact.sha256);
      const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      let bytes: Uint8Array;
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size !== artifact.byteLength) throw new LyricsSourceUnavailable();
        bytes = await file.readFile();
      } finally { await file.close(); }
      if (bytes.byteLength !== artifact.byteLength || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw new LyricsSourceUnavailable();
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      result.syllables.push(...mapLyricsToScore(source, score, extractSourceLyrics(value, source, part.id)).syllables);
    }
    return !result.syllables.length ? await readSupplementalLyrics(runDirectory, source, score) ?? result : PreviewLyricsSchema.parse(result);
  } catch { throw new LyricsSourceUnavailable(); }
}

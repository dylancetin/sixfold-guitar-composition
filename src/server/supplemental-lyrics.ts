import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { contentDigest, RevisionRefSchema } from '../domain';
import type { ScoreV1, SourceScoreV1 } from '../domain';
import { LyricsReviewSchema, lyricsForScore, mapLyricsToScore, PreviewLyricsSchema } from '../lyrics';
import type { PreviewLyrics } from '../lyrics';

const artifact = z.strictObject({ sha256: z.string().regex(/^[a-f0-9]{64}$/), byteLength: z.number().int().positive().max(8 * 1024 * 1024) });
export const LyricsSupplementSchema = z.strictObject({
  schemaVersion: z.literal(1), sourceRevision: RevisionRefSchema, scoreRevision: RevisionRefSchema,
  lyrics: artifact, source: artifact,
  retrievedAt: z.iso.datetime(), model: z.string().min(1).max(200), taskId: z.string().min(1).max(1000),
  review: LyricsReviewSchema,
});

async function readFile(path: string, expected?: z.infer<typeof artifact>) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > (expected?.byteLength ?? 16_384) || (expected && stat.size !== expected.byteLength)) throw new Error('Invalid lyric supplement file');
    const bytes = await file.readFile();
    if (expected && (bytes.length !== expected.byteLength || createHash('sha256').update(bytes).digest('hex') !== expected.sha256)) throw new Error('Lyric supplement digest mismatch');
    return bytes;
  } finally { await file.close(); }
}

/** Private, revision-bound supplements never replace the saved source or publication. */
export async function readSupplementalLyrics(runDirectory: string, source: SourceScoreV1, score: ScoreV1): Promise<PreviewLyrics | undefined> {
  // Missing or corrupt optional supplements must not disable verified upstream lyrics or playback.
  try {
    if (!/^[a-f0-9]{64}$/.test(score.revision.digest)) return;
    const root = join(runDirectory, 'lyrics'), directory = join(root, score.revision.digest);
    for (const path of [root, directory]) {
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) return;
    }
    const manifest = LyricsSupplementSchema.parse(JSON.parse((await readFile(join(directory, 'manifest.json'))).toString('utf8')));
    const same = (a: { id: string; digest: string }, b: { id: string; digest: string }) => a.id === b.id && a.digest === b.digest;
    if (!same(manifest.sourceRevision, source.revision) || !same(manifest.scoreRevision, score.revision)) return;
    await readFile(join(directory, 'source.html'), manifest.source);
    const lyrics = PreviewLyricsSchema.parse(JSON.parse((await readFile(join(directory, 'lyrics.json'), manifest.lyrics)).toString('utf8')));
    if (!same(lyrics.sourceRevision, source.revision) || !same(lyrics.scoreRevision, score.revision)) return;
    const sourceSyllables = lyrics.syllables.map(({ id, line, text, source, writtenStart }) => ({ id, line, text, source, writtenStart }));
    const mapped = mapLyricsToScore(source, score, sourceSyllables);
    if (await contentDigest(mapped.syllables) !== await contentDigest(lyrics.syllables) || lyricsForScore(score, lyrics).length !== lyrics.syllables.length) return;
    if (new Set(lyrics.syllables.map(s => s.id)).size !== lyrics.syllables.length || new Set(lyrics.syllables.map(s => `${s.segmentId}:${s.line}`)).size !== lyrics.syllables.length) return;
    return { ...mapped, review: manifest.review };
  } catch { return; }
}

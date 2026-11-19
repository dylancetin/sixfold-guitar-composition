import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { SourceScoreV1Schema } from '../domain';
import type { ScoreV1 } from '../domain';

export class PublishedSourceUnavailable extends Error {}
const sourceHeader = z.object({ revision: SourceScoreV1Schema.shape.revision });
const same = (a: { id: string; digest: string }, b: { id: string; digest: string }) => a.id === b.id && a.digest === b.digest;

export async function loadPublishedSource(directory: string, score: ScoreV1) {
  try {
    const root = await lstat(directory);
    if (!root.isDirectory() || root.isSymbolicLink()) throw new PublishedSourceUnavailable();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !z.uuid().safeParse(entry.name).success) continue;
      const runDirectory = join(directory, entry.name);
      const path = join(runDirectory, 'source.json');
      let value: unknown;
      try {
        const run = await lstat(runDirectory);
        if (!run.isDirectory() || run.isSymbolicLink()) continue;
        const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const stat = await file.stat();
          if (!stat.isFile() || stat.size > 64 * 1024 * 1024) continue;
          value = JSON.parse(await file.readFile('utf8'));
        } finally { await file.close(); }
      } catch { continue; }
      const header = sourceHeader.safeParse(value);
      if (!header.success || !same(header.data.revision, score.source.revision)) continue;
      return { source: SourceScoreV1Schema.parse(value), runDirectory };
    }
  } catch { throw new PublishedSourceUnavailable(); }
  throw new PublishedSourceUnavailable();
}

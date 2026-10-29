import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { SourceScoreV1Schema, ValidatedScoreV1Schema } from '../domain';
import type { ScoreV1, SourceScoreV1 } from '../domain';
import { guitarValidator } from '../engine';
import { createScoreAdapter } from '../adapters/server';
import { AdapterError } from '../adapters/errors';
import type { PdfLayoutSettings } from '../adapters/pdf-settings';
import type { PublishedBundle } from './published-files';

export class PdfSourceUnavailable extends Error {}
const sourceHeader = z.object({ revision: SourceScoreV1Schema.shape.revision });
const same = (a: { id: string; digest: string }, b: { id: string; digest: string }) => a.id === b.id && a.digest === b.digest;

/** Private local source lookup. Never accept a source, path or validation report from HTTP. */
async function loadSource(directory: string, score: ScoreV1): Promise<SourceScoreV1> {
  try {
    const root = await lstat(directory);
    if (!root.isDirectory() || root.isSymbolicLink()) throw new PdfSourceUnavailable();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !z.uuid().safeParse(entry.name).success) continue;
      const path = join(directory, entry.name, 'source.json');
      let value: unknown;
      try {
        const stat = await lstat(path);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024) continue;
        value = JSON.parse(await readFile(path, 'utf8'));
      } catch { continue; }
      const header = sourceHeader.safeParse(value);
      if (!header.success || !same(header.data.revision, score.source.revision)) continue;
      // The adapter independently verifies the full source digest/manifest and
      // reruns the musical validator before exporting this immutable score.
      return SourceScoreV1Schema.parse(value);
    }
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    throw new PdfSourceUnavailable();
  }
  throw new PdfSourceUnavailable();
}

export async function exportPublishedPdf(bundle: PublishedBundle, settings: PdfLayoutSettings, sourceDirectory: string, assertUnchanged: () => Promise<void>, signal: AbortSignal) {
  signal.throwIfAborted();
  const source = await loadSource(sourceDirectory, bundle.score);
  const report = guitarValidator.validate(source, bundle.score, { approvedRevisions: [] });
  if (report.status !== 'passed') throw new AdapterError('validation-failed', 'Published score failed independent validation');
  const draft = ValidatedScoreV1Schema.parse({ status: 'validatedDraft', score: bundle.score, validation: report });
  const adapter = createScoreAdapter({
    validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }),
    assertCurrentRevision: assertUnchanged, pdfLayout: settings, pdfTitle: bundle.manifest.title,
  });
  return adapter.exportArtifact(source, draft, 'pdf', signal);
}

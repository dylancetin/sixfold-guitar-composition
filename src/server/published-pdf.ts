import { ValidatedScoreV1Schema } from '../domain';
import { guitarValidator } from '../engine';
import { createScoreAdapter } from '../adapters/server';
import { AdapterError } from '../adapters/errors';
import type { PdfLayoutSettings } from '../adapters/pdf-settings';
import type { PublishedBundle } from './published-files';
import { loadPublishedSource } from './published-source';

export { PublishedSourceUnavailable as PdfSourceUnavailable } from './published-source';

export async function exportPublishedPdf(bundle: PublishedBundle, settings: PdfLayoutSettings, sourceDirectory: string, assertUnchanged: () => Promise<void>, signal: AbortSignal) {
  signal.throwIfAborted();
  const { source } = await loadPublishedSource(sourceDirectory, bundle.score);
  const report = guitarValidator.validate(source, bundle.score, { approvedRevisions: [] });
  if (report.status !== 'passed') throw new AdapterError('validation-failed', 'Published score failed independent validation');
  const draft = ValidatedScoreV1Schema.parse({ status: 'validatedDraft', score: bundle.score, validation: report });
  const adapter = createScoreAdapter({
    validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }),
    assertCurrentRevision: assertUnchanged, pdfLayout: settings, pdfTitle: bundle.manifest.title,
  });
  return adapter.exportArtifact(source, draft, 'pdf', signal);
}

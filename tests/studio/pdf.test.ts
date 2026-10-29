import { afterEach, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createScoreAdapter } from '../../src/adapters/server';
import { parsePdfLayoutQuery, PdfLayoutSettingsSchema, pdfLayoutQuery } from '../../src/adapters/pdf-settings';
import { guitarValidator } from '../../src/engine';
import { PublicationStore } from '../../src/publication/store';
import { jsonBytes, sha256 } from '../../src/agent/files';
import { createPublishedHandler } from '../../src/server/published-http';
import { stamp, study } from '../adapters/fixture';

const directories: string[] = [];
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });

async function setup(passes = 12, differingPass = true) {
  const root = await mkdtemp('/tmp/opencode/pdf-layout-test-'); directories.push(root);
  const sourceDirectory = join(root, 'sources'), run = join(sourceDirectory, randomUUID());
  await mkdir(run, { recursive: true });
  const { source, score } = await study(passes, 2, 2);
  if (differingPass) {
    // A valid pass-specific finger keeps this multipage oracle fully unfolded.
    const performed = score.performedSounds.find(p => p.soundId === 'm1' && p.attackOccurrenceId === 'o1-p2')!;
    const placement = { ...score.placements.find(p => p.id === performed.placementId)!, id: 'second-pass-finger', finger: 4 };
    score.placements.push(placement); performed.placementId = placement.id;
    score.contacts.find(c => c.performedSoundId === performed.id)!.placementId = placement.id;
    await stamp(score);
  }
  const sourcePath = join(run, 'source.json'); await writeFile(sourcePath, jsonBytes(source));
  const adapter = createScoreAdapter({ validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }) });
  const validation = guitarValidator.validate(source, score, { approvedRevisions: [] });
  if (validation.status !== 'passed') throw new Error('Original fixture did not pass independent validation');
  const draft = { status: 'validatedDraft' as const, score, validation };
  const pdf = await adapter.exportArtifact(source, draft, 'pdf'), midi = await adapter.exportArtifact(source, draft, 'midi');
  const files = { score: jsonBytes(score), pdf: pdf.bytes, midi: midi.bytes, notes: new TextEncoder().encode('# Original authored PDF test fixture') };
  const id = `arr-${score.revision.digest}`;
  const store = new PublicationStore(join(root, 'published'));
  await store.install({ ...files, manifest: {
    schemaVersion: 1, id, title: 'Original fixture — complete PDF layout coverage with a long title that must wrap without clipping',
    sourceUrl: 'https://example.test/original-pdf-fixture', createdAt: '2026-10-21T00:00:00Z',
    revision: { id: score.revision.id, digest: score.revision.digest }, status: 'unreviewed-draft', agent: null,
    files: { score: 'score.json', pdf: 'arrangement.pdf', midi: 'arrangement.mid', notes: 'notes.md' },
    integrity: { score: sha256(files.score), pdf: sha256(files.pdf), midi: sha256(files.midi), notes: sha256(files.notes) },
    artifacts: { pdf: pdf.manifest, midi: midi.manifest },
  } });
  const handle = createPublishedHandler({ arrangementsDirectory: store.root, frontendDirectory: root, sourceDirectory });
  return { root, sourceDirectory, sourcePath, source, score, id, store, handle, files };
}

async function inspect(bytes: Uint8Array) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const rows: number[] = [], occurrences: string[] = [], clefSizes: number[] = [], fingers: string[] = [];
    let textContent = '';
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number), content = await page.getTextContent();
      const items = content.items.filter((i): i is Extract<typeof i, { str: string }> => 'str' in i);
      const text = items.map(i => i.str).join(' ');
      textContent += text;
      expect(text).toContain('unreviewed-draft');
      rows.push(...[...text.matchAll(/SYSTEM(\d+)/g)].map(m => Number(m[1])));
      occurrences.push(...[...text.matchAll(/\bo([12])-p(\d+)\/S[12]\/P\d+\b/g)].map(m => `o${m[1]}-p${m[2]}`));
      clefSizes.push(...items.filter(i => i.str.includes('\ue050')).map(i => i.height));
      fingers.push(...[...text].filter(char => char.codePointAt(0)! >= 60688 && char.codePointAt(0)! <= 60692));
      // Independently inspect the actual PDF text geometry, including wrapped titles.
      for (const item of items.filter(i => i.str.trim())) {
        expect(item.transform[4]!, item.str).toBeGreaterThanOrEqual(27);
        expect(item.transform[4]! + item.width).toBeLessThanOrEqual(page.view[2]! - 27);
        expect(item.transform[5]!).toBeGreaterThan(10);
      }
    }
    return { pages: pdf.numPages, rows, occurrences, clefSizes, fingers, text: textContent, metadata: (await pdf.getMetadata()).info };
  } finally { await task.destroy(); }
}

test('PDF settings are bounded, strict and round-trip without accepting paths or musical settings', () => {
  const settings = PdfLayoutSettingsSchema.parse({ spacing: 'tight', barsPerRow: 4, scale: .75, fretMode: 'absolute', showFingerNumbers: true });
  expect(parsePdfLayoutQuery(new URLSearchParams(pdfLayoutQuery(settings)))).toEqual(settings);
  for (const query of ['scale=0', 'scale=Infinity', 'scale=5', 'barsPerRow=100', 'spacing=negative', 'spacing=tight&spacing=normal', 'showFingerNumbers=1', 'source=../../private', '__proto__=x', 'tempoScale=2']) {
    expect(() => parsePdfLayoutQuery(new URLSearchParams(query))).toThrow();
  }
});

test('HTTP PDF export uses real canonical PDF bytes, all occurrences, chosen row count and physical notation size', async () => {
  const { handle, id, files, score } = await setup();
  const results = [];
  for (const settings of [
    { spacing: 'normal', barsPerRow: 2, scale: 1 },
    { spacing: 'tight', barsPerRow: 4, scale: .75, fretMode: 'absolute', showFingerNumbers: true },
    { spacing: 'compact', barsPerRow: 3, scale: 1.25 },
  ]) {
    const selected = PdfLayoutSettingsSchema.parse({ ...settings, showMeasureLabels: true });
    const response = await handle(new Request(`http://viewer.test/arrangements/${id}/preview.pdf?${pdfLayoutQuery(selected)}`));
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-score-revision')).toBe(score.revision.digest);
    expect(response.headers.get('content-disposition')).toContain('-preview-layout.pdf');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.length).toBe(Number(response.headers.get('content-length')));
    const evidence = await inspect(bytes); results.push(evidence);
    expect(evidence.occurrences).toEqual(Array.from({ length: 12 }, (_, i) => [`o1-p${i + 1}`, `o2-p${i + 1}`]).flat());
    expect(evidence.rows).toEqual(Array.from({ length: 24 / selected.barsPerRow }, (_, i) => i + 1));
    expect(evidence.clefSizes.length).toBe(evidence.rows.length);
    expect(evidence.metadata).toMatchObject({ Keywords: pdfLayoutQuery(selected) });
  }
  expect(results[1]!.pages).toBeLessThan(results[0]!.pages);
  expect(results[1]!.clefSizes[0]! / results[0]!.clefSizes[0]!).toBeCloseTo(.75, 5);
  expect(results[2]!.clefSizes[0]! / results[0]!.clefSizes[0]!).toBeCloseTo(1.25, 5);
  expect(results[0]!.fingers).toHaveLength(0); expect(results[1]!.fingers.length).toBeGreaterThan(0);
  for (const [name, expected] of [['arrangement.pdf', files.pdf], ['arrangement.mid', files.midi], ['score.json', files.score]] as const) {
    expect(new Uint8Array(await (await handle(new Request(`http://viewer.test/arrangements/${id}/${name}`))).arrayBuffer())).toEqual(new Uint8Array(expected));
  }
}, 30000);

test('selected-layout PDF folds identical passes with native repeats and opt-in written-bar labels', async () => {
  const { handle, id } = await setup(4, false);
  const settings = PdfLayoutSettingsSchema.parse({ showMeasureLabels: true });
  const response = await handle(new Request(`http://viewer.test/arrangements/${id}/preview.pdf?${pdfLayoutQuery(settings)}`));
  expect(response.status).toBe(200);
  const evidence = await inspect(new Uint8Array(await response.arrayBuffer()));
  expect(evidence.rows).toEqual([1]); expect(evidence.occurrences).toHaveLength(0);
  expect(evidence.text.split(String.fromCodePoint(57412)).length - 1).toBe(8);
  expect(evidence.text).toContain('x4'); expect(evidence.text).toContain('S1'); expect(evidence.text).toContain('S2');
  expect(evidence.text).toContain('S=written bar'); expect(evidence.text).not.toContain('P=pass');
});

test('bad settings, missing/symlinked/corrupt sources and corrupt publications fail closed without replacing the original', async () => {
  const { handle, sourcePath, source, id, store, files } = await setup();
  const get = (suffix = '') => handle(new Request(`http://viewer.test/arrangements/${id}/preview.pdf${suffix}`));
  expect((await get('?scale=10')).status).toBe(400);
  expect((await handle(new Request(`http://viewer.test/arrangements/${id}/preview.pdf`, { method: 'POST', body: '{}' }))).status).toBe(405);
  await rm(sourcePath);
  expect((await get()).status).toBe(503);
  const outside = join(store.root, '..', 'outside-source.json'); await writeFile(outside, jsonBytes(source));
  await symlink(outside, sourcePath); expect((await get()).status).toBe(503);
  await rm(sourcePath);
  source.events[0]!.duration = { n: 2, d: 1 }; await writeFile(sourcePath, jsonBytes(source));
  expect((await get()).status).toBe(422);
  expect(new Uint8Array(await (await handle(new Request(`http://viewer.test/arrangements/${id}/arrangement.pdf`))).arrayBuffer())).toEqual(new Uint8Array(files.pdf));
  await writeFile(join(store.root, id, 'score.json'), '{}'); expect((await get()).status).toBe(409);
});

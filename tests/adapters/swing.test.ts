import { expect, test } from 'bun:test';
import { parseMidi } from 'midi-file';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { q, revisionDigest } from '../../src/domain';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { createDefaultRequest, deterministicPlanner, guitarEngine, guitarValidator } from '../../src/engine';
import { createScoreAdapter } from '../../src/adapters/server';
import { fixtureFetch, ORIGINAL_URL } from '../source/fixtures';
import { swingFixture } from '../source/swing-fixture';

test('original swung source survives engine/validator and actual PDF/MIDI exports without a second swing', async () => {
  const imported = await createSongsterrSourceAdapter({ fetch: fixtureFetch(swingFixture()) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (imported.status !== 'source-ready') throw new Error(JSON.stringify(imported));
  const source = imported.source;
  const proposal = createDefaultMelodySelection(source);
  if (proposal.status !== 'proposed') throw new Error(JSON.stringify(proposal));
  const request = createDefaultRequest(source, proposal.selection, 'intermediate');
  request.preferences.capo = { mode: 'chosen', value: 0 };
  const planned = await deterministicPlanner.plan(source, request);
  const arranged = guitarEngine.arrange(source, request, planned.plan, planned.provenance);
  if (arranged.status !== 'candidate') throw new Error(JSON.stringify(arranged));
  const score = arranged.score;
  const validation = guitarValidator.validate(source, score, { approvedRevisions: [] });
  if (validation.status !== 'passed') throw new Error(JSON.stringify(validation));
  const adapter = createScoreAdapter({ validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }) });
  const draft = { status: 'validatedDraft' as const, score, validation };
  const midi = await adapter.exportArtifact(source, draft, 'midi');
  const parsed = parseMidi(midi.bytes);
  expect(parsed.header.ticksPerBeat).toBe(960);
  const notes: number[][] = [];
  for (const track of parsed.tracks) {
    let tick = 0;
    const active = new Map<number, number>();
    for (const event of track) {
      tick += event.deltaTime;
      if (event.type === 'noteOn' && event.velocity > 0) {
        expect(active.has(event.noteNumber)).toBe(false);
        active.set(event.noteNumber, tick);
      } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        expect(active.has(event.noteNumber)).toBe(true);
        notes.push([event.noteNumber, active.get(event.noteNumber)!, tick]);
        active.delete(event.noteNumber);
      }
    }
    expect(active.size).toBe(0);
    expect(tick).toBe(15360);
  }
  // Independent literal PPQ960 oracle, not importer/engine-generated expectations.
  expect(notes).toEqual([
    [60, 0, 640], [62, 640, 960], [64, 1920, 3520], [65, 3520, 3840],
    [60, 3840, 4480], [62, 4480, 5120], [64, 5120, 5760],
    [60, 5760, 6400], [62, 6400, 6720], [64, 6720, 7360], [65, 7360, 7680],
    ...Array.from({ length: 8 }, (_, i) => [60 + i % 3, 7680 + i * 480, 7680 + (i + 1) * 480]),
    ...Array.from({ length: 16 }, (_, i) => {
      const start = 11520 + Math.floor(i / 2) * 480 + i % 2 * 320;
      return [60 + i % 3, start, start + (i % 2 === 0 ? 320 : 160)];
    }),
  ]);
  const pdf = await adapter.exportArtifact(source, draft, 'pdf');
  const task = getDocument({ data: new Uint8Array(pdf.bytes), useSystemFonts: true });
  try {
    const document = await task.promise;
    let text = '';
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      text += content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ');
    }
    expect(text).toContain('unreviewed-draft');
    expect(text).toContain('\ue050'); // Actual treble clef and TAB glyphs in exported bytes.
    expect(text).toContain('\ue06d');
  } finally { await task.destroy(); }
  const straightened = structuredClone(score);
  straightened.sounds[0]!.duration = q(1, 2);
  straightened.revision.digest = await revisionDigest(straightened);
  expect(guitarValidator.validate(source, straightened, { approvedRevisions: [] }).status).toBe('failed');
}, 30000);

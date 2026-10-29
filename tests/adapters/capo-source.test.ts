import { expect, test } from 'bun:test';
import { parseMidi } from 'midi-file';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { createDefaultRequest, deterministicPlanner, guitarEngine, guitarValidator } from '../../src/engine';
import { createScoreAdapter } from '../../src/adapters/server';
import { fixtureFetch, ORIGINAL_URL } from '../source/fixtures';
import { capoFixture } from '../source/capo-fixture';

test.each([0, 2])('source capo and arrangement capo %i remain independent through real PDF/MIDI export', async (capo) => {
  const imported = await createSongsterrSourceAdapter({ fetch: fixtureFetch(capoFixture()) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (imported.status !== 'source-ready') throw new Error(JSON.stringify(imported));
  const source = imported.source;
  const proposal = createDefaultMelodySelection(source);
  if (proposal.status !== 'proposed') throw new Error(JSON.stringify(proposal));
  const request = createDefaultRequest(source, proposal.selection, 'intermediate');
  request.preferences.capo = { mode: 'chosen', value: capo };
  const planned = await deterministicPlanner.plan(source, request);
  const arranged = guitarEngine.arrange(source, request, planned.plan, planned.provenance);
  if (arranged.status !== 'candidate') throw new Error(JSON.stringify(arranged));
  const score = arranged.score;
  const validation = guitarValidator.validate(source, score, { approvedRevisions: [] });
  if (validation.status !== 'passed') throw new Error(JSON.stringify(validation));
  expect(score.instrument.capo).toBe(capo);
  expect(score.performedSounds.map((performed) => score.sounds.find((sound) => sound.id === performed.soundId)!.soundingMidi)).toEqual([42, 48, 57, 62, 69]);
  const adapter = createScoreAdapter({ validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }) });
  const draft = { status: 'validatedDraft' as const, score, validation };
  const midi = await adapter.exportArtifact(source, draft, 'midi');
  const parsed = parseMidi(midi.bytes);
  expect(parsed.tracks.flatMap((track) => track.flatMap((event) => event.type === 'noteOn' ? [event.noteNumber] : []))).toEqual([42, 48, 57, 62, 69]);
  const pdf = await adapter.exportArtifact(source, draft, 'pdf');
  const task = getDocument({ data: new Uint8Array(pdf.bytes), useSystemFonts: true });
  try {
    const document = await task.promise;
    const content = await (await document.getPage(1)).getTextContent();
    const text = content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ');
    expect(text).toContain('\ue050');
    expect(text).toContain('\ue06d');
    expect(text).toContain('unreviewed-draft');
  } finally { await task.destroy(); }
}, 30000);

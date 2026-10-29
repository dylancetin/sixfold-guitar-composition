import { expect, test } from 'bun:test';
import { parseMidi } from 'midi-file';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { createDefaultRequest, deterministicPlanner, guitarEngine, guitarValidator } from '../../src/engine';
import { createScoreAdapter } from '../../src/adapters/server';
import { fixtureFetch, ORIGINAL_URL } from '../source/fixtures';
import { graceFixture } from '../source/grace-fixture';

test('grace attacks survive the real engine, validator, canonical PDF/MIDI, with literal tick boundaries', async () => {
  const imported = await createSongsterrSourceAdapter({ fetch: fixtureFetch(graceFixture()) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (imported.status !== 'source-ready') throw new Error(JSON.stringify(imported));
  const source = imported.source;
  const proposal = createDefaultMelodySelection(source);
  if (proposal.status !== 'proposed') throw new Error(JSON.stringify(proposal));
  const request = createDefaultRequest(source, proposal.selection, 'intermediate');
  const planned = await deterministicPlanner.plan(source, request);
  const arranged = guitarEngine.arrange(source, request, planned.plan, planned.provenance);
  if (arranged.status !== 'candidate') throw new Error(JSON.stringify(arranged));
  const score = arranged.score;
  const validation = guitarValidator.validate(source, score, { approvedRevisions: [] });
  if (validation.status !== 'passed') throw new Error(JSON.stringify(validation));
  expect(score.sounds.filter((sound) => sound.role === 'melody')).toHaveLength(5);
  const adapter = createScoreAdapter({ validator: guitarValidator, getValidationContext: () => ({ approvedRevisions: [] }) });
  const draft = { status: 'validatedDraft' as const, score, validation };
  const midi = await adapter.exportArtifact(source, draft, 'midi');
  const parsed = parseMidi(midi.bytes);
  expect(parsed.header.ticksPerBeat).toBe(960);
  const boundaries: [string, number, number][] = [];
  let tick = 0;
  for (const event of parsed.tracks[1]!) {
    tick += event.deltaTime;
    if (event.type === 'noteOn' || event.type === 'noteOff') boundaries.push([event.type, event.noteNumber, tick]);
  }
  expect(boundaries).toEqual([
    ['noteOn', 60, 0], ['noteOff', 60, 2640],
    ['noteOn', 61, 2640], ['noteOff', 61, 2720],
    ['noteOn', 63, 2720], ['noteOff', 63, 2800],
    ['noteOn', 65, 2800], ['noteOff', 65, 2880],
    ['noteOn', 67, 2880], ['noteOff', 67, 3840],
  ]);
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

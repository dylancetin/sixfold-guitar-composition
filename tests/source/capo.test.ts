import { expect, test } from 'bun:test';
import { verifyRevisionDigest } from '../../src/domain';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { capoFixture } from './capo-fixture';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

async function imported(fixture = capoFixture()) {
  return createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
}

test.each([5, 8])('source format %i adds capo once, preserves original positions, and remains selectable', async (version) => {
  const fixture = capoFixture();
  fixture.parts.get(4)!.version = version;
  const result = await imported(fixture);
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  expect(result.source.parts[0]!.sourceTuning).toEqual({ order: 'high-to-low', soundingMidi: [66, 61, 57, 52, 47, 42] });
  const notes = result.source.events.filter((event) => event.kind === 'note');
  expect(notes.map((note) => note.soundingMidi)).toEqual([42, 48, 57, 62, 69]);
  expect(notes.map((note) => note.refs[0]!.sourcePosition)).toEqual([
    { stringIndex: 5, fret: 0 }, { stringIndex: 4, fret: 1 }, { stringIndex: 2, fret: 0 }, { stringIndex: 1, fret: 1 }, { stringIndex: 0, fret: 3 },
  ]);
  expect(notes.every((note) => note.effects.some((effect) => effect.code === 'source-capo' && !effect.affectsMelody))).toBe(true);
  expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes('source capo 2 materialized once'))).toBe(true);
  expect(createDefaultMelodySelection(result.source).status).toBe('proposed');
  expect(await verifyRevisionDigest(result.source)).toBe(true);
});

test.each([undefined, null, 0])('absent/null/zero source capo %s leaves tuning and notes unchanged', async (capo) => {
  const fixture = capoFixture();
  if (capo === undefined) delete fixture.parts.get(4)!.capo;
  else fixture.parts.get(4)!.capo = capo;
  const result = await imported(fixture);
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  expect(result.source.parts[0]!.sourceTuning?.soundingMidi).toEqual([64, 59, 55, 50, 45, 40]);
  expect(result.source.events.flatMap((event) => event.kind === 'note' ? [event.soundingMidi] : [])).toEqual([40, 46, 55, 60, 67]);
  expect(result.source.events.some((event) => event.kind === 'note' && event.effects.some((effect) => effect.code === 'source-capo'))).toBe(false);
});

test('source capo applies to metadata tuning fallback without mutating metadata or raw artifacts', async () => {
  const fixture = capoFixture(8);
  delete fixture.parts.get(4)!.tuning;
  const before = structuredClone(fixture);
  const saved: Uint8Array[] = [];
  const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture), saveArtifact: async ({ bytes }) => { saved.push(bytes); } }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  expect(result.source.parts[0]!.sourceTuning?.soundingMidi).toEqual([72, 67, 63, 58, 53, 48]);
  expect(result.source.events.flatMap((event) => event.kind === 'note' ? [event.soundingMidi] : [])).toEqual([48, 54, 63, 68, 75]);
  expect(JSON.parse(new TextDecoder().decode(saved[1]))).toEqual(before.parts.get(4));
  expect(fixture).toEqual(before);
});

test('different part capos do not change shared form, ties, unison refs or unrelated parts', async () => {
  const fixture = originalFixture();
  fixture.parts.get(4)!.capo = 2;
  fixture.parts.get(6)!.capo = 8;
  const result = await imported(fixture);
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  const lead = result.source.events.filter((event) => event.kind === 'note').filter((event) => event.partId === 4);
  expect(lead.map((note) => note.soundingMidi)).toEqual([62, 64, 66, 67, 62, 63, 64, 65]);
  expect(lead[3]!.duration).toEqual({ n: 3, d: 1 });
  expect(lead[3]!.refs).toHaveLength(2);
  expect(result.source.events.flatMap((event) => event.kind === 'note' && event.partId === 2 ? [event.soundingMidi] : [])).toEqual([67, 67]);
  expect(result.source.form.repeats).toHaveLength(1);
});

test('tuningFlat changes display preference only, never source pitches', async () => {
  const flat = capoFixture();
  const sharp = capoFixture();
  sharp.parts.get(4)!.tuningFlat = false;
  const a = await imported(flat), b = await imported(sharp);
  if (a.status !== 'source-ready' || b.status !== 'source-ready') throw new Error(JSON.stringify({ a, b }));
  expect(a.source.events).toEqual(b.source.events);
  expect(a.source.parts).toEqual(b.source.parts);
});

test.each([
  ['negative capo', { capo: -1 }], ['fractional capo', { capo: 1.5 }], ['excessive capo', { capo: 25 }],
  ['string capo', { capo: '2' }], ['invalid tuningFlat', { tuningFlat: 'true' }],
  ['effective tuning overflow', { tuning: [127], capo: 2 }],
  ['note pitch overflow', { tuning: [125, 125, 125, 125, 125, 125], capo: 1 }],
  ['unknown partial capo', { capoPartial: { fret: 2, strings: [0] } }],
  ['missing tuning', { tuning: undefined }],
] as const)('rejects %s without a partial pitched score', async (label, fields) => {
  const fixture = capoFixture();
  Object.assign(fixture.parts.get(4)!, fields);
  if (label === 'missing tuning') delete (fixture.metadata.tracks[0]! as Record<string, unknown>).tuning;
  const result = await imported(fixture);
  expect(result.status).toBe('unsupported');
  expect('source' in result).toBe(false);
});

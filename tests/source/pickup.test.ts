import { describe, expect, test } from 'bun:test';
import { q, verifyRevisionDigest } from '../../src/domain';
import { expandForm } from '../../src/engine/form';
import { createSongsterrSourceAdapter } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

// Original pickup exercise only; no downloaded music.
type Beat = Record<string, unknown>;
const quarterRest = (): Beat => ({ type: 4, duration: [1, 4], rest: true, notes: [{ rest: true }] });
const note = (type: number, fret: number, extra: Beat = {}): Beat => ({ type, duration: [1, type], notes: [{ string: 0, fret }], ...extra });

function fixture(pickupVoices: { rest?: boolean; beats: Beat[] }[], options: { anacrusis?: unknown; pickupRest?: boolean } = { anacrusis: true }) {
  const result = originalFixture();
  result.metadata.tracks = result.metadata.tracks.filter((track) => track.partId === 4);
  const part = result.parts.get(4)!;
  part.measures = [
    { signature: [4, 4], ...(options.pickupRest ? { rest: true } : {}), voices: pickupVoices },
    { voices: [{ beats: [note(1, 2)] }] },
  ];
  part.automations = { tempo: [{ measure: 0, bpm: 80 }] };
  if (options.anacrusis !== undefined) part.anacrusis = options.anacrusis;
  return result;
}
async function imported(value: ReturnType<typeof originalFixture>) {
  return createSongsterrSourceAdapter({ fetch: fixtureFetch(value) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
}

describe('declared opening pickup (Songsterr anacrusis)', () => {
  test('sizes bar 1 from its explicit beats and starts bar 2 at the pickup end', async () => {
    const result = await imported(fixture([{ rest: true, beats: [quarterRest()] }], { anacrusis: true, pickupRest: true }));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    const { source } = result;
    expect(await verifyRevisionDigest(source)).toBe(true);
    expect(source.bars[0]).toMatchObject({ id: 'bar-1', kind: 'pickup', start: q(0), length: q(1), meter: { beats: 4, beatUnit: 4 } });
    expect(source.bars[1]).toMatchObject({ id: 'bar-2', kind: 'full', start: q(1), length: q(4) });
    expect(source.events.map((event) => [event.kind, event.start, event.duration])).toEqual([['rest', q(0), q(1)], ['note', q(1), q(4)]]);
    const expansion = expandForm(source);
    expect(expansion.status).toBe('expanded');
    if (expansion.status === 'expanded') expect(expansion.length).toEqual(q(5));
  });

  test('grace notation adds no pickup time; a whole-bar rest voice fills the derived length', async () => {
    const result = await imported(fixture([
      { beats: [note(64, 5, { graceNote: 'onBeat' }), note(8, 7), note(8, 9)] },
      { rest: true, beats: [{ type: 1, duration: [1, 1], rest: true, notes: [{ rest: true }] }] },
    ]));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.bars[0]).toMatchObject({ kind: 'pickup', length: q(1) });
    expect(result.source.events.filter((event) => event.voiceId === 'p4:v1' && event.kind === 'rest')[0]).toMatchObject({ start: q(0), duration: q(1) });
  });

  test('anacrusis false or absent keeps the full opening bar unchanged', async () => {
    for (const anacrusis of [false, undefined]) {
      const result = await imported(fixture([{ beats: [note(1, 0)] }], { anacrusis }));
      if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
      expect(result.source.bars[0]).toMatchObject({ kind: 'full', length: q(4) });
    }
  });

  test.each([
    ['disagreeing voices', [{ beats: [quarterRest()] }, { beats: [note(2, 0)] }], 'disagree'],
    ['a full-length pickup', [{ beats: [note(1, 0)] }], 'not shorter'],
    ['only an indeterminate whole-bar rest', [{ rest: true, beats: [{ type: 1, duration: [1, 1], rest: true, notes: [{ rest: true }] }] }], 'determines its length'],
  ] as const)('fails closed for %s', async (_label, voices, message) => {
    const result = await imported(fixture(voices as unknown as { beats: Beat[] }[]));
    expect(result.status).toBe('unsupported');
    expect(result.diagnostics[0]!.message).toContain(message);
    expect('source' in result).toBe(false);
  });

  test('a tie from the pickup into bar 2 stays one exact attack', async () => {
    const value = fixture([{ beats: [note(4, 2)] }]);
    (value.parts.get(4)!.measures as { voices: { beats: Beat[] }[] }[])[1]!.voices[0]!.beats = [{ ...note(1, 2), notes: [{ string: 0, fret: 2, tie: true }] }];
    const result = await imported(value);
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.map((event) => [event.kind, event.start, event.duration])).toEqual([['note', q(0), q(5)]]);
  });

  test('parts that disagree on the pickup length fail closed', async () => {
    const value = fixture([{ beats: [quarterRest()] }]);
    const other = structuredClone(value.parts.get(4)!);
    other.partId = 2;
    (other.measures as { voices: { beats: Beat[] }[] }[])[0]!.voices[0]!.beats = [{ type: 2, duration: [1, 2], rest: true, notes: [{ rest: true }] }];
    value.parts.set(2, other);
    value.metadata.tracks = originalFixture().metadata.tracks.filter((track) => track.partId === 2 || track.partId === 4);
    const result = await imported(value);
    expect(result.status).toBe('unsupported');
    expect(result.diagnostics[0]!.message).toContain('disagrees on written bars');
    expect('source' in result).toBe(false);
  });

  test('accepts an explicit false short-drone flag but rejects a short drone string', async () => {
    const value = fixture([{ beats: [quarterRest()] }]);
    value.parts.get(4)!.tuningShortDrone = false;
    expect((await imported(value)).status).toBe('source-ready');
    value.parts.get(4)!.tuningShortDrone = true;
    const rejected = await imported(value);
    expect(rejected.status).toBe('unsupported');
    expect(rejected.diagnostics[0]!.message).toContain('short drone');
  });

  test('rejects a non-boolean anacrusis flag at the raw boundary', async () => {
    const result = await imported(fixture([{ beats: [quarterRest()] }], { anacrusis: 'yes' }));
    expect(result.status).toBe('unsupported');
    expect('source' in result).toBe(false);
  });
});

import { describe, expect, test } from 'bun:test';
import { eventEnd, q, verifyRevisionDigest } from '../../src/domain';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { swingDurations } from '../../src/source/swing';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';
import { swingFixture } from './swing-fixture';

async function imported(fixture = swingFixture()) {
  return createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
}
const rhythm = (n: number, d = 1, actual: number | null = null) => ({ duration: q(n, d), actual });

describe('exact swing interpretation — original fixtures', () => {
  test('inherits eighth feel, resets off, switches to sixteenths, and never reswings explicit triplets', async () => {
    const result = await imported();
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    const { source } = result;
    expect(await verifyRevisionDigest(source)).toBe(true);
    expect(source.manifest.parser.version).toBe('1.4.1');
    const intervals = source.events.map((event) => [event.start, event.duration]);
    expect(intervals.slice(0, 5)).toEqual([
      [q(0), q(2, 3)], [q(2, 3), q(1, 3)], [q(1), q(1)], [q(2), q(5, 3)], [q(11, 3), q(1, 3)],
    ]);
    expect(intervals.slice(5, 12)).toEqual([
      [q(4), q(2, 3)], [q(14, 3), q(2, 3)], [q(16, 3), q(2, 3)],
      [q(6), q(2, 3)], [q(20, 3), q(1, 3)], [q(7), q(2, 3)], [q(23, 3), q(1, 3)],
    ]);
    expect(intervals.slice(12, 20)).toEqual(Array.from({ length: 8 }, (_, i) => [q(16 + i, 2), q(1, 2)]));
    expect(intervals.slice(20, 24)).toEqual([[q(12), q(1, 3)], [q(37, 3), q(1, 6)], [q(25, 2), q(1, 3)], [q(77, 6), q(1, 6)]]);
    expect(eventEnd(source.events.at(-1)!)).toEqual(q(16));
    expect(source.events[0]!.refs[0]!.rawWholeNoteDuration).toEqual(q(1, 8));
    expect(source.events[0]!.kind === 'note' && source.events[0]!.effects.find((effect) => effect.code === 'source-triplet-feel')).toMatchObject({ affectsMelody: false });
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'info' && diagnostic.message.includes('exact 2:1'))).toBe(true);
    expect(createDefaultMelodySelection(source).status).toBe('proposed');
  });

  test('rests and tied continuations use interpreted durations while retaining raw fractions', async () => {
    const fixture = originalFixture();
    const beats = [
      { type: 8, duration: [1, 8], notes: [{ string: 0, fret: 0 }] },
      { type: 8, duration: [1, 8], notes: [{ string: 0, fret: 0, tie: true }] },
      { type: 8, duration: [1, 8], rest: true, notes: [{ rest: true }] },
      { type: 8, duration: [1, 8], notes: [{ string: 0, fret: 2 }] },
      { type: 2, duration: [1, 2], notes: [{ string: 0, fret: 4 }] },
    ];
    fixture.metadata.tracks = fixture.metadata.tracks.filter((track) => track.partId === 4);
    fixture.parts.get(4)!.measures = [{ signature: [4, 4], tripletFeel: '8th', voices: [{ beats }] }];
    fixture.parts.get(4)!.automations = { tempo: [{ measure: 0, bpm: 80 }] };
    const result = await imported(fixture);
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.map((event) => [event.kind, event.start, event.duration])).toEqual([
      ['note', q(0), q(1)], ['rest', q(1), q(2, 3)], ['note', q(5, 3), q(1, 3)], ['note', q(2), q(2)],
    ]);
    expect(result.source.events[0]!.refs.map((ref) => ref.rawWholeNoteDuration)).toEqual([q(1, 8), q(1, 8)]);
    expect(result.source.events[0]!.kind === 'note' && result.source.events[0]!.tieChainId).toBe('tie:p4:b1:v0:bt0:n0');
  });

  test('tuplets and finer subdivisions disable only their pair across all voices', () => {
    const voices = [
      { rhythms: [rhythm(1, 2), rhythm(1, 2), rhythm(1, 2), rhythm(1, 2)] },
      { rhythms: [rhythm(1, 3, 3), rhythm(1, 3, 3), rhythm(1, 3, 3), rhythm(1)] },
    ];
    expect(swingDurations(voices, '8th', q(2))).toEqual([
      [q(1, 2), q(1, 2), q(2, 3), q(1, 3)], [q(1, 3), q(1, 3), q(1, 3), q(1)],
    ]);
    expect(swingDurations([{ rhythms: [rhythm(1, 4), rhythm(1, 4), rhythm(1, 2), rhythm(1, 2), rhythm(1, 2)] }], '8th', q(2))).toEqual([[q(1, 4), q(1, 4), q(1, 2), q(2, 3), q(1, 3)]]);
    expect(swingDurations([{ rhythms: [rhythm(3, 4, 2), rhythm(3, 4, 2)] }], '8th', q(3, 2))).toEqual([[q(3, 4), q(3, 4)]]);
  });

  test('an incomplete final pair is not stretched past the barline', () => {
    expect(swingDurations([{ rhythms: [rhythm(1, 2), rhythm(1, 2), rhythm(1, 2)] }], '8th', q(3, 2))).toEqual([[q(2, 3), q(1, 3), q(1, 2)]]);
  });

  test.each(['off', 'none', null, undefined])('straight/default setting %j preserves exact nominal timing', async (feel) => {
    const fixture = originalFixture();
    for (const part of fixture.parts.values()) (part.measures as Record<string, unknown>[])[0]!.tripletFeel = feel;
    const result = await imported(fixture);
    expect(result.status).toBe('source-ready');
  });

  test.each(['shuffle', 'dotted8th', 8, false, {}])('unknown/unsupported feel %j fails closed', async (feel) => {
    const fixture = swingFixture();
    (fixture.parts.get(4)!.measures as Record<string, unknown>[])[0]!.tripletFeel = feel;
    const result = await imported(fixture);
    expect(result.status).toBe('unsupported');
    expect('source' in result).toBe(false);
    expect(result.diagnostics[0]!.message).toContain('Unsupported swing/triplet feel');
  });

  test('contradictory part settings are not silently combined', async () => {
    const fixture = originalFixture();
    (fixture.parts.get(2)!.measures as Record<string, unknown>[])[0]!.tripletFeel = '8th';
    const result = await imported(fixture);
    expect(result.status).toBe('unsupported');
    expect(result.diagnostics[0]!.code).toBe('form-mismatch');
  });

  test('tempo changes inside a swung pair remain an explicit unsupported boundary', async () => {
    const fixture = swingFixture();
    fixture.parts.get(4)!.automations = { tempo: [{ measure: 0, bpm: 80 }, { measure: 0, bpm: 90, position: 1, type: 8 }] };
    const result = await imported(fixture);
    expect(result.status).toBe('unsupported');
    expect(result.diagnostics[0]!.code).toBe('tempo-mismatch');
  });

  test('unknown grace semantics are rejected rather than converted into a full-duration attack', async () => {
    const fixture = swingFixture();
    const measures = fixture.parts.get(4)!.measures as { voices: { beats: Record<string, unknown>[] }[] }[];
    measures[0]!.voices[0]!.beats[0]!.graceNote = 'unknown';
    const result = await imported(fixture);
    expect(result.status).toBe('unsupported');
    expect(result.diagnostics[0]!.message).toContain('graceNote');
  });
});

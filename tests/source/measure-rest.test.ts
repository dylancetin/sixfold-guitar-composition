import { describe, expect, test } from 'bun:test';
import { q, verifyRevisionDigest } from '../../src/domain';
import { createSongsterrSourceAdapter } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

// Original rest exercise only; no downloaded music.
function fixture(meter: [number, number] = [2, 4]) {
  const result = originalFixture();
  result.metadata.tracks = result.metadata.tracks.filter((track) => track.partId === 4);
  result.parts.get(4)!.measures = [{ signature: meter, rest: true, voices: [{ rest: true, beats: [{ type: 1, duration: [1, 1], rest: true, notes: [{ rest: true }] }] }] }];
  result.parts.get(4)!.automations = { tempo: [{ measure: 0, bpm: 80 }] };
  return result;
}
async function imported(value = fixture()) {
  return createSongsterrSourceAdapter({ fetch: fixtureFetch(value) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
}

describe('explicit full-measure rests', () => {
  test('still rejects an entirely unversioned source rather than inventing a format version', async () => {
    const value = fixture();
    delete value.parts.get(4)!.version;
    const result = await imported(value);
    expect(result.status).toBe('unsupported');
    expect(result.diagnostics[0]!.message).toContain('version');
    expect('source' in result).toBe(false);
  });

  test.each([[2, 4, 2], [3, 4, 3], [6, 4, 6], [6, 8, 3]] as const)('whole-rest symbol fills %i/%i with %i quarters, preserving its raw fraction', async (beats, unit, quarters) => {
    const result = await imported(fixture([beats, unit]));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(await verifyRevisionDigest(result.source)).toBe(true);
    expect(result.source.events).toHaveLength(1);
    expect(result.source.events[0]!.kind).toBe('rest');
    expect(result.source.events[0]!.duration).toEqual(q(quarters));
    expect(result.source.events[0]!.refs[0]!.rawWholeNoteDuration).toEqual(q(1));
    expect(result.diagnostics.some((d) => d.message.includes('full-measure rest'))).toBe(true);
  });

  test.each(['pitched', 'unflagged', 'multiple', 'dotted', 'grace'] as const)('does not stretch or truncate an ambiguous %s beat to fit', async (kind) => {
    const value = fixture();
    const measure = (value.parts.get(4)!.measures as { rest?: boolean; voices: { rest?: boolean; beats: Record<string, unknown>[] }[] }[])[0]!;
    const voice = measure.voices[0]!;
    const beat = voice.beats[0]!;
    if (kind === 'pitched') beat.notes = [{ string: 0, fret: 0 }];
    if (kind === 'unflagged') { delete measure.rest; delete voice.rest; }
    if (kind === 'multiple') voice.beats.push(structuredClone(beat));
    if (kind === 'dotted') { beat.dots = 1; beat.duration = [3, 2]; }
    if (kind === 'grace') beat.graceNote = 'onBeat';
    const result = await imported(value);
    expect(result.status).toBe('unsupported');
    expect('source' in result).toBe(false);
  });
});

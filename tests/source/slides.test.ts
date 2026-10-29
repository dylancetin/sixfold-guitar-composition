import { describe, expect, test } from 'bun:test';
import { q } from '../../src/domain';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

function fixture(slide: string = 'legato') {
  const value = originalFixture();
  value.metadata.tracks = value.metadata.tracks.filter((track) => track.partId === 4);
  value.parts.get(4)!.automations = { tempo: [{ measure: 0, bpm: 80 }] };
  value.parts.get(4)!.measures = [{ signature: [4, 4], voices: [{ beats: [
    { type: 4, duration: [1, 4], notes: [{ string: 0, fret: 0, slide }] },
    { type: 4, duration: [1, 4], notes: [{ string: 0, fret: 2 }] },
    { type: 2, duration: [1, 2], rest: true, notes: [{ rest: true }] },
  ] }] }];
  return value;
}
const imported = (value = fixture()) => createSongsterrSourceAdapter({ fetch: fixtureFetch(value) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });

describe('explicit closed-slide endpoint interpretation — original exercise', () => {
  test.each(['legato', 'shift'])('%s preserves exact source endpoints, times and articulation evidence', async (kind) => {
    const result = await imported(fixture(kind));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.map((event) => [event.kind === 'note' ? event.soundingMidi : null, event.start, event.duration])).toEqual([[60, q(0), q(1)], [62, q(1), q(1)], [null, q(2), q(2)]]);
    const first = result.source.events[0]!;
    if (first.kind !== 'note') throw new Error('Expected note');
    const effect = first.effects.find((effect) => effect.code === 'articulation-closed-slide')!;
    expect(JSON.parse(effect.description)).toMatchObject({ kind, fromMidi: 60, toMidi: 62, targetRef: 'p4:b1:v0:bt1:n0' });
    expect(effect.affectsMelody).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('continuous glides and slide glyphs are not reproduced'))).toBe(true);
    expect(createDefaultMelodySelection(result.source).status).toBe('proposed');
  });

  test.each(['below', 'upwards', 'unknown', 'rest-target', 'different-string', 'tied-target'] as const)('keeps %s slides unsupported; never substitutes a pitch or silence', async (kind) => {
    const value = fixture(['below', 'upwards', 'unknown'].includes(kind) ? kind : 'legato');
    const beats = (value.parts.get(4)!.measures as { voices: { beats: { rest?: boolean; notes: Record<string, unknown>[] }[] }[] }[])[0]!.voices[0]!.beats;
    if (kind === 'rest-target') { beats[1]!.rest = true; beats[1]!.notes = [{ rest: true }]; }
    if (kind === 'different-string') beats[1]!.notes[0]!.string = 1;
    if (kind === 'tied-target') { beats[1]!.notes[0]!.fret = 0; beats[1]!.notes[0]!.tie = true; }
    const result = await imported(value);
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(createDefaultMelodySelection(result.source).status).toBe('selection-needed');
    const first = result.source.events[0]!;
    expect(first.kind === 'note' && first.effects.some((effect) => effect.code === 'unsupported-slide' && effect.affectsMelody)).toBe(true);
  });
});

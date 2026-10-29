// Original rhythm exercise, not downloaded song data.
import { originalFixture } from './fixtures';

export function swingFixture() {
  const fixture = originalFixture();
  const note = (fret: number, type: number, duration: [number, number]) => ({ type, duration, notes: [{ string: 0, fret }] });
  const measures = [
    { signature: [4, 4], tripletFeel: '8th', voices: [{ beats: [
      note(0, 8, [1, 8]), note(2, 8, [1, 8]),
      { type: 4, duration: [1, 4], rest: true, notes: [{ rest: true }] },
      { ...note(4, 4, [3, 8]), dots: 1 }, note(5, 8, [1, 8]),
    ] }] },
    { voices: [{ beats: [
      ...[0, 2, 4].map((fret) => ({ ...note(fret, 4, [1, 6]), tuplet: 3 })),
      ...[0, 2, 4, 5].map((fret) => note(fret, 8, [1, 8])),
    ] }] },
    { tripletFeel: 'off', voices: [{ beats: Array.from({ length: 8 }, (_, i) => note(i % 3, 8, [1, 8])) }] },
    { tripletFeel: '16th', voices: [{ beats: Array.from({ length: 16 }, (_, i) => note(i % 3, 16, [1, 16])) }] },
  ];
  const part = fixture.parts.get(4)!;
  part.measures = measures;
  part.automations = { tempo: [{ measure: 0, bpm: 80, type: 4, position: 0 }] };
  fixture.metadata.tracks = fixture.metadata.tracks.filter((track) => track.partId === 4);
  fixture.parts = new Map([[4, part]]);
  return fixture;
}

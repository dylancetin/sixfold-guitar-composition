// Entirely original ornament exercise. No downloaded song data.
import type { RawBeat } from '../../src/source/raw';
import { originalFixture } from './fixtures';

export const graceNote = (fret: number, kind: 'beforeBeat' | 'onBeat'): RawBeat => ({ type: 16, duration: [1, 16], graceNote: kind, notes: [{ string: 0, fret }] });
export function graceFixture(beats: RawBeat[] = [
  { type: 2, dots: 1, duration: [3, 4], notes: [{ string: 0, fret: 0 }] },
  ...[1, 3, 5].map((fret) => graceNote(fret, 'beforeBeat')),
  { type: 4, duration: [1, 4], notes: [{ string: 0, fret: 7 }] },
]) {
  const fixture = originalFixture();
  fixture.metadata.tracks = fixture.metadata.tracks.filter((track) => track.partId === 4);
  const part = fixture.parts.get(4)!;
  part.measures = [{ signature: [4, 4], tripletFeel: '8th', voices: [{ beats }] }];
  part.automations = { tempo: [{ measure: 0, bpm: 80 }] };
  return fixture;
}

// Original one-bar pitch exercise, not a downloaded musical excerpt.
import { originalFixture } from './fixtures';

export function capoFixture(capo: number | null = 2) {
  const fixture = originalFixture();
  const tuning = [64, 59, 55, 50, 45, 40];
  fixture.metadata.tracks = [{ partId: 4, name: 'Lead candidate', instrumentId: 68, tuning }];
  fixture.parts = new Map([[4, {
    songId: 123456, revisionId: 987654, version: 8, partId: 4, instrumentId: 68,
    tuning, capo, tuningFlat: true,
    measures: [{ signature: [5, 4], voices: [{ beats: [
      [5, 0], [4, 1], [2, 0], [1, 1], [0, 3],
    ].map(([string, fret]) => ({ type: 4, duration: [1, 4], notes: [{ string, fret }] })) }] }],
    automations: { tempo: [{ measure: 0, bpm: 80, type: 4, position: 0 }] },
  }]]);
  return fixture;
}

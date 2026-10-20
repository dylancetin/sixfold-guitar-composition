// Entirely original four-bar music/security fixtures. No downloaded song data.
import type { SourceFetch } from '../../src/source';

export const ORIGINAL_URL = 'https://www.songsterr.com/a/wsa/original-source-fixture-s123456';
const note = (fret: number, duration: number[], type: number, extras: Record<string, unknown> = {}) => ({ duration, type, notes: [{ string: 0, fret, ...extras }] });
const rest = () => ({ type: 1, duration: [1, 1], rest: true, notes: [{ rest: true }] });
const measures = (beats: unknown[][]) => beats.map((b, i) => ({ ...(i === 0 ? { signature: [4, 4] } : {}), ...(i === 1 ? { repeatStart: true } : {}), ...(i === 2 ? { repeat: 2 } : {}), voices: [{ beats: b }] }));
export function originalFixture() {
  const part = (partId: number, instrumentId: number, beats: unknown[][]) => ({ songId: 123456, revisionId: 987654, version: 5, partId, instrumentId, tuning: [60, 48], capo: 0, measures: measures(beats), automations: { tempo: [{ measure: 0, bpm: 80, type: 4, position: 0 }, { measure: 1, bpm: 90, type: 4, position: 0 }] } });
  return {
    metadata: {
      songId: 123456, revisionId: 987654, image: 'original-public-token', title: 'Original exact source exercise', artist: 'Project test authors',
      hasPlayer: true, isBlocked: false, isRestricted: false, restriction: '', defaultTrack: 2,
      tracks: [
        { partId: 2, name: 'Default accompaniment', instrumentId: 26, tuning: [60, 48] },
        { partId: 4, name: 'Lead candidate', instrumentId: 68, tuning: [60, 48] },
        { partId: 6, name: 'Choir intro alternatives', instrumentId: 54, tuning: [60, 48] },
      ],
    },
    parts: new Map<number, Record<string, unknown>>([
      [2, part(2, 26, [[rest()], [note(7, [1, 1], 1)], [rest()], [note(7, [1, 1], 1)]])],
      [4, part(4, 68, [
        [rest()],
        [...[0, 2, 4].map((fret, i) => ({ ...note(fret, [1, 6], 4), tuplet: 3, ...(i === 0 ? { tupletStart: true } : {}), ...(i === 2 ? { tupletStop: true } : {}) })), note(5, [1, 2], 2)],
        [note(5, [1, 4], 4, { tie: true }), { type: 2, duration: [3, 4], dots: 1, rest: true, notes: [{ rest: true }] }],
        [0, 1, 2, 3].map((fret) => note(fret, [1, 4], 4)),
      ])],
      [6, part(6, 54, [[
        { type: 2, duration: [1, 2], notes: [{ string: 0, fret: 12 }, { string: 1, fret: 12 }] },
        { type: 2, duration: [1, 2], notes: [{ string: 0, fret: 14 }, { string: 1, fret: 14 }] },
      ], [rest()], [rest()], [rest()]])],
    ]),
  };
}
export type OriginalFixture = ReturnType<typeof originalFixture>;
export function page(metadata: unknown) { return `<html><script id="state" type="application/json">${JSON.stringify({ meta: { current: metadata } })}</script></html>`; }
export function fixtureFetch(fixture: OriginalFixture, calls: string[] = []): SourceFetch {
  return async (url, init) => {
    calls.push(url);
    if (init.redirect !== 'manual' || init.credentials !== 'omit') throw new Error('Unsafe request options');
    if (url.startsWith('https://www.songsterr.com/a/wsa/')) return new Response(page(fixture.metadata), { headers: { 'content-type': 'text/html' } });
    const partId = Number(/\/(\d+)\.json$/.exec(url)?.[1]);
    const part = fixture.parts.get(partId);
    if (!part) throw new Error('Unexpected offline request: ' + url);
    return new Response(JSON.stringify(part), { headers: { 'content-type': 'application/json' } });
  };
}

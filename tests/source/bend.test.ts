import { expect, test } from 'bun:test';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { verifyRevisionDigest } from '../../src/domain';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

// Original exercise, not a downloaded musical excerpt.
function fixture(bend: unknown = { tone: 100, points: [{ position: 0, tone: 0 }, { position: 60, tone: 100 }] }) {
  const value = originalFixture();
  const measures = value.parts.get(4)!.measures as { voices: { beats: { notes: Record<string, unknown>[] }[] }[] }[];
  measures[3]!.voices[0]!.beats[1]!.notes[0]!.bend = bend;
  return value;
}

test('selected bends still block the default melody; no automatic simplification', async () => {
  const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture()) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  expect(createDefaultMelodySelection(result.source).status).toBe('selection-needed');
});

test('opted-in draft preserves notated pitch/time and retains/discloses the complete curve', async () => {
  const value = fixture();
  const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(value), simplifyBends: true }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  expect(await verifyRevisionDigest(result.source)).toBe(true);
  const event = result.source.events.find((event) => event.id === 'p4:b4:v0:bt1:n0');
  expect(event).toMatchObject({ soundingMidi: 61, start: { n: 13, d: 1 }, duration: { n: 1, d: 1 } });
  if (event?.kind !== 'note') throw new Error('Missing note');
  const effect = event.effects.find((effect) => effect.code === 'source-bend-simplified');
  expect(effect?.affectsMelody).toBe(false);
  expect(JSON.parse(effect!.description).curve).toEqual({ tone: 100, points: [{ position: 0, tone: 0 }, { position: 60, tone: 100 }] });
  expect(result.diagnostics.some((d) => d.message.includes('NOT bend pitch motion'))).toBe(true);
  expect(createDefaultMelodySelection(result.source).status).toBe('proposed');
});

test.each([
  null,
  { tone: 100, points: [] },
  { tone: 100, points: [{ position: 60, tone: 0 }, { position: 0, tone: 100 }] },
  { tone: 100, unknown: true, points: [{ position: 0, tone: 0 }, { position: 60, tone: 100 }] },
])('opt-in does not discard malformed/unknown bend data: %j', async (bend) => {
  const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture(bend)), simplifyBends: true }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  expect(result.status).toBe('unsupported');
  expect('source' in result).toBe(false);
});

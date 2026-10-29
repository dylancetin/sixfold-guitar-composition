import { expect, test } from 'bun:test';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

test('descriptive chord labels retain every exact source note without becoming pitch effects', async () => {
  const fixture = originalFixture();
  const baseline = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  const measures = fixture.parts.get(6)!.measures as { voices: { beats: Record<string, unknown>[] }[] }[];
  measures[0]!.voices[0]!.beats[0]!.chord = { text: 'Original label, not pitch authority', width: 37 };
  const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (baseline.status !== 'source-ready' || result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  const musicalFacts = (events: typeof result.source.events) => events.map(event => ({ ...event, ...(event.kind === 'note' ? { effects: event.effects.filter(effect => effect.code !== 'source-chord-label') } : {}) }));
  expect(musicalFacts(result.source.events)).toEqual(musicalFacts(baseline.source.events));
  const labeled = result.source.events.filter(event => event.kind === 'note' && event.effects.some(effect => effect.code === 'source-chord-label'));
  expect(labeled).toHaveLength(2);
  expect(labeled.every(event => event.kind === 'note' && event.effects.every(effect => !effect.affectsMelody))).toBe(true);
  expect(createDefaultMelodySelection(result.source).status).toBe('proposed');
  expect(result.source.key.status).toBe('unknown');
});

for (const chord of [{ text: 'C', pitch: 60 }, { text: 'C', width: -1 }, { text: 5 }, 'C']) {
  test(`malformed or extra chord semantics fail closed: ${JSON.stringify(chord)}`, async () => {
    const fixture = originalFixture();
    const measures = fixture.parts.get(6)!.measures as { voices: { beats: Record<string, unknown>[] }[] }[];
    measures[0]!.voices[0]!.beats[0]!.chord = chord;
    const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
    expect(result.status).toBe('unsupported');
  });
}

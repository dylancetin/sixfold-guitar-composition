import { expect, test } from 'bun:test';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

test('fallback proposes an intact supported source alternative, not an effect-stripped line', async () => {
  const fixture = originalFixture();
  const original = fixture.parts.get(6)!;
  const alternative = structuredClone(original);
  alternative.partId = 8;
  alternative.tuning = [58, 46];
  fixture.parts.set(8, alternative);
  fixture.metadata.tracks.push({ partId: 8, name: 'Original alternative intro', instrumentId: 54, tuning: [58, 46] });
  const measures = original.measures as { voices: { beats: { notes: Record<string, unknown>[] }[] }[] }[];
  // An open-ended slide still has no explicit target to resolve.
  measures[0]!.voices[0]!.beats[0]!.notes[0]!.slide = 'below';
  const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  const proposal = createDefaultMelodySelection(result.source);
  if (proposal.status !== 'proposed') throw new Error(JSON.stringify(proposal));
  expect(proposal.provenance.primary.partId).toBe(4);
  expect(proposal.selection.sections[0]!.selectors[0]!.partId).toBe(8);
  expect(proposal.provenance.choices[0]!.reason).toContain('fully supported existing source line');
  expect(proposal.provenance.approval).toBe('unapproved');
  expect(result.source.events.some((event) => event.kind === 'note' && event.partId === 6 && event.effects.some((effect) => effect.code === 'unsupported-slide' && effect.affectsMelody))).toBe(true);
  const ids = new Set(proposal.selection.sections.flatMap((section) => section.selectors.flatMap((selector) => selector.eventIds)));
  expect(result.source.events.filter((event) => ids.has(event.id)).every((event) => event.kind !== 'note' || !event.effects.some((effect) => effect.affectsMelody))).toBe(true);
});

test('a fallback crossing the primary entry is not clipped or retriggered; actual source silence survives', async () => {
  const fixture = originalFixture();
  const measures = fixture.parts.get(6)!.measures as { voices: { beats: Record<string, unknown>[] }[] }[];
  measures[1]!.voices[0]!.beats = [{ type: 1, duration: [1, 1], notes: [{ string: 0, fret: 14, tie: true }, { string: 1, fret: 14, tie: true }] }];
  const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  const proposal = createDefaultMelodySelection(result.source);
  if (proposal.status !== 'proposed') throw new Error(JSON.stringify(proposal));
  expect(proposal.provenance.primary.partId).toBe(4);
  expect(proposal.selection.sections[0]!.selectors).toEqual([]);
  expect(proposal.provenance.choices[0]!.intentionalSilenceSourceEventIds).toContain('p4:b1:v0:bt0:rest');
  expect(result.source.events.find(event => event.id === 'p6:b1:v0:bt1:n0')!.duration).toEqual({ n: 6, d: 1 });
  const selected = new Set(proposal.selection.sections.flatMap(section => section.selectors.flatMap(selector => selector.eventIds)));
  expect(selected.has('p6:b1:v0:bt1:n0')).toBe(false);
  expect(selected.has('p4:b2:v0:bt0:n0')).toBe(true);
});

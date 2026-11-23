import { describe, expect, test } from 'bun:test';
import { eventEnd, q, verifyRevisionDigest } from '../../src/domain';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import type { RawBeat } from '../../src/source/raw';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';
import { graceFixture, graceNote } from './grace-fixture';
const rest: RawBeat = { type: 2, dots: 1, duration: [3, 4], rest: true, notes: [{ rest: true }] };
async function importFixture(fixture = graceFixture()) {
  return createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
}

describe('grace time borrowing — original exercise, no downloaded music', () => {
  test('three before-beat grace pitches remain distinct attacks and borrow only a quarter, not three quarters', async () => {
    const result = await importFixture();
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(await verifyRevisionDigest(result.source)).toBe(true);
    expect(result.source.events.map((event) => [event.kind === 'note' && event.soundingMidi, event.start, event.duration])).toEqual([
      [60, q(0), q(11, 4)], [61, q(11, 4), q(1, 12)], [63, q(17, 6), q(1, 12)], [65, q(35, 12), q(1, 12)], [67, q(3), q(1)],
    ]);
    expect(result.source.events.map((event) => event.refs[0]!.rawWholeNoteDuration)).toEqual([q(3, 4), q(1, 16), q(1, 16), q(1, 16), q(1, 4)]);
    expect(eventEnd(result.source.events.at(-1)!)).toEqual(q(4));
    expect(result.source.events.filter((event) => event.kind === 'note' && event.effects.some((effect) => effect.code === 'source-grace'))).toHaveLength(3);
    expect(createDefaultMelodySelection(result.source).status).toBe('proposed');
  });

  test.each(['onBeat', 'beforeBeat'] as const)('score-zero %s grace never creates negative time or lengthens the bar', async (kind) => {
    const result = await importFixture(graceFixture([graceNote(1, kind), { type: 4, duration: [1, 4], notes: [{ string: 0, fret: 0 }] }, rest]));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.map((event) => [event.start, event.duration])).toEqual([[q(0), q(1, 4)], [q(1, 4), q(3, 4)], [q(1), q(3)]]);
  });

  test('on-beat groups delay and shorten the following note, preserving its nominal end', async () => {
    const result = await importFixture(graceFixture([...Array.from({ length: 3 }, (_, i) => graceNote(i, 'onBeat')), { type: 4, duration: [1, 4], notes: [{ string: 0, fret: 5 }] }, rest]));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.slice(0, 4).map((event) => [event.start, event.duration])).toEqual([[q(0), q(1, 12)], [q(1, 12), q(1, 12)], [q(1, 6), q(1, 12)], [q(1, 4), q(3, 4)]]);
  });

  test('before-beat grace can borrow from an explicit rest without inventing an extra silence', async () => {
    const result = await importFixture(graceFixture([rest, graceNote(1, 'beforeBeat'), { type: 4, duration: [1, 4], notes: [{ string: 0, fret: 0 }] }]));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.map((event) => [event.kind, event.start, event.duration])).toEqual([['rest', q(0), q(11, 4)], ['note', q(11, 4), q(1, 4)], ['note', q(3), q(1)]]);
  });

  test.each(['tied', 'rest', 'orphan', 'mixed'] as const)('rejects ambiguous %s grace without dropping it', async (kind) => {
    const fixture = graceFixture();
    const measures = fixture.parts.get(4)!.measures as { voices: { beats: RawBeat[] }[] }[];
    const beats = measures[0]!.voices[0]!.beats;
    if (kind === 'tied') beats[1]!.notes[0]!.tie = true;
    if (kind === 'rest') { beats[1]!.rest = true; beats[1]!.notes = [{ rest: true }]; }
    if (kind === 'orphan') beats.at(-1)!.graceNote = 'onBeat';
    if (kind === 'mixed') beats[2]!.graceNote = 'onBeat';
    const result = await importFixture(fixture);
    expect(result.status).toBe('unsupported');
    expect('source' in result).toBe(false);
  });

  test('descriptive title/grand-staff metadata does not reject otherwise complete pitched parts', async () => {
    const fixture = graceFixture();
    fixture.parts.get(4)!.title = 'Original auxiliary staff';
    fixture.parts.get(4)!.grandStaffGroup = 1;
    expect((await importFixture(fixture)).status).toBe('source-ready');
    fixture.parts.get(4)!.grandStaffGroup = 'not-an-id';
    expect((await importFixture(fixture)).status).toBe('unsupported');
  });

  test('nominal legato/staccato articulation is retained and explicitly disclosed, not mistaken for pitch-changing effects', async () => {
    const fixture = graceFixture();
    const measures = fixture.parts.get(4)!.measures as { voices: { beats: RawBeat[] }[] }[];
    measures[0]!.voices[0]!.beats.at(-1)!.notes[0]!.hp = true;
    measures[0]!.voices[0]!.beats.at(-1)!.notes[0]!.staccato = true;
    const result = await importFixture(fixture);
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    const event = result.source.events.at(-1)!;
    expect(event.kind === 'note' && event.effects.filter((effect) => effect.code.startsWith('articulation-')).map((effect) => [effect.code, effect.affectsMelody])).toEqual([['articulation-hp', false], ['articulation-staccato', false]]);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes('not expressive source-performance playback'))).toBe(true);
  });

  test('fallback prefers an existing guitar-register line without transposing an attractive high alternative', async () => {
    const fixture = originalFixture();
    const low = fixture.parts.get(6)!;
    const measures = low.measures as { voices: { beats: { notes: Record<string, unknown>[] }[] }[] }[];
    for (const beat of measures[0]!.voices[0]!.beats) beat.notes = beat.notes.slice(0, 1);
    const high = structuredClone(low);
    high.partId = 8; high.tuning = [68, 56]; high.instrumentId = 68;
    fixture.parts.set(8, high);
    fixture.metadata.tracks.push({ partId: 8, name: 'Vocal-like high alternative', instrumentId: 68, tuning: [68, 56] });
    const result = await importFixture(fixture);
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    const proposal = createDefaultMelodySelection(result.source);
    if (proposal.status !== 'proposed') throw new Error(JSON.stringify(proposal));
    expect(proposal.selection.sections[0]!.selectors[0]!.partId).toBe(6);
    const selected = new Set(proposal.selection.sections[0]!.selectors[0]!.eventIds);
    expect(result.source.events.filter((event) => selected.has(event.id)).map((event) => event.kind === 'note' && event.soundingMidi)).toEqual([72, 74]);
    expect(result.source.events.filter((event) => event.partId === 8 && event.kind === 'note').map((event) => event.kind === 'note' && event.soundingMidi)).toEqual([80, 82]);
  });
});

describe('bar-opening before-beat grace — original exercise', () => {
  test('is played on the beat inside its own bar, with per-event and diagnostic disclosure', async () => {
    const fixture = graceFixture([{ type: 1, duration: [1, 1], notes: [{ string: 0, fret: 0 }] }]);
    const part = fixture.parts.get(4)!;
    (part.measures as unknown[]).push({ voices: [{ beats: [graceNote(2, 'beforeBeat'), { type: 4, duration: [1, 4], notes: [{ string: 0, fret: 4 }] }, rest] }] });
    const result = await importFixture(fixture);
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.map((event) => [event.start, event.duration])).toEqual([[q(0), q(4)], [q(4), q(1, 4)], [q(17, 4), q(3, 4)], [q(5), q(3)]]);
    const grace = result.source.events[1]!;
    expect(grace.kind === 'note' && grace.effects.find((effect) => effect.code === 'source-grace')?.description).toContain('bar-opening-before-beat-played-on-beat');
    const first = result.source.events[0]!;
    expect(first.kind === 'note' && first.effects.some((effect) => effect.code === 'source-grace-donor')).toBe(false);
    expect(result.diagnostics.some((d) => d.severity === 'warning' && d.message.includes('open a bar are played on the beat') && d.barIds.includes('bar-2'))).toBe(true);
  });
});

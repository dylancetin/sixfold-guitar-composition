// Original exercise, no downloaded music: display-only clef/spelling hints and opt-in let-ring simplification.
import { describe, expect, test } from 'bun:test';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../../src/source';
import type { RawBeat } from '../../src/source/raw';
import { fixtureFetch, ORIGINAL_URL } from './fixtures';
import { graceFixture } from './grace-fixture';

const whole = (note: Record<string, unknown>, beat: Record<string, unknown> = {}): RawBeat => ({ type: 1, duration: [1, 1], notes: [{ string: 0, fret: 3, ...note }], ...beat } as RawBeat);
async function importBeat(beat: RawBeat, options: { simplifyOrnaments?: boolean; measure?: Record<string, unknown> } = {}) {
  const fixture = graceFixture([beat]);
  Object.assign((fixture.parts.get(4) as { measures: object[] }).measures[0]!, options.measure ?? {});
  return createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture), ...(options.simplifyOrnaments ? { simplifyOrnaments: true } : {}) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
}

describe('display-only notation hints', () => {
  test('a bar-level clef is accepted as staff display and leaves pitch unchanged', async () => {
    const plain = await importBeat(whole({}));
    const clef = await importBeat(whole({}), { measure: { clef: 'F4' } });
    if (plain.status !== 'source-ready' || clef.status !== 'source-ready') throw new Error(JSON.stringify([plain, clef]));
    expect(clef.source.events.map((e) => e.kind === 'note' && e.soundingMidi)).toEqual(plain.source.events.map((e) => e.kind === 'note' && e.soundingMidi));
  });

  test('an unknown bar-level clef value still fails closed', async () => {
    expect((await importBeat(whole({}), { measure: { clef: 'X9' } })).status).not.toBe('source-ready');
  });

  test('spn and courtesyAccidental become non-melody notation effects, so the line stays selectable', async () => {
    const result = await importBeat(whole({ spn: [0, 1, 4], courtesyAccidental: true }));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    const note = result.source.events.find((e) => e.kind === 'note')!;
    expect(note.effects.filter((e) => e.code.startsWith('source-notation-')).map((e) => [e.code, e.affectsMelody])).toEqual([['source-notation-spn', false], ['source-notation-courtesyAccidental', false]]);
    expect(createDefaultMelodySelection(result.source).status).toBe('proposed');
  });

  test('malformed spelling hints remain unsupported melody-affecting effects', async () => {
    const result = await importBeat(whole({ spn: 'B natural' }));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.find((e) => e.kind === 'note')!.effects.some((e) => e.code === 'unsupported-spn' && e.affectsMelody)).toBe(true);
  });
});

describe('let-ring under explicit ornament simplification', () => {
  test('without the opt-in, let-ring stays an unsupported melody-affecting effect', async () => {
    const result = await importBeat(whole({}, { letRing: true }));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.events.find((e) => e.kind === 'note')!.effects.some((e) => e.code === 'unsupported-letRing' && e.affectsMelody)).toBe(true);
    expect(createDefaultMelodySelection(result.source).status).toBe('selection-needed');
  });

  test('with the opt-in, let-ring is disclosed as simplified and the notated duration is unchanged', async () => {
    const result = await importBeat(whole({}, { letRing: true }), { simplifyOrnaments: true });
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    const note = result.source.events.find((e) => e.kind === 'note')!;
    const effect = note.effects.find((e) => e.code === 'source-ornament-simplified')!;
    expect(effect.affectsMelody).toBe(false);
    expect(JSON.parse(effect.description)).toMatchObject({ field: 'letRing', value: true, policy: 'explicit-notated-pitch-draft' });
    expect(note.duration).toEqual({ n: 4, d: 1 });
    expect(createDefaultMelodySelection(result.source).status).toBe('proposed');
  });

  test('an unexpected let-ring value fails even with the opt-in', async () => {
    expect((await importBeat(whole({}, { letRing: 'sometimes' }), { simplifyOrnaments: true })).status).not.toBe('source-ready');
  });
});

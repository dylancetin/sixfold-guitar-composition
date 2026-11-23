import { describe, expect, test } from 'bun:test';
import { verifyRevisionDigest } from '../../src/domain';
import { createSongsterrSourceAdapter } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

type Fixture = ReturnType<typeof originalFixture>;
type Measures = Record<string, unknown>[];
const measuresOf = (fixture: Fixture, id: number) => fixture.parts.get(id)!.measures as Measures;
const imported = (fixture: Fixture) => createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });
const declareAll = (fixture: Fixture, keySignature: unknown, partIds = [...fixture.parts.keys()]) => {
  for (const id of partIds) for (const measure of measuresOf(fixture, id)) measure.keySignature = structuredClone(keySignature);
  return fixture;
};
const E_MAJOR = { accidentalCount: 4, mode: 'major', transposeAs: '#' };

describe('Songsterr key signatures', () => {
  test('a consistent opening declaration becomes a source-declared key without changing events or structure', async () => {
    const before = await imported(originalFixture());
    const after = await imported(declareAll(originalFixture(), E_MAJOR));
    if (before.status !== 'source-ready' || after.status !== 'source-ready') throw new Error(JSON.stringify({ before, after }));
    expect(before.source.key.status).toBe('unknown');
    expect(after.source.key).toMatchObject({ status: 'identified', tonicPitchClass: 4, mode: 'major', certainty: 'source-declared' });
    expect(after.source.events).toEqual(before.source.events);
    expect(after.source.bars).toEqual(before.source.bars);
    expect(after.source.form).toEqual(before.source.form);
    expect(await verifyRevisionDigest(after.source)).toBe(true);
  });

  test.each([
    [{ accidentalCount: 3, mode: 'minor', transposeAs: '#' }, 6],
    [{ accidentalCount: 2, mode: 'major', transposeAs: 'b' }, 10],
    [{ accidentalCount: -3, mode: 'major', transposeAs: 'b' }, 3],
    [{ accidentalCount: 0, mode: 'minor', transposeAs: '#' }, 9],
  ])('maps %j to tonic pitch class %d', async (keySignature, tonic) => {
    const result = await imported(declareAll(originalFixture(), keySignature));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.key).toMatchObject({ status: 'identified', tonicPitchClass: tonic });
  });

  test('parts without a declaration add no evidence and are disclosed', async () => {
    const fixture = originalFixture();
    const [first] = [...fixture.parts.keys()];
    const result = await imported(declareAll(fixture, E_MAJOR, [first!]));
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(result.source.key).toMatchObject({ status: 'identified', tonicPitchClass: 4 });
    if (result.source.key.status === 'identified') expect(result.source.key.evidence).toContain('declare none');
  });

  test.each(['change', 'late', 'null', 'conflicting-parts', 'sign-conflict', 'extra-field', 'out-of-range'] as const)('fails closed on %s', async (kind) => {
    const fixture = declareAll(originalFixture(), E_MAJOR);
    const ids = [...fixture.parts.keys()];
    const measures = measuresOf(fixture, ids[0]!);
    if (kind === 'change') measures[1]!.keySignature = { accidentalCount: 1, mode: 'major', transposeAs: '#' };
    if (kind === 'late') delete measures[0]!.keySignature;
    if (kind === 'null') measures[1]!.keySignature = null;
    if (kind === 'conflicting-parts') declareAll(fixture, { accidentalCount: 1, mode: 'major', transposeAs: 'b' }, [ids[1]!]);
    if (kind === 'sign-conflict') declareAll(fixture, { accidentalCount: -4, mode: 'major', transposeAs: '#' });
    if (kind === 'extra-field') measures[0]!.keySignature = { ...E_MAJOR, clef: 'G2' };
    if (kind === 'out-of-range') declareAll(fixture, { accidentalCount: 8, mode: 'major', transposeAs: '#' });
    const result = await imported(fixture);
    expect(result.status).toBe('unsupported');
    expect(JSON.stringify(result.diagnostics)).toMatch(/key signature|keySignature/i);
  });
});

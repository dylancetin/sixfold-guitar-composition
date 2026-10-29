import { describe, expect, test } from 'bun:test';
import { verifyRevisionDigest } from '../../src/domain';
import { createSongsterrSourceAdapter } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL, originalFixture } from './fixtures';

const imported = (fixture = originalFixture()) => createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL });

describe('structurally checked unversioned parts — original fixtures', () => {
  test('retains every event and explicitly records missing versions, without defaulting them', async () => {
    const before = await imported();
    const fixture = originalFixture();
    delete fixture.parts.get(4)!.version;
    delete fixture.parts.get(6)!.version;
    const after = await imported(fixture);
    if (before.status !== 'source-ready' || after.status !== 'source-ready') throw new Error(JSON.stringify({ before, after }));
    expect(after.source.events).toEqual(before.source.events);
    expect(after.source.parts).toEqual(before.source.parts);
    expect(after.source.manifest.identity).toMatchObject({ formatVersion: 5, unversionedPartIds: [4, 6] });
    expect(after.diagnostics.some((d) => d.message.includes('without a version default'))).toBe(true);
    expect(await verifyRevisionDigest(after.source)).toBe(true);
    const altered = structuredClone(after.source);
    if ('unversionedPartIds' in altered.manifest.identity) {
      const { unversionedPartIds, ...withoutExceptions } = altered.manifest.identity;
      altered.manifest.identity = withoutExceptions;
    }
    expect(await verifyRevisionDigest(altered)).toBe(false);
  });

  test.each(['all-missing', 'null', 'unknown', 'mixed', 'bad-rhythm', 'restricted'] as const)('still fails closed on %s', async (kind) => {
    const fixture = originalFixture();
    const part = fixture.parts.get(4)!;
    delete part.version;
    if (kind === 'all-missing') for (const value of fixture.parts.values()) delete value.version;
    if (kind === 'null') part.version = null;
    if (kind === 'unknown') part.version = 99;
    if (kind === 'mixed') fixture.parts.get(6)!.version = 8;
    if (kind === 'bad-rhythm') part.measures = [{ signature: [4, 4], voices: [{ beats: [{ duration: [1, 4], type: 4, notes: [{ string: 0, fret: 0 }] }] }] }];
    if (kind === 'restricted') part.isRestricted = true;
    const result = await imported(fixture);
    expect(result.status).toBe(kind === 'restricted' ? 'restricted' : 'unsupported');
    expect('source' in result).toBe(false);
  });
});

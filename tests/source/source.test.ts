import { describe, expect, test } from 'bun:test';
import { add, compare, eventEnd, ImportResultSchema, q, revisionDigest, SourceScoreV1Schema, verifyRevisionDigest } from '../../src/domain';
import type { ImportInput, SourceScoreV1 } from '../../src/domain';
import { createDefaultMelodySelection, createSongsterrSourceAdapter, SourceArtifactStore } from '../../src/source';
import type { RawArtifact, SourceFetch } from '../../src/source';
import { fixtureFetch, ORIGINAL_URL, originalFixture, page } from './fixtures';

const now = () => new Date('2026-10-20T00:00:00.000Z');
const input: ImportInput = { kind: 'songsterr-url', url: ORIGINAL_URL };
async function ready(fixture = originalFixture()) {
  const artifacts: RawArtifact[] = [];
  const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture), now, saveArtifact: async (a) => { artifacts.push(a); } }).import(input);
  expect(ImportResultSchema.safeParse(result).success).toBe(true);
  if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
  return { ...result, artifacts };
}
function assertComplete(source: SourceScoreV1) {
  const proposed = createDefaultMelodySelection(source);
  if (proposed.status !== 'proposed') throw new Error(JSON.stringify(proposed));
  let cursor = q(0);
  const ids = new Set<string>();
  for (const section of proposed.selection.sections) {
    expect(section.start).toEqual(cursor);
    const intervals = section.selectors.flatMap((selector) => selector.eventIds.map((id) => {
      const event = source.events.find((e) => e.id === id)!;
      expect(event.partId).toBe(selector.partId); expect(event.voiceId).toBe(selector.voiceId);
      expect(ids.has(id)).toBe(false); ids.add(id);
      expect(compare(event.start, section.start)).toBeGreaterThanOrEqual(0);
      expect(compare(eventEnd(event), section.end)).toBeLessThanOrEqual(0);
      return { start: event.start, end: eventEnd(event) };
    })).concat(section.intentionalRests.map((r) => ({ start: r.start, end: add(r.start, r.duration) }))).sort((a, b) => compare(a.start, b.start));
    for (const interval of intervals) { expect(interval.start).toEqual(cursor); cursor = interval.end; }
    expect(cursor).toEqual(section.end);
  }
  expect(cursor).toEqual({ n: 16, d: 1 }); // independent original four-bar literal
  return proposed;
}

describe('exact source adaptation — original fixtures', () => {
  test('canonical schema, digest, immutable raw hashes, identities and literal triplet/tie intervals', async () => {
    const { source, artifacts } = await ready();
    expect(SourceScoreV1Schema.safeParse(source).success).toBe(true);
    expect(await verifyRevisionDigest(source)).toBe(true);
    expect(source.revision.id.startsWith('provisional-source-')).toBe(true);
    expect(source.manifest.identity).toEqual({ kind: 'songsterr', url: ORIGINAL_URL, songId: 123456, upstreamRevisionId: 987654, formatVersion: 5 });
    expect(source.parts.map((p) => p.id)).toEqual([2, 4, 6]);
    expect(source.parts.find((p) => p.id === 4)?.sourceTuning).toEqual({ order: 'high-to-low', soundingMidi: [60, 48] });
    expect(source.form.repeats).toEqual([{ id: 'repeat-1', fromBarId: 'bar-2', toBarId: 'bar-3', totalPasses: 2 }]);
    expect(source.tempos.map((t) => [t.barId, t.offset, t.quarterBpm])).toEqual([['bar-1', { n: 0, d: 1 }, 80], ['bar-2', { n: 0, d: 1 }, 90]]);
    const notes = source.events.filter((e) => e.partId === 4 && e.kind === 'note');
    expect(notes.slice(0, 4).map((e) => [e.kind === 'note' && e.soundingMidi, e.start, e.duration])).toEqual([
      [60, { n: 4, d: 1 }, { n: 2, d: 3 }], [62, { n: 14, d: 3 }, { n: 2, d: 3 }], [64, { n: 16, d: 3 }, { n: 2, d: 3 }], [65, { n: 6, d: 1 }, { n: 3, d: 1 }],
    ]);
    expect(notes[3]?.refs.map((r) => [r.barId, r.rawWholeNoteDuration, r.sourcePosition])).toEqual([
      ['bar-2', { n: 1, d: 2 }, { stringIndex: 0, fret: 5 }], ['bar-3', { n: 1, d: 4 }, { stringIndex: 0, fret: 5 }],
    ]);
    expect(notes[3]?.kind === 'note' && notes[3].tieChainId).toBe('tie:p4:b2:v0:bt3:n0');
    expect(source.key.status).toBe('unknown');
    expect(artifacts).toHaveLength(4);
    for (const a of artifacts) {
      expect(a.descriptor.byteLength).toBe(a.bytes.byteLength);
      expect(a.descriptor.sha256).toBe(new Bun.CryptoHasher('sha256').update(a.bytes).digest('hex'));
      expect(source.manifest.artifacts).toContainEqual(a.descriptor);
    }
  });
  test('wrong website default/linked track never becomes melody; explicit polyphonic intro event choices', async () => {
    const { source } = await ready();
    const proposed = assertComplete(source);
    expect(proposed.provenance.primary).toEqual({ partId: 4, voiceId: 'p4:v0' });
    expect(proposed.provenance.approval).toBe('unapproved');
    expect(proposed.selection.sections[0]?.selectors).toEqual([{ partId: 6, voiceId: 'p6:v0', eventIds: ['p6:b1:v0:bt0:n0', 'p6:b1:v0:bt1:n0'] }]);
    expect(proposed.provenance.choices[0]?.omittedOverlappingEventIds).toEqual(['p6:b1:v0:bt0:n1', 'p6:b1:v0:bt1:n1']);
    expect(proposed.selection.sections.flatMap((s) => s.selectors).some((s) => s.partId === 2)).toBe(false);
  });
  test('unison chord members and continuations keep every raw reference', async () => {
    const fixture = originalFixture();
    fixture.parts.get(6)!.measures = [
      { signature: [4, 4], voices: [{ beats: [{ duration: [1, 2], type: 2, notes: [{ string: 0, fret: 0 }, { string: 1, fret: 12 }] }, { duration: [1, 2], type: 2, notes: [{ string: 0, fret: 0, tie: true }, { string: 1, fret: 12, tie: true }] }] }] },
      ...((fixture.parts.get(6)!.measures as unknown[]).slice(1)),
    ];
    const { source } = await ready(fixture);
    const event = source.events.find((e) => e.partId === 6 && e.kind === 'note')!;
    expect(event.duration).toEqual({ n: 4, d: 1 }); expect(event.refs).toHaveLength(4);
  });
  test('unsupported pitch effect is explicit and not silently selected', async () => {
    const fixture = originalFixture();
    fixture.parts.get(6)!.measures = [{ signature: [4, 4], voices: [{ beats: [{ duration: [1, 1], type: 1, notes: [{ string: 0, fret: 0, bend: { cents: 100 } }] }] }] }, ...(fixture.parts.get(6)!.measures as unknown[]).slice(1)];
    const { source, diagnostics } = await ready(fixture);
    const note = source.events.find((e) => e.partId === 6 && e.kind === 'note');
    expect(note?.kind === 'note' && note.effects.some((e) => e.code === 'unsupported-bend' && e.affectsMelody)).toBe(true);
    expect(diagnostics.some((d) => d.message.includes('unsupported-bend'))).toBe(true);
    expect(createDefaultMelodySelection(source).status).toBe('selection-needed');
  });
  test('unsupported irrelevant percussion schema retains raw and identity without erasing melody', async () => {
    const fixture = originalFixture();
    fixture.metadata.tracks.push({ partId: 10, name: 'Original drums', instrumentId: 1024, tuning: [60, 48], isDrums: true } as typeof fixture.metadata.tracks[number]);
    fixture.parts.set(10, { songId: 123456, revisionId: 987654, partId: 10, version: 88, drumGrid: [] });
    const { source, artifacts, diagnostics } = await ready(fixture);
    expect(source.parts.map((p) => p.id)).toContain(10); expect(artifacts).toHaveLength(5);
    expect(source.events.filter((e) => e.partId === 4 && e.kind === 'note')).toHaveLength(8);
    expect(diagnostics.some((d) => d.message.includes('raw-only'))).toBe(true);
    assertComplete(source);
  });
  test('version 8 uses the same checked subset; no format-version guessing', async () => {
    const fixture = originalFixture();
    for (const part of fixture.parts.values()) part.version = 8;
    const { source } = await ready(fixture);
    expect(source.manifest.identity.kind === 'songsterr' && source.manifest.identity.formatVersion).toBe(8);
    assertComplete(source);
  });
  test('a melody-affecting primary effect blocks proposal rather than substituting accompaniment or silence', async () => {
    const fixture = originalFixture();
    const measures = fixture.parts.get(4)!.measures as { voices: { beats: { notes: Record<string, unknown>[] }[] }[] }[];
    measures[1]!.voices[0]!.beats[0]!.notes[0]!.harmonic = 'natural';
    const { source } = await ready(fixture);
    const proposal = createDefaultMelodySelection(source);
    expect(proposal.status).toBe('selection-needed');
    expect(proposal.diagnostics[0]?.eventIds).toEqual(['p4:b2:v0:bt0:n0']);
  });
  test('whole-bar phrase silence is explicit and grounded in original source-rest IDs', async () => {
    const { source } = await ready();
    // Original second candidate ends with one full-bar phrase rest; do not fabricate a replacement line.
    const copy = structuredClone(source);
    copy.parts = copy.parts.filter((p) => p.id === 4);
    copy.events = copy.events.filter((e) => e.partId === 4 && compare(e.start, q(12)) < 0);
    copy.events.push({ kind: 'rest', id: 'original-final-rest', partId: 4, voiceId: 'p4:v0', start: q(12), duration: q(4), refs: [{ sourceNoteId: 'original-final-rest-ref', partId: 4, barId: 'bar-4', voiceId: 'p4:v0', beatId: 'original-final-rest-beat', noteIndex: 0, rawWholeNoteDuration: q(1), sourcePosition: null }] });
    copy.revision.digest = await revisionDigest(copy);
    const proposed = assertComplete(copy);
    const last = proposed.selection.sections.at(-1)!;
    expect(last.selectors).toEqual([]);
    expect(last.intentionalRests).toEqual([{ id: `proposal-s${proposed.selection.sections.length}-rest-1`, start: { n: 12, d: 1 }, duration: { n: 4, d: 1 }, reason: 'Intentionally preserve source silence evidenced by original-final-rest; do not fill this phrase rest with invented melody.' }]);
    expect(proposed.provenance.choices.at(-1)?.intentionalSilenceSourceEventIds).toEqual(['original-final-rest']);
  });
  test.each([
    ['missing duration', (p: Record<string, unknown>) => { p.measures = [{ signature: [4, 4], voices: [{ beats: [{ type: 1, notes: [{ string: 0, fret: 1 }] }] }] }]; }],
    ['rhythm disagreement', (p: Record<string, unknown>) => { p.measures = [{ signature: [4, 4], voices: [{ beats: [{ type: 1, dots: 1, duration: [1, 1], notes: [{ string: 0, fret: 1 }] }] }] }]; }],
    ['underfull voice', (p: Record<string, unknown>) => { p.measures = [{ signature: [4, 4], voices: [{ beats: [{ type: 4, duration: [1, 4], notes: [{ string: 0, fret: 1 }] }] }] }]; }],
    ['orphan tie', (p: Record<string, unknown>) => { p.measures = [{ signature: [4, 4], voices: [{ beats: [{ type: 1, duration: [1, 1], notes: [{ string: 0, fret: 1, tie: true }] }] }] }]; }],
    ['schema drift', (p: Record<string, unknown>) => { p.version = 123; }],
    ['unknown form direction', (p: Record<string, unknown>) => { p.dalSegno = true; }],
  ] as const)('rejects %s without returning a partial pitched score', async (_, corrupt) => {
    const fixture = originalFixture(); corrupt(fixture.parts.get(2)!);
    const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import(input);
    expect(result.status).toBe('unsupported'); expect('source' in result).toBe(false);
  });
});

describe('bounded public-source security — offline only', () => {
  test.each(['not a URL', 'http://www.songsterr.com/a/wsa/test-s123456', 'https://127.0.0.1/a/wsa/test-s123456', 'https://songsterr.com.evil.test/a/wsa/test-s123456', 'https://user:secret@www.songsterr.com/a/wsa/test-s123456', 'https://www.songsterr.com:444/a/wsa/test-s123456', 'https://www.songsterr.com/a/wsa/no-id', 'file:///a/wsa/test-s123456', 'https://www.songsterr.com/\\evil/a/wsa/test-s123456'])('rejects malformed/private URL %s before fetch', async (url) => {
    let count = 0;
    const result = await createSongsterrSourceAdapter({ fetch: async () => { count++; throw new Error('Must not fetch'); } }).import({ kind: 'songsterr-url', url });
    expect(result.status).toBe('invalid-input'); expect(count).toBe(0);
  });
  test('unknown source/input cannot fall back to exact song or a demo', async () => {
    let count = 0;
    const adapter = createSongsterrSourceAdapter({ fetch: async () => { count++; throw new Error('Must not fetch'); } });
    expect((await adapter.import({ kind: 'youtube', url: 'https://youtube.com/x' } as unknown as ImportInput)).status).toBe('invalid-input');
    expect((await adapter.import({ kind: 'upload', filename: 'x.mid', format: 'midi', bytes: new Uint8Array() })).status).toBe('unsupported');
    expect(count).toBe(0);
  });
  test('404 unknown song is unavailable, never hardcoded to requested acceptance song', async () => {
    const calls: string[] = [];
    const result = await createSongsterrSourceAdapter({ fetch: async (url) => { calls.push(url); return new Response(null, { status: 404 }); } }).import(input);
    expect(result.status).toBe('unavailable'); expect(calls).toEqual([ORIGINAL_URL]);
  });
  test.each([401, 403, 429, 451])('stops on part denial HTTP %d without alternate host or remaining parts', async (status) => {
    const calls: string[] = [];
    const fixture = originalFixture();
    const result = await createSongsterrSourceAdapter({ fetch: async (url) => { calls.push(url); return calls.length === 1 ? new Response(page(fixture.metadata)) : new Response(null, { status }); } }).import(input);
    expect(result.status).toBe('restricted'); expect(calls).toHaveLength(2);
    expect(calls[1]).toBe('https://dqsljvtekg760.cloudfront.net/123456/987654/original-public-token/2.json');
  });
  test.each([{ isBlocked: true }, { isRestricted: true }, { restriction: 'private' }, { hasPlayer: false }, { isPrivate: true }])('stops on public metadata restrictions %j before CDN', async (restriction) => {
    let count = 0;
    const result = await createSongsterrSourceAdapter({ fetch: async () => { count++; return new Response(page({ ...originalFixture().metadata, ...restriction })); } }).import(input);
    expect(result.status).toBe('restricted'); expect(count).toBe(1);
  });
  test.each(['https://127.0.0.1/private', 'http://www.songsterr.com/a/wsa/test-s123456', 'https://user:pass@www.songsterr.com/a/wsa/test-s123456', 'https://www.songsterr.com/a/wsa/test-s123456?token=secret'])('rejects unsafe redirect %s without destination fetch', async (location) => {
    let count = 0;
    const result = await createSongsterrSourceAdapter({ fetch: async () => { count++; return new Response(null, { status: 302, headers: { location } }); } }).import(input);
    expect(result.status).toBe('restricted'); expect(count).toBe(1);
  });
  test('wrong song/revision/part identities fail independently of note correctness', async () => {
    for (const wrong of [{ songId: 222 }, { revisionId: 222 }, { partId: 222 }]) {
      const fixture = originalFixture(); Object.assign(fixture.parts.get(2)!, wrong);
      const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture) }).import(input);
      expect(result.status).toBe('unsupported'); expect(result.diagnostics[0]?.code).toBe('source-mismatch');
    }
  });
  test('missing access flags, unsafe discovery token and wrong page identity stop before CDN', async () => {
    for (const metadata of [
      { ...originalFixture().metadata, hasPlayer: undefined },
      { ...originalFixture().metadata, image: '../private' },
      { ...originalFixture().metadata, songId: 999 },
    ]) {
      let count = 0;
      const result = await createSongsterrSourceAdapter({ fetch: async () => { count++; return new Response(page(metadata)); } }).import(input);
      expect(result.status).toBe('unsupported'); expect(count).toBe(1);
    }
  });
  test('missing/duplicate state and malformed part JSON never trigger a scraper fallback', async () => {
    for (const html of ['<html>No state</html>', page(originalFixture().metadata) + page(originalFixture().metadata)]) {
      let count = 0;
      const result = await createSongsterrSourceAdapter({ fetch: async () => { count++; return new Response(html); } }).import(input);
      expect(result.status).toBe('unsupported'); expect(count).toBe(1);
    }
    let count = 0;
    const result = await createSongsterrSourceAdapter({ fetch: async () => { count++; return new Response(count === 1 ? page(originalFixture().metadata) : '{broken'); } }).import(input);
    expect(result.status).toBe('unsupported'); expect(count).toBe(2);
  });
  test('private flags in CDN data also stop all remaining requests', async () => {
    const fixture = originalFixture(); fixture.parts.get(2)!.isPrivate = true;
    const calls: string[] = [];
    const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(fixture, calls) }).import(input);
    expect(result.status).toBe('restricted'); expect(calls).toHaveLength(2);
  });
  test('access-query and fragment secrets are not forwarded or persisted as manifest identity', async () => {
    const calls: string[] = [];
    const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(originalFixture(), calls) }).import({ kind: 'songsterr-url', url: ORIGINAL_URL + '?token=private&t=2#secret' });
    if (result.status !== 'source-ready') throw new Error(JSON.stringify(result));
    expect(calls[0]).toBe(ORIGINAL_URL);
    expect(result.source.manifest.identity.kind === 'songsterr' && result.source.manifest.identity.url).toBe(ORIGINAL_URL);
  });
  test('a stalled body is cancelled on caller abort', async () => {
    const abort = new AbortController(); let cancelled = false;
    const result = await createSongsterrSourceAdapter({ fetch: async () => {
      queueMicrotask(() => abort.abort());
      return new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }));
    } }).import(input, abort.signal);
    expect(result.status).toBe('unavailable'); expect(cancelled).toBe(true);
  });
  test('stream limit, not just content-length; abort signal; bounded redirects', async () => {
    const big = new Uint8Array(8 * 1024 * 1024 + 1);
    const result = await createSongsterrSourceAdapter({ fetch: async () => new Response(new ReadableStream({ start(c) { c.enqueue(big); c.close(); } })) }).import(input);
    expect(result.status).toBe('unavailable');
    let count = 0;
    const redirected = await createSongsterrSourceAdapter({ fetch: async () => { count++; return new Response(null, { status: 302, headers: { location: ORIGINAL_URL } }); } }).import(input);
    expect(redirected.status).toBe('unavailable'); expect(count).toBe(4);
    let aborted = false;
    const fetcher: SourceFetch = async (_, init) => { aborted = init.signal !== undefined; throw new DOMException('Aborted', 'AbortError'); };
    expect((await createSongsterrSourceAdapter({ fetch: fetcher }).import(input)).status).toBe('unavailable'); expect(aborted).toBe(true);
    const cancelled = await createSongsterrSourceAdapter({ fetch: async () => { throw new Error('No fetch'); } }).import(input, AbortSignal.abort());
    expect(cancelled.status).toBe('unavailable');
  });
  test('bounded raw retention copies bytes and evicts oldest; persistence failure blocks readiness', async () => {
    const store = new SourceArtifactStore(2);
    const descriptor = { id: 'one', byteLength: 2, sha256: 'a'.repeat(64), mediaType: 'application/json' };
    const bytes = new Uint8Array([1, 2]); await store.put({ descriptor, bytes }); bytes[0] = 9;
    expect(store.get(descriptor.sha256)).toEqual(new Uint8Array([1, 2]));
    await store.put({ descriptor: { ...descriptor, sha256: 'b'.repeat(64) }, bytes }); expect(store.get(descriptor.sha256)).toBeUndefined();
    const result = await createSongsterrSourceAdapter({ fetch: fixtureFetch(originalFixture()), saveArtifact: async () => { throw new Error('Storage unavailable'); } }).import(input);
    expect(result.status).toBe('unavailable');
  });
});

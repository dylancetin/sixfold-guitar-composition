import { afterEach, expect, test } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ArtifactManifestSchema, revisionDigest } from '../../src/domain';
import { mapLyricsToScore } from '../../src/lyrics';
import { rawBeatId } from '../../src/source/common';
import { PublicationStore } from '../../src/publication/store';
import { createPublishedHandler } from '../../src/server/published-http';
import { extractSourceLyrics, readPublishedLyrics } from '../../src/server/published-lyrics';
import { LyricsSupplementSchema } from '../../src/server/supplemental-lyrics';
import { score as originalScore, source as originalSource } from '../fixtures/original';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const rawPart = (partId: number, newLyrics?: unknown) => ({
  songId: 1, revisionId: 2, partId, version: 8, newLyrics,
  measures: [
    { privateSourceField: 'Not part of the lyric response', voices: [{ beats: Array.from({ length: 5 }, () => ({ notes: [{}] })) }] },
    { voices: [{ beats: [{ notes: [{ tie: true }] }, { rest: true, notes: [{}] }] }] },
  ],
});

async function setup(raws = [rawPart(0, [{ line: 1, offset: 1, text: 'Lan-tern  light.' }]), rawPart(1, [{ line: 1, offset: 1, text: 'Backing words must not appear.' }]), rawPart(2)]) {
  const root = await mkdtemp('/tmp/opencode/lyrics-test-'); directories.push(root);
  const sourceDirectory = join(root, 'sources'), run = join(sourceDirectory, randomUUID()), rawDirectory = join(run, 'raw');
  await mkdir(rawDirectory, { recursive: true });
  const source = structuredClone(originalSource), score = structuredClone(originalScore);
  for (const event of source.events.filter(event => event.partId === 0)) for (const ref of event.refs) {
    const index = Number(ref.beatId.slice(5));
    ref.beatId = rawBeatId(0, index < 5 ? 0 : 1, 0, index < 5 ? index : index - 5);
  }
  const rawBytes = raws.map(encode);
  source.manifest.identity = { kind: 'songsterr', url: 'https://www.songsterr.com/a/wsa/original-study-s1', songId: 1, upstreamRevisionId: 2, formatVersion: 8 };
  source.manifest.artifacts = rawBytes.map((bytes, index) => ({ id: `part-${index}`, sha256: sha(bytes), byteLength: bytes.length, mediaType: 'application/json' }));
  source.revision.digest = await revisionDigest(source);
  score.source = { revision: { id: source.revision.id, digest: source.revision.digest }, manifest: structuredClone(source.manifest) };
  score.selection.sourceRevision = { ...score.source.revision };
  score.revision.digest = await revisionDigest(score);
  const sourcePath = join(run, 'source.json');
  await writeFile(sourcePath, encode(source));
  const rawPaths = source.manifest.artifacts.map(artifact => join(rawDirectory, artifact.sha256));
  await Promise.all(rawPaths.map((path, index) => writeFile(path, rawBytes[index]!)));
  const files = {
    score: encode(score), notes: encode('Original authored transport fixture'),
    pdf: new TextEncoder().encode('%PDF-1.7\nTEST-ONLY-TRANSPORT\n%%EOF'),
    midi: new Uint8Array([77,84,104,100,0,0,0,6,0,1,0,1,3,192,77,84,114,107,0,0,0,4,0,255,47,0]),
  };
  const artifact = (format: 'pdf' | 'midi') => ArtifactManifestSchema.parse({
    schemaVersion: 1, scoreRevision: { id: score.revision.id, digest: score.revision.digest }, sourceRevision: score.source.revision,
    ability: score.preferences.ability, adapter: { name: 'TEST-ONLY-TRANSPORT', version: '1' }, format,
    artifactDigest: sha(files[format]), byteLength: files[format].length, occurrenceCount: 2, soundingAttackCount: 9,
    notationSegmentCount: 11, review: 'unreviewed-draft', validationVersion: 'TEST-ONLY', tuning: score.instrument.tuning,
    capo: 0, midiPitchPolicy: 'already-sounding-no-capo-offset',
  });
  const store = new PublicationStore(join(root, 'published')), id = `arr-${score.revision.digest}`;
  await store.install({ ...files, manifest: {
    schemaVersion: 1, id, title: 'Original lyric transport study', sourceUrl: source.manifest.identity.url,
    createdAt: '2026-10-29T00:00:00Z', revision: { id: score.revision.id, digest: score.revision.digest },
    status: 'unreviewed-draft', agent: null,
    files: { score: 'score.json', pdf: 'arrangement.pdf', midi: 'arrangement.mid', notes: 'notes.md' },
    integrity: { score: sha(files.score), pdf: sha(files.pdf), midi: sha(files.midi), notes: sha(files.notes) },
    artifacts: { pdf: artifact('pdf'), midi: artifact('midi') },
  } });
  const options = { arrangementsDirectory: store.root, frontendDirectory: root, sourceDirectory };
  const handle = createPublishedHandler(options);
  const get = (suffix = 'lyrics.json', method = 'GET') => handle(new Request(`http://viewer.test/arrangements/${id}/${suffix}`, { method }));
  return { root, sourceDirectory, run, rawDirectory, sourcePath, rawPaths, rawBytes, source, score, files, id, options, get };
}

test('extracts source beat syllables and exact canonical timing, preserving hyphens and blank slots', async () => {
  const { source } = await setup();
  expect(extractSourceLyrics(rawPart(0, [
    { line: 3, offset: 1, text: 'Lan-tern  light.', ignored: 'not returned' },
    { line: 4, offset: 1, text: '  ' },
  ]), source, 0).map(s => [s.line, s.text, s.source.eventId, s.source.beatId, s.writtenStart])).toEqual([
    [3, 'Lan-', 'src-m0', 'p0:b1:v0:bt0', { n: 0, d: 1 }],
    [3, 'tern', 'src-m1', 'p0:b1:v0:bt1', { n: 1, d: 1 }],
    [3, 'light.', 'src-m3', 'p0:b1:v0:bt3', { n: 7, d: 3 }],
  ]);
  expect(extractSourceLyrics(rawPart(0), source, 0)).toEqual([]);
  expect(extractSourceLyrics(rawPart(0, []), source, 0)).toEqual([]);
  expect(() => extractSourceLyrics(rawPart(0, [{ line: 1, text: 'Original words.' }]), source, 0)).toThrow();
});

test('rejects raw song, upstream revision, part, format and unsupported lyric shapes', async () => {
  const { source } = await setup();
  for (const changes of [{ songId: 3 }, { revisionId: 3 }, { partId: 1 }, { version: 5 }, { version: undefined }, { newLyrics: 'Not the saved lyric format' }, { newLyrics: [{ text: 2 }] }]) {
    expect(() => extractSourceLyrics({ ...rawPart(0), ...changes }, source, 0)).toThrow();
  }
  expect(() => extractSourceLyrics({ ...rawPart(0), isRestricted: true }, source, 0)).toThrow();
  expect(() => extractSourceLyrics(rawPart(0), source, 100)).toThrow();
  source.manifest.identity = { ...source.manifest.identity, kind: 'songsterr', url: 'https://www.songsterr.com/a/wsa/original-study-s1', songId: 1, upstreamRevisionId: 2, formatVersion: 8, unversionedPartIds: [0] };
  expect(extractSourceLyrics({ ...rawPart(0), version: undefined }, source, 0)).toEqual([]);
  expect(() => extractSourceLyrics(rawPart(0), source, 0)).toThrow();
});

test('HTTP lyrics are revision-bound, sanitized and uncached while immutable files stay byte-identical', async () => {
  const { get, score, files, id } = await setup();
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  const data = await response.json();
  expect(data.sourceRevision).toEqual(score.source.revision);
  expect(data.scoreRevision).toEqual({ id: score.revision.id, digest: score.revision.digest });
  expect(data.syllables.map((s: { text: string; segmentId: string }) => [s.text, s.segmentId])).toEqual([['Lan-', 'n0'], ['tern', 'n1'], ['light.', 'n3']]);
  expect(JSON.stringify(data)).not.toContain('Backing words');
  expect(JSON.stringify(data)).not.toContain('privateSourceField');
  const head = await get('lyrics.json', 'HEAD');
  expect(head.status).toBe(200); expect((await head.arrayBuffer()).byteLength).toBe(0);
  expect((await get('lyrics.json', 'POST')).status).toBe(405);
  for (const [name, bytes] of [['score.json', files.score], ['arrangement.pdf', files.pdf], ['arrangement.mid', files.midi]] as const) {
    expect(new Uint8Array(await (await get(name)).arrayBuffer())).toEqual(bytes);
  }
  for (const name of ['source.json', 'raw/anything', '%2e%2e%2fsource.json', `${id}/lyrics.json`, 'lyrics.json/%2e%2e/source.json']) expect((await get(name)).status).toBe(404);
});

test('a verified source without lyrics returns an empty list and missing private sources do not break the score', async () => {
  const fixture = await setup([rawPart(0), rawPart(1, [{ line: 1, offset: 1, text: '\n ' }]), rawPart(2, [])]);
  const response = await fixture.get();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sourceRevision: fixture.score.source.revision, scoreRevision: { id: fixture.score.revision.id, digest: fixture.score.revision.digest }, syllables: [] });
  await rm(fixture.sourcePath);
  const missing = await fixture.get();
  expect(missing.status).toBe(503);
  expect(await missing.text()).not.toContain(fixture.sourceDirectory);
  expect((await fixture.get('score.json')).status).toBe(200);
  const withoutSources = createPublishedHandler({ arrangementsDirectory: fixture.options.arrangementsDirectory, frontendDirectory: fixture.root });
  expect((await withoutSources(new Request(`http://viewer.test/arrangements/${fixture.id}/lyrics.json`))).status).toBe(503);
});

test('changed source content, revision IDs and manifests never supply lyrics for another publication', async () => {
  const { source, score, sourceDirectory, sourcePath, get } = await setup();
  const wrongScore = structuredClone(score);
  wrongScore.source.manifest.parser.version = 'other';
  await expect(readPublishedLyrics(wrongScore, sourceDirectory)).rejects.toThrow();
  const changed = structuredClone(source); changed.parts[0]!.name = 'Tampered name';
  await writeFile(sourcePath, encode(changed));
  expect((await get()).status).toBe(503);
  source.revision.id = 'another-source'; await writeFile(sourcePath, encode(source));
  expect((await get()).status).toBe(503);
  expect((await get('score.json')).status).toBe(200);
});

test('raw digest and byte length are both verified before any lyric text is returned', async () => {
  const { rawPaths, rawBytes, get } = await setup();
  const changed = rawBytes[0]!.slice(); changed[changed.length - 2] = 32;
  for (const bytes of [changed, new Uint8Array([...rawBytes[0]!, 32])]) {
    await writeFile(rawPaths[0]!, bytes);
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('Lan-tern');
  }
  await writeFile(rawPaths[0]!, rawBytes[0]!);
  expect((await get()).status).toBe(200);
});

for (const target of ['sourceDirectory', 'run', 'sourcePath', 'rawDirectory', 'rawFile'] as const) {
  test(`symlinked ${target} cannot expose private lyrics`, async () => {
    const fixture = await setup();
    const path = target === 'rawFile' ? fixture.rawPaths[0]! : fixture[target];
    const outside = join(fixture.root, 'outside');
    await rename(path, outside); await symlink(outside, path);
    expect((await fixture.get()).status).toBe(503);
    expect((await fixture.get('score.json')).status).toBe(200);
  });
}

test('wrong raw identity with matching stored bytes and non-UUID run directories fail closed', async () => {
  const wrong = await setup([{ ...rawPart(0, [{ line: 1, offset: 1, text: 'Original private words.' }]), songId: 99 }, rawPart(1), rawPart(2)]);
  expect((await wrong.get()).status).toBe(503);
  const fixture = await setup();
  await rename(fixture.run, join(fixture.sourceDirectory, 'not-a-run-id'));
  expect((await fixture.get()).status).toBe(503);
});

test('mapping requires selected source events and an exact arrangement onset, never shifts later syllables', async () => {
  const { source, score } = await setup();
  const syllables = extractSourceLyrics(rawPart(0, [{ line: 1, offset: 1, text: 'One two three four five' }]), source, 0);
  const original = JSON.stringify({ source, score });
  const mapped = mapLyricsToScore(source, score, syllables);
  expect(mapped.syllables.map(s => s.segmentId)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4a']);
  expect(mapped.syllables.at(-1)?.occurrences).toEqual([{ occurrenceId: 'o1', start: { n: 3, d: 1 } }]);
  expect(JSON.stringify({ source, score })).toBe(original);
  score.selection.sections[0]!.selectors[0]!.eventIds = ['src-m0', 'src-m2', 'src-m3', 'src-m4'];
  expect(mapLyricsToScore(source, score, syllables).syllables.map(s => s.text)).toEqual(['One', 'three', 'four', 'five']);
  score.notation.find(s => s.id === 'n2')!.start = { n: 8, d: 3 };
  expect(mapLyricsToScore(source, score, syllables).syllables.map(s => s.text)).toEqual(['One', 'four', 'five']);
  score.source.revision.id = 'another-source';
  expect(() => mapLyricsToScore(source, score, syllables)).toThrow('revision mismatch');
});

async function supplement(fixture: Awaited<ReturnType<typeof setup>>) {
  const directory = join(fixture.run, 'lyrics', fixture.score.revision.digest);
  await mkdir(directory, { recursive: true });
  const lyrics = mapLyricsToScore(fixture.source, fixture.score, extractSourceLyrics(rawPart(0, [{ line: 1, offset: 1, text: 'Lan-tern' }]), fixture.source, 0));
  const bytes = encode(lyrics), html = new TextEncoder().encode('<p>Original authored fixture: Lantern</p>');
  const manifest = LyricsSupplementSchema.parse({
    schemaVersion: 1, sourceRevision: lyrics.sourceRevision, scoreRevision: lyrics.scoreRevision,
    lyrics: { sha256: sha(bytes), byteLength: bytes.length }, source: { sha256: sha(html), byteLength: html.length },
    retrievedAt: '2026-10-30T00:00:00Z', model: 'TEST-ONLY', taskId: 'TEST-ONLY',
    review: { status: 'model-aligned-draft', coverage: 'partial', note: 'Original fixture, not a real model call.', sourceUrl: 'https://example.com/original' },
  });
  await writeFile(join(directory, 'manifest.json'), encode(manifest));
  await writeFile(join(directory, 'lyrics.json'), bytes);
  await writeFile(join(directory, 'source.html'), html);
  return { directory, manifest, lyrics, bytes, html };
}

test('verified optional supplements expose their draft disclosure only for the exact lyric-free revision', async () => {
  const fixture = await setup([rawPart(0), rawPart(1), rawPart(2)]);
  const { lyrics, manifest } = await supplement(fixture);
  expect(await (await fixture.get()).json()).toEqual({ ...lyrics, review: manifest.review });
  for (const [name, bytes] of [['score.json', fixture.files.score], ['arrangement.pdf', fixture.files.pdf], ['arrangement.mid', fixture.files.midi]] as const) {
    expect(new Uint8Array(await (await fixture.get(name)).arrayBuffer())).toEqual(bytes);
  }
  const upstream = await setup();
  await supplement(upstream);
  expect((await (await upstream.get()).json()).review).toBeUndefined();
});

test('supplement corruption, stale identities, false source anchors and duplicates fail closed', async () => {
  const fixture = await setup([rawPart(0), rawPart(1), rawPart(2)]);
  const { directory, lyrics, manifest, html } = await supplement(fixture);
  const expectEmpty = async () => { const response = await fixture.get(); expect(response.status).toBe(200); expect((await response.json()).syllables).toEqual([]); };
  await writeFile(join(directory, 'source.html'), new Uint8Array(html.length));
  await expectEmpty();
  await writeFile(join(directory, 'source.html'), html);
  for (const field of ['sourceRevision', 'scoreRevision'] as const) {
    await writeFile(join(directory, 'manifest.json'), encode({ ...manifest, [field]: { ...manifest[field], id: 'stale' } }));
    await expectEmpty();
  }
  for (const mutation of ['raw-ref', 'occurrence', 'duplicate', 'digest'] as const) {
    const changed = structuredClone(lyrics);
    if (mutation === 'raw-ref') changed.syllables[0]!.source.beatId = 'wrong-beat';
    if (mutation === 'occurrence') changed.syllables[0]!.occurrences[0]!.start = { n: 999, d: 1 };
    if (mutation === 'duplicate') changed.syllables.push({ ...changed.syllables[0]!, id: 'duplicate-slot' });
    const bytes = encode(changed);
    await writeFile(join(directory, 'lyrics.json'), bytes);
    await writeFile(join(directory, 'manifest.json'), encode({ ...manifest, lyrics: { sha256: mutation === 'digest' ? '0'.repeat(64) : sha(bytes), byteLength: bytes.length } }));
    await expectEmpty();
  }
  await supplement(fixture);
  await rename(join(directory, 'source.html'), join(fixture.root, 'outside.html'));
  await symlink(join(fixture.root, 'outside.html'), join(directory, 'source.html'));
  await expectEmpty();
  await rename(directory, `${directory}-outside`);
  await symlink(`${directory}-outside`, directory);
  await expectEmpty();
});

test('a rehashed supplement cannot use a same-bar tied continuation as its attack reference', async () => {
  const fixture = await setup([rawPart(0), rawPart(1), rawPart(2)]);
  const event = fixture.source.events.find(event => event.id === 'src-m0')!;
  if (event.kind !== 'note') throw new Error('Expected original melody note');
  event.tieChainId = 'original-same-bar-tie';
  event.refs[0]!.rawWholeNoteDuration = { n: 1, d: 8 };
  event.refs.push({ ...event.refs[0]!, sourceNoteId: 'original-tie-continuation', beatId: 'original-later-beat' });
  fixture.source.revision.digest = await revisionDigest(fixture.source);
  fixture.score.source.revision.digest = fixture.source.revision.digest;
  fixture.score.selection.sourceRevision.digest = fixture.source.revision.digest;
  fixture.score.revision.digest = await revisionDigest(fixture.score);
  await writeFile(fixture.sourcePath, encode(fixture.source));
  const { directory, lyrics, manifest } = await supplement(fixture);
  expect((await readPublishedLyrics(fixture.score, fixture.sourceDirectory)).syllables).toHaveLength(2);
  lyrics.syllables[0]!.source.beatId = event.refs[1]!.beatId;
  const bytes = encode(lyrics);
  await writeFile(join(directory, 'lyrics.json'), bytes);
  await writeFile(join(directory, 'manifest.json'), encode({ ...manifest, lyrics: { sha256: sha(bytes), byteLength: bytes.length } }));
  expect((await readPublishedLyrics(fixture.score, fixture.sourceDirectory)).syllables).toEqual([]);
});

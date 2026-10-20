import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ArtifactManifestSchema, revisionDigest } from '../../src/domain';
import { score as original } from '../fixtures/original';
import { createPublishedHandler } from '../../src/server/published-http';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function setup() {
  const root = await mkdtemp('/tmp/opencode/viewer-test-'); directories.push(root);
  const frontend = join(root, 'frontend'); await mkdir(frontend); await writeFile(join(frontend, 'index.html'), '<!doctype html><title>Viewer test</title>');
  const published = join(root, 'published'); await mkdir(published);
  const score = structuredClone(original); score.revision.digest = await revisionDigest(score);
  const id = `arr-${score.revision.digest}`;
  const directory = join(published, id); await mkdir(directory);
  // Header/transport fixtures only; no claim that these are musical artifact oracles.
  const pdf = new TextEncoder().encode('%PDF-1.7\nTEST-ONLY-BYTES\n%%EOF');
  const midi = new Uint8Array([77,84,104,100,0,0,0,6,0,1,0,1,3,192,77,84,114,107,0,0,0,4,0,255,47,0]);
  const scoreBytes = new TextEncoder().encode(JSON.stringify(score));
  const notes = new TextEncoder().encode('# Study\n<script>window.BAD=true</script>\nOriginal test data only.');
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const artifact = (format: 'pdf' | 'midi', bytes: Uint8Array) => ArtifactManifestSchema.parse({ schemaVersion: 1, scoreRevision: { id: score.revision.id, digest: score.revision.digest }, sourceRevision: score.source.revision, ability: score.preferences.ability, adapter: { name: 'TEST-ONLY-TRANSPORT', version: '1' }, format, artifactDigest: sha(bytes), byteLength: bytes.length, occurrenceCount: 2, soundingAttackCount: 9, notationSegmentCount: 11, review: 'unreviewed-draft', validationVersion: 'TEST-ONLY', tuning: score.instrument.tuning, capo: 0, midiPitchPolicy: 'already-sounding-no-capo-offset' });
  const manifest = { schemaVersion: 1, id, title: 'Original TEST-ONLY publication', sourceUrl: 'https://www.songsterr.com/a/wsa/test-s1', createdAt: '2026-10-20T00:00:00Z', revision: { id: score.revision.id, digest: score.revision.digest }, files: { score: 'score.json', pdf: 'arrangement.pdf', midi: 'arrangement.mid', notes: 'notes.md' }, status: 'unreviewed-draft', agent: null, integrity: { score: sha(scoreBytes), pdf: sha(pdf), midi: sha(midi), notes: sha(notes) }, artifacts: { pdf: artifact('pdf', pdf), midi: artifact('midi', midi) } };
  for (const [name, value] of Object.entries({ 'manifest.json': JSON.stringify(manifest), 'score.json': scoreBytes, 'notes.md': notes, 'arrangement.pdf': pdf, 'arrangement.mid': midi })) await writeFile(join(directory, name), value);
  const handle = createPublishedHandler({ arrangementsDirectory: published, frontendDirectory: frontend });
  return { root, published, directory, id, manifest, score, handle, pdf, midi };
}
test('library + pasted deep route load immutable publication and exact binary downloads', async () => {
  const { handle, id, manifest, score, pdf, midi } = await setup();
  const get = (path: string) => handle(new Request(`http://localhost${path}`));
  const library = await (await get('/api/arrangements')).json();
  expect(library.arrangements[0].manifest).toEqual(manifest);
  expect(library.arrangements[0].summary.performedMeasures).toBe(2);
  expect((await get(`/arrangements/${id}`)).headers.get('content-type')).toContain('text/html');
  expect(await (await get(`/arrangements/${id}/manifest.json`)).json()).toEqual(manifest);
  expect(await (await get(`/arrangements/${id}/score.json`)).json()).toEqual(score);
  const downloadedPdf = await get(`/arrangements/${id}/arrangement.pdf`);
  expect(downloadedPdf.headers.get('content-type')).toBe('application/pdf');
  expect(downloadedPdf.headers.get('content-disposition')).toContain('attachment');
  expect(new Uint8Array(await downloadedPdf.arrayBuffer())).toEqual(pdf);
  expect(new Uint8Array(await (await get(`/arrangements/${id}/arrangement.mid`)).arrayBuffer())).toEqual(midi);
  expect((await get(`/arrangements/${id}/notes.md`)).headers.get('content-type')).toContain('text/plain');
});
test('all mutation methods and obsolete studio routes are unavailable', async () => {
  const { handle, id } = await setup();
  for (const path of ['/api/import', '/api/arrange', '/api/save', '/api/study', `/arrangements/${id}`]) for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await handle(new Request(`http://localhost${path}`, { method, body: '{}' }));
    expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe('GET, HEAD');
  }
  expect((await handle(new Request('http://localhost/api/session'))).status).toBe(404);
});
test('empty publication root stays empty and HEAD has no response body', async () => {
  const { handle, directory, id } = await setup();
  const head = await handle(new Request(`http://localhost/arrangements/${id}/arrangement.pdf`, { method: 'HEAD' }));
  expect(head.status).toBe(200); expect((await head.arrayBuffer()).byteLength).toBe(0);
  await rm(directory, { recursive: true });
  const library = await (await handle(new Request('http://localhost/api/arrangements'))).json();
  expect(library).toEqual({ arrangements: [], unavailableCount: 0 });
  expect((await handle(new Request(`http://localhost/arrangements/${id}/manifest.json`))).status).toBe(404);
});
test('score corruption and manifest revision/path mismatches fail closed, including downloads', async () => {
  const { handle, directory, id, manifest, score } = await setup();
  score.sounds[0]!.soundingMidi++;
  await writeFile(join(directory, 'score.json'), JSON.stringify(score));
  expect((await handle(new Request(`http://localhost/arrangements/${id}/score.json`))).status).toBe(409);
  expect((await handle(new Request(`http://localhost/arrangements/${id}/arrangement.pdf`))).status).toBe(409);
  const invalidLibrary = await (await handle(new Request('http://localhost/api/arrangements'))).json();
  expect(invalidLibrary.arrangements).toEqual([]); expect(invalidLibrary.unavailableCount).toBe(1);
  score.revision.digest = await revisionDigest(score); await writeFile(join(directory, 'score.json'), JSON.stringify(score));
  manifest.revision.digest = score.revision.digest; manifest.files.pdf = '../outside.pdf';
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  expect((await handle(new Request(`http://localhost/arrangements/${id}/manifest.json`))).status).toBe(409);
});
test('unknown files, encoded traversal, and symlinked publication files are not served', async () => {
  const { handle, directory, root, id } = await setup();
  await writeFile(join(root, 'secret.json'), 'DO NOT SERVE');
  for (const path of [`/arrangements/${id}/../../secret.json`, `/arrangements/${id}/%2e%2e%2fsecret.json`, `/arrangements/${id}/source.json`, '/.env']) expect((await handle(new Request(`http://localhost${path}`))).status).toBe(404);
  await rm(join(directory, 'notes.md')); await symlink(join(root, 'secret.json'), join(directory, 'notes.md'));
  expect((await handle(new Request(`http://localhost/arrangements/${id}/notes.md`))).status).toBe(409);
});
test('incomplete/corrupt artifacts do not become published library entries', async () => {
  const { handle, directory, id } = await setup();
  const bytes = await readFile(join(directory, 'arrangement.mid'));
  expect(bytes.subarray(0, 4).toString()).toBe('MThd');
  await writeFile(join(directory, 'arrangement.mid'), 'an error page, not MIDI');
  expect((await handle(new Request(`http://localhost/arrangements/${id}/arrangement.mid`))).status).toBe(409);
  const library = await (await handle(new Request('http://localhost/api/arrangements'))).json();
  expect(library.arrangements).toEqual([]);
});

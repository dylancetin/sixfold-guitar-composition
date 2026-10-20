// Independent A03 transport/artifact probe; run with Bun and the documented env.
// Full-song bytes stay local, never in Git. Output must be outside the checkout.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';

const work = process.env.REVIEW_WORKSPACE!;
const output = process.env.REVIEW_OUTPUT!;
const store = process.env.PUBLICATION_STORE!;
const origin = process.env.VIEWER_URL!;
assert(work && output && store && origin, 'Set REVIEW_WORKSPACE, REVIEW_OUTPUT, PUBLICATION_STORE, VIEWER_URL');
await mkdir(output, { recursive: true });
const id = 'arr-1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const { createPublishedHandler } = await import(`${work}/src/server/published-http.ts`);
const { readPublication } = await import(`${work}/src/publication/store.ts`);
const require = createRequire(`${work}/package.json`);
const { parseMidi } = require('midi-file');
const { createCanvas } = require('@napi-rs/canvas');
const { getDocument } = await import(`${work}/node_modules/pdfjs-dist/legacy/build/pdf.mjs`);
const bundle = await readPublication(store, id);
assert.equal(bundle.manifest.status, 'unreviewed-draft'); assert.equal(bundle.manifest.agent, null);
const library = await (await fetch(`${origin}/api/arrangements`)).json();
assert(library.arrangements.some((e: any) => e.manifest.id === id));
const score = JSON.parse(new TextDecoder().decode(bundle.score));
const downloads = [];
for (const [key, filename, mime] of [['pdf', 'arrangement.pdf', 'application/pdf'], ['midi', 'arrangement.mid', 'audio/midi'], ['score', 'score.json', 'application/json; charset=utf-8'], ['notes', 'notes.md', 'text/plain; charset=utf-8']] as const) {
  const url = `${origin}/arrangements/${id}/${filename}`;
  const response = await fetch(url); const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), mime);
  assert.equal(hash(bytes), bundle.manifest.integrity![key]); assert.deepEqual(bytes, bundle[key]);
  if (key === 'pdf' || key === 'midi') {
    assert.match(response.headers.get('content-disposition')!, /attachment/);
    await writeFile(join(output, filename), bytes);
  }
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.headers.get('content-type'), mime);
  assert.equal(Number(head.headers.get('content-length')), bytes.length); assert.equal((await head.arrayBuffer()).byteLength, 0);
  downloads.push({ url, status: response.status, mime, bytes: bytes.length, sha256: hash(bytes), persistedBytesEqual: true, headPassed: true });
}
const negative = [];
const unknown = `arr-${'0'.repeat(64)}`;
for (const path of [`/arrangements/${unknown}/manifest.json`, `/arrangements/${unknown}/arrangement.pdf`, `/arrangements/${unknown}/arrangement.mid`, `/arrangements/${id}/source.json`, '/.env', '/api/import', '/api/study', '/api/save']) {
  const response = await fetch(`${origin}${path}`); assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type')!, /application\/json/); negative.push({ path, status: response.status });
}
for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) for (const path of ['/api/import', '/api/arrange', '/api/save', `/arrangements/${id}/arrangement.pdf`]) {
  const response = await fetch(`${origin}${path}`, { method, body: '{}' }); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET, HEAD');
  negative.push({ method, path, status: response.status });
}
// Test actual network serialization through the reviewed handler; ephemeral test server
// stays in this foreground process and always stops. Never alter the retained store.
const temporary = await mkdtemp(join(output, 'corruption-'));
const copiedStore = join(temporary, 'store'), directory = join(copiedStore, id);
await mkdir(directory, { recursive: true });
const restore = async () => {
  for (const name of ['manifest.json', 'score.json', 'arrangement.pdf', 'arrangement.mid', 'notes.md']) {
    await rm(join(directory, name), { force: true });
    await writeFile(join(directory, name), await readFile(join(store, id, name)));
  }
};
await restore();
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: createPublishedHandler({ arrangementsDirectory: copiedStore, frontendDirectory: `${work}/dist/client` }) });
const corruptions = [];
try {
  for (const kind of ['tampered-midi', 'missing-pdf', 'symlink-notes', 'manifest-path']) {
    await restore();
    if (kind === 'tampered-midi') await writeFile(join(directory, 'arrangement.mid'), '<html>not MIDI</html>');
    if (kind === 'missing-pdf') await rm(join(directory, 'arrangement.pdf'));
    if (kind === 'symlink-notes') { await rm(join(directory, 'notes.md')); await symlink(join(store, id, 'notes.md'), join(directory, 'notes.md')); }
    if (kind === 'manifest-path') { const manifest = structuredClone(bundle.manifest); manifest.files.pdf = '../outside.pdf'; await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest)); }
    for (const filename of ['manifest.json', 'score.json', 'arrangement.pdf', 'arrangement.mid', 'notes.md']) {
      const response = await fetch(`${server.url}arrangements/${id}/${filename}`);
      assert.equal(response.status, 409); assert.match(response.headers.get('content-type')!, /application\/json/);
      assert.match((await response.json()).error, /integrity/);
    }
    const hidden = await (await fetch(`${server.url}api/arrangements`)).json();
    assert.deepEqual(hidden, { arrangements: [], unavailableCount: 1 });
    corruptions.push({ kind, allFiveFilesStatus: 409, libraryHidden: true });
  }
} finally { server.stop(true); await rm(temporary, { recursive: true }); }
// Independent real MIDI parsing, not the exporter's projection arrays.
const midi = parseMidi(bundle.midi); const actual: string[] = [];
for (const [index, track] of midi.tracks.entries()) {
  let tick = 0; const active = new Map<number, number>();
  for (const event of track) {
    tick += event.deltaTime;
    if (event.type === 'noteOn' && event.velocity) { assert(!active.has(event.noteNumber)); active.set(event.noteNumber, tick); }
    if (event.type === 'noteOff' || event.type === 'noteOn' && !event.velocity) { assert(active.has(event.noteNumber)); actual.push(`${['melody', 'bass', 'harmony'][index - 1]}/${event.noteNumber}/${active.get(event.noteNumber)}/${tick}`); active.delete(event.noteNumber); }
  }
  assert.equal(active.size, 0); assert.equal(tick, 245760);
}
const ticks = (q: any) => q.n * 960 / q.d;
assert.deepEqual(actual.sort(), score.performedSounds.map((p: any) => { const s = score.sounds.find((s: any) => s.id === p.soundId); return `${s.role}/${s.soundingMidi}/${ticks(p.start)}/${ticks(p.start) + ticks(p.duration)}`; }).sort());
// Reopen downloaded immutable PDF; render only first/last, not another 44-page audit.
const task = getDocument({ data: new Uint8Array(bundle.pdf), standardFontDataUrl: `${work}/node_modules/pdfjs-dist/standard_fonts/` });
const pdf = await task.promise; const pages = [];
try {
  for (const number of [1, pdf.numPages]) {
    const page = await pdf.getPage(number); const text = (await page.getTextContent()).items.map((i: any) => i.str ?? '').join(' ');
    const viewport = page.getViewport({ scale: 1.5 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: 'white' }).promise;
    const path = join(output, `downloaded-pdf-page-${number}.png`); await writeFile(path, canvas.toBuffer('image/png'));
    pages.push({ number, path, text });
  }
} finally { await task.destroy(); }
await writeFile(join(output, 'http-artifacts.json'), JSON.stringify({ checkedAt: new Date().toISOString(), status: 'passed', work, origin, store, id, libraryIds: library.arrangements.map((e: any) => e.manifest.id), review: 'deterministic unreviewed smoke only', downloads, negative, corruptions, midi: { tracks: midi.tracks.length, attacks: actual.length, completeCanonicalUnion: true, balancedNotes: true }, pdf: { pages: pdf.numPages, inspectedPages: pages }, limitation: 'Not an independent musical/source approval or a repeat of A01 all-page audit.' }, null, 2));
console.log('PASS: live bytes/MIME/HEAD, persisted identity, 404/405, four actual HTTP corruptions, parsed MIDI, first/last PDF rasters');

// Independent transport checks use original four-bar project fixtures only.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = resolve(process.argv[2]);
const { createSongsterrSourceAdapter } = await import(pathToFileURL(repo + '/src/source/index.ts').href);
const { originalFixture, page, ORIGINAL_URL } = await import(pathToFileURL(repo + '/tests/source/fixtures.ts').href);
const run = (fetch, signal) => createSongsterrSourceAdapter({ fetch, saveArtifact: async () => {} }).import({ kind: 'songsterr-url', url: ORIGINAL_URL }, signal);
const results = [];
let calls = 0;
let result = await run(async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://d3d3l6a6rcgkaf.cloudfront.net/score.json' } }); });
assert.equal(result.status, 'restricted'); assert.equal(calls, 1); results.push('alternate CDN redirect rejected before destination');
result = await run(async () => new Response('interstitial', { headers: { 'content-type': 'application/pdf' } }));
assert.equal(result.status, 'restricted'); results.push('wrong MIME rejected');
result = await run(async () => new Response('small body', { headers: { 'content-length': String(8 * 1024 * 1024 + 1) } }));
assert.equal(result.status, 'unavailable'); results.push('declared size rejected');
const fixture = originalFixture();
for (const partId of [7, 8, 9]) {
  fixture.metadata.tracks.push({ ...fixture.metadata.tracks[0], partId });
  fixture.parts.set(partId, { ...structuredClone(fixture.parts.get(2)), partId });
}
calls = 0;
result = await run(async (url) => {
  calls++;
  if (calls === 1) return new Response(page(fixture.metadata));
  const id = Number(/\/(\d+)\.json$/.exec(url)[1]);
  return new Response(JSON.stringify(fixture.parts.get(id)) + ' '.repeat(7 * 1024 * 1024));
});
assert.equal(result.status, 'unavailable'); assert.equal(calls, 6); results.push('32 MiB cumulative byte limit stops before remaining parts');
let cancelled = false;
const start = performance.now();
const guard = setTimeout(() => { throw new Error('resource timeout did not stop stalled body'); }, 20_000);
try {
  result = await run(async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })));
} finally { clearTimeout(guard); }
const elapsedMs = Math.round(performance.now() - start);
assert.equal(result.status, 'unavailable'); assert(cancelled); assert(elapsedMs >= 14_000 && elapsedMs < 20_000);
results.push('real 15-second stalled-body timeout cancels stream');
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), status: 'passed', checks: results, stalledBodyElapsedMs: elapsedMs }, null, 2));

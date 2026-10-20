// Independent U03 round-two schema/helper probe. No persistence or product gate execution.
// Run: bun <this-file> /absolute/path/to/checkout
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(process.argv[2] ?? '.');
const load = (path) => import(pathToFileURL(resolve(root, path)).href);
const d = await load('src/domain/index.ts');
const { score } = await load('tests/fixtures/original.ts');
const { pendingGates } = await load('tests/fixtures/literal-oracles.ts');
const head = { id: score.revision.id, digest: score.revision.digest };
const checks = [];
let rejectedMutations = 0;
const rejectMutation = (mutation) => {
  assert.equal(d.RevisionMutationSchema.safeParse(mutation).success, false);
  rejectedMutations++;
};

const created = structuredClone(score);
created.projectId = 'independent-api-project';
created.revision = { id: 'independent-api-r1', parentId: null, digest: '0'.repeat(64) };
created.revision.digest = await d.revisionDigest(created);
assert.equal(await d.verifyRevisionDigest(created), true);
assert.equal(d.RevisionMutationSchema.safeParse({ kind: 'create', expectedHead: null, replacement: created }).success, true);
assert.deepEqual(created.source, score.source);
assert.deepEqual(created.sounds, score.sounds);
assert.deepEqual(created.performedSounds, score.performedSounds);
for (const expectedHead of [undefined, head, {}, { id: head.id }, { digest: head.digest }]) {
  rejectMutation({ kind: 'create', expectedHead, replacement: created });
}
for (const parentId of [undefined, '', 'old-revision']) {
  rejectMutation({ kind: 'create', expectedHead: null, replacement: { ...created, revision: { ...created.revision, parentId } } });
}
for (const kind of ['source-edit', 'melody-edit', 'bass-edit', 'harmony-edit', 'preferences-edit', 'approve']) {
  const mutation = { kind, expectedHead: head, replacement: score, ...(kind === 'approve' ? { stage: 'melody' } : {}) };
  assert.equal(d.RevisionMutationSchema.safeParse(mutation).success, true);
  for (const expectedHead of [null, undefined, { id: head.id }, { digest: head.digest }]) {
    rejectMutation({ ...mutation, expectedHead });
  }
}
assert.equal(d.SaveResultSchema.safeParse({ status: 'conflict', currentHead: null }).success, true);
assert.equal(d.SaveResultSchema.safeParse({ status: 'conflict', currentHead: head }).success, true);
assert.equal(d.SaveResultSchema.safeParse({ status: 'conflict' }).success, false);
for (const change of [
  { ...created, projectId: 'different-project' },
  { ...created, revision: { ...created.revision, id: 'different-revision' } },
  { ...created, revision: { ...created.revision, parentId: 'different-parent' } },
]) assert.equal(await d.verifyRevisionDigest(change), false);
checks.push({ name: 'create versus existing-head CAS and API-only identity stamping', rejectedMutations, result: 'passed', limit: 'Schema expressibility only; no store, atomicity or approval-authenticity claim' });

const ready = {
  status: 'ready', downloadPath: '/artifacts/current.mid', filename: 'current.mid', mediaType: 'audio/midi',
  manifest: {
    schemaVersion: 1, scoreRevision: head, sourceRevision: score.source.revision,
    ability: { id: score.ability.id, version: score.ability.version }, adapter: { name: 'independent-schema-probe', version: '1' },
    format: 'midi', artifactDigest: '0'.repeat(64), byteLength: 1,
    occurrenceCount: 2, soundingAttackCount: 9, notationSegmentCount: 11,
    review: 'unreviewed-draft', validationVersion: 'schema-only',
    tuning: score.instrument.tuning, capo: 0, midiPitchPolicy: 'already-sounding-no-capo-offset',
  },
};
assert.equal(d.ExportResponseSchema.safeParse(ready).success, true);
const base = 'https://guitar.example:8443';
const oldAttacks = ['//example.org/x.mid', '/\\example.org/x.mid', '/\n/example.org/x.mid'];
for (const downloadPath of oldAttacks) {
  assert.equal(new URL(downloadPath, base).origin, 'https://example.org');
  assert.equal(d.ExportResponseSchema.safeParse({ ...ready, downloadPath }).success, false);
  assert.throws(() => d.resolveLocalDownloadUrl(downloadPath, base));
}
let controlCases = 0;
for (let code = 0; code < 160; code++) {
  if (code > 31 && code < 127) continue;
  for (const downloadPath of [`/${String.fromCharCode(code)}/example.org/x.mid`, `/artifacts/x${String.fromCharCode(code)}.mid`, `/x.mid?y=${String.fromCharCode(code)}`]) {
    assert.equal(d.ExportResponseSchema.safeParse({ ...ready, downloadPath }).success, false);
    assert.throws(() => d.resolveLocalDownloadUrl(downloadPath, base));
    controlCases++;
  }
}
for (const downloadPath of ['', 'x.mid', 'https://example.org/x.mid', '///example.org/x.mid', '/x\\y.mid']) {
  assert.equal(d.ExportResponseSchema.safeParse({ ...ready, downloadPath }).success, false);
}
let corpusSize = 0;
let accepted = 0;
const checkPath = (path) => {
  corpusSize++;
  if (!d.LocalDownloadPathSchema.safeParse(path).success) return;
  accepted++;
  assert.equal(new URL(path, base).origin, base);
  assert.equal(d.resolveLocalDownloadUrl(path, base).origin, base);
};
for (let a = 0; a < 160; a++) {
  for (let b = 0; b < 160; b++) checkPath(`/${String.fromCharCode(a)}${String.fromCharCode(b)}example.org/x.mid`);
}
for (const path of [
  '/', '/artifacts/current.mid', '/./artifacts/../x.mid', '/.//example.org/x.mid',
  '/%2f%2fexample.org/x.mid', '/%5cexample.org/x.mid', '/%0a/example.org/x.mid',
  '/%2e%2e//example.org/x.mid', '/%252f%252fexample.org/x.mid', '/／／example.org/x.mid',
  '/∕∕example.org/x.mid', '/x.mid?redirect=https://example.org/#//example.org',
]) checkPath(path);
for (const origin of ['file:///tmp/music', 'data:text/plain,x', 'javascript:alert(1)', 'not an origin']) {
  assert.throws(() => d.resolveLocalDownloadUrl('/x.mid', origin));
}
assert.equal(d.resolveLocalDownloadUrl('/x.mid', 'http://localhost:3000').origin, 'http://localhost:3000');
checks.push({ name: 'real export-response schema and WHATWG same-origin resolution', oldAttacksRejected: oldAttacks, controlCases, corpusSize, accepted, offOriginAccepted: 0, result: 'passed', limit: 'No HTTP endpoint/redirect server; do not decode or reinterpret paths as new URLs' });

let intervalCases = 0;
for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
  for (let c = -6; c <= 6; c++) for (let e = -6; e <= 6; e++) {
    assert.equal(d.overlaps(d.q(a, 2), d.q(b, 2), d.q(c, 2), d.q(e, 2)), a < b && c < e && a < e && c < b);
    intervalCases++;
  }
}
checks.push({ name: 'overlaps including empty/reversed half-open intervals', intervalCases, result: 'passed' });
assert.equal(pendingGates.length, 11);
assert.equal(new Set(pendingGates).size, 11);
console.log(JSON.stringify({
  scope: 'Independent U03 round-two boundary/helper review; not product acceptance',
  checkedAt: new Date().toISOString(), root,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  status: 'passed', checks, pendingGates,
}, null, 2));

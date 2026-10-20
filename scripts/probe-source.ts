/** Optional copyrighted live acceptance. Run only with --live; raw/score output stays ignored/local. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { z } from 'zod';
import { add, compare, eventEnd, q, SourceScoreV1Schema, verifyRevisionDigest } from '../src/domain';
import type { Q } from '../src/domain';
import { createDefaultMelodySelection, createSongsterrSourceAdapter } from '../src/source';

const ACCEPTANCE_URL = 'https://www.songsterr.com/a/wsa/beach-boys-you-still-believe-in-me-tab-s692866';
const args = process.argv.slice(2);
if (!args.includes('--live')) {
  console.log('No network performed. Opt in: bun scripts/probe-source.ts --live [--compare-reference] [--out tests/source/.local/live]');
  process.exit(0);
}
const repoRoot = resolve(import.meta.dir, '..');
const ignoredRoot = resolve(repoRoot, 'tests/source/.local');
const out = resolve(repoRoot, args[args.indexOf('--out') + 1] && args.includes('--out') ? args[args.indexOf('--out') + 1]! : 'tests/source/.local/live');
const fromIgnored = relative(ignoredRoot, out);
if (fromIgnored.startsWith('..' + sep) || fromIgnored === '..' || resolve(ignoredRoot, fromIgnored) !== out) throw new Error('--out must be under ignored tests/source/.local; copyrighted raw/score is not a distributable fixture.');
await mkdir(resolve(out, 'raw'), { recursive: true });
const retained = new Map<string, Uint8Array>();
const result = await createSongsterrSourceAdapter({ saveArtifact: async ({ descriptor, bytes }) => {
  const name = descriptor.id === 'song-page' ? 'song-page.html' : `${descriptor.id}.json`;
  await Bun.write(resolve(out, 'raw', name), bytes);
  retained.set(descriptor.id, bytes);
} }).import({ kind: 'songsterr-url', url: ACCEPTANCE_URL });
if (result.status !== 'source-ready') {
  await Bun.write(resolve(out, 'failure.json'), JSON.stringify(result, null, 2));
  throw new Error(`Live source stopped: ${JSON.stringify(result)}`);
}
const source = SourceScoreV1Schema.parse(result.source);
assert(await verifyRevisionDigest(source), 'Actual SourceScoreV1 revision digest must verify');
assert.deepEqual(source.manifest.identity, { kind: 'songsterr', url: ACCEPTANCE_URL, songId: 692866, upstreamRevisionId: 847990, formatVersion: 5 });
assert.equal(source.bars.length, 46);
assert.equal(source.parts.length, 11);
assert.deepEqual(source.parts.map((p) => p.id), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert(source.bars.every((b) => b.meter.beats === 4 && b.meter.beatUnit === 4 && b.length.n === 4 && b.length.d === 1));
assert.deepEqual(source.form.repeats.map((r) => [r.fromBarId, r.toBarId, r.totalPasses]), [['bar-5', 'bar-7', 2], ['bar-17', 'bar-19', 2], ['bar-43', 'bar-46', 4]]);
assert.deepEqual(source.tempos.map((t) => [t.barId, t.offset, t.quarterBpm]), [['bar-1', q(0), 80], ['bar-5', q(0), 90], ['bar-40', q(0), 87], ['bar-41', q(0), 85], ['bar-43', q(0), 90]]);
const vocal = source.events.filter((e) => e.partId === 0 && e.kind === 'note');
assert.equal(vocal.length, 141);
assert.equal(vocal.reduce((n, e) => n + e.refs.length, 0), 154);
assert.deepEqual(vocal.slice(0, 6).map((e) => [e.kind === 'note' && e.soundingMidi, e.start, e.duration]), [
  [54, { n: 16, d: 1 }, { n: 1, d: 1 }], [59, { n: 17, d: 1 }, { n: 1, d: 1 }],
  [61, { n: 18, d: 1 }, { n: 1, d: 2 }], [63, { n: 37, d: 2 }, { n: 1, d: 2 }],
  [64, { n: 19, d: 1 }, { n: 1, d: 2 }], [63, { n: 39, d: 2 }, { n: 1, d: 1 }],
]);
assert.equal(vocal[5]?.refs.length, 2, 'Bar-5 final attack must continue into bar 6, not retrigger');
assert(vocal.every((e) => compare(e.start, q(16)) >= 0));
assert.equal(source.key.status, 'unknown', 'B major is a user hypothesis, not source-declared key');

// Independent narrow raw checker. Deliberately does not use the adapter raw schema/rhythm decoder.
const rawSchema = z.object({
  songId: z.number(), revisionId: z.number(), partId: z.number(), tuning: z.array(z.number()).optional(),
  measures: z.array(z.object({ voices: z.array(z.object({ beats: z.array(z.object({
    duration: z.tuple([z.number(), z.number()]), tuplet: z.number().optional(),
    notes: z.array(z.object({ rest: z.boolean().optional(), tie: z.boolean().optional(), string: z.number().optional(), fret: z.number().optional() })),
  })) })) })),
});
const partFacts: { partId: number; rawNoteSlots: number; canonicalAttacks: number; canonicalRefs: number; tripletBars: number[] }[] = [];
function eqFraction(a: Q, n: number, d: number) { return BigInt(a.n) * BigInt(d) === BigInt(n) * BigInt(a.d); }
for (const descriptor of source.manifest.artifacts) {
  const bytes = retained.get(descriptor.id)!;
  assert.equal(bytes.byteLength, descriptor.byteLength);
  assert.equal(new Bun.CryptoHasher('sha256').update(bytes).digest('hex'), descriptor.sha256);
  if (descriptor.id === 'song-page') continue;
  const raw = rawSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  assert.equal(raw.songId, 692866); assert.equal(raw.revisionId, 847990);
  let slots = 0;
  const tripletBars: number[] = [];
  const events = source.events.filter((e) => e.partId === raw.partId);
  for (const [barIndex, measure] of raw.measures.entries()) {
    for (const [voiceIndex, voice] of measure.voices.entries()) {
      let offsetN = 0n; let offsetD = 1n;
      for (const [beatIndex, beat] of voice.beats.entries()) {
        if (beat.tuplet === 3 && !tripletBars.includes(barIndex + 1)) tripletBars.push(barIndex + 1);
        for (const [noteIndex, note] of beat.notes.entries()) {
          if (!note.rest) slots++;
          const rawId = `p${raw.partId}:b${barIndex + 1}:v${voiceIndex}:bt${beatIndex}:n${noteIndex}`;
          const matching = events.filter((event) => event.refs.some((ref) => ref.sourceNoteId === rawId));
          assert.equal(matching.length, 1, `Every original raw note/rest must map once: ${rawId}`);
          const event = matching[0]!;
          const ref = event.refs.find((ref) => ref.sourceNoteId === rawId)!;
          assert(eqFraction(ref.rawWholeNoteDuration, beat.duration[0], beat.duration[1]), `Exact raw fraction ${rawId}`);
          assert.equal(ref.noteIndex, noteIndex); assert.equal(ref.partId, raw.partId);
          if (event.kind === 'note') {
            const expectedPitch = raw.partId === 10 ? note.fret : raw.tuning![note.string!]! + note.fret!;
            assert.equal(event.soundingMidi, expectedPitch, `Original sounding pitch ${rawId}`);
            if (!note.tie) {
              assert(BigInt(event.start.n) * offsetD === (BigInt(barIndex * 4) * offsetD + offsetN) * BigInt(event.start.d), `Original attack offset ${rawId}`);
            }
          }
        }
        offsetN = offsetN * BigInt(beat.duration[1]) + 4n * BigInt(beat.duration[0]) * offsetD;
        offsetD *= BigInt(beat.duration[1]);
        const gcd = (a: bigint, b: bigint): bigint => b ? gcd(b, a % b) : a;
        const divisor = gcd(offsetN, offsetD); offsetN /= divisor; offsetD /= divisor;
      }
      assert.equal(offsetN, 4n * offsetD, `Exact full raw voice rhythm in part ${raw.partId}, bar ${barIndex + 1}`);
    }
  }
  for (const event of events) {
    let n = 0n; let d = 1n;
    for (const ref of event.refs) {
      // Duplicate unison chord refs share time; this live source has no unison duplicate members.
      n = n * BigInt(ref.rawWholeNoteDuration.d) + 4n * BigInt(ref.rawWholeNoteDuration.n) * d;
      d *= BigInt(ref.rawWholeNoteDuration.d);
    }
    assert.equal(BigInt(event.duration.n) * d, n * BigInt(event.duration.d), `Merged source duration ${event.id}`);
  }
  partFacts.push({ partId: raw.partId, rawNoteSlots: slots, canonicalAttacks: events.filter((e) => e.kind === 'note').length, canonicalRefs: events.filter((e) => e.kind === 'note').reduce((n, e) => n + e.refs.length, 0), tripletBars });
}
assert.deepEqual(partFacts.find((p) => p.partId === 0)?.tripletBars, [6, 8, 9, 18, 20, 21, 29]);
assert.equal(partFacts.find((p) => p.partId === 7)?.rawNoteSlots, 948);
assert.equal(partFacts.find((p) => p.partId === 8)?.rawNoteSlots, 174);
assert.equal(partFacts.find((p) => p.partId === 9)?.rawNoteSlots, 174);

const proposal = createDefaultMelodySelection(source);
if (proposal.status !== 'proposed') throw new Error(JSON.stringify(proposal));
assert.deepEqual(proposal.provenance.primary, { partId: 0, voiceId: 'p0:v0' });
const sectionMap = proposal.selection.sections.map((s) => ({ label: s.label, fromQuarter: s.start, toQuarter: s.end, parts: s.selectors.map((v) => v.partId), eventCount: s.selectors.reduce((n, v) => n + v.eventIds.length, 0), intentionalRestCount: s.intentionalRests.length }));
assert.deepEqual(proposal.selection.sections[0]?.selectors.map((s) => s.partId), [1], 'Intro must propose explicit part-1 events, not default guitar or busy sustained harpsichord');
let cursor = q(0);
const selectedIds = new Set<string>();
for (const section of proposal.selection.sections) {
  assert.deepEqual(section.start, cursor);
  const intervals = section.selectors.flatMap((selector) => selector.eventIds.map((id) => {
    const event = source.events.find((e) => e.id === id)!;
    assert(event); assert(!selectedIds.has(id)); selectedIds.add(id);
    assert.equal(event.partId, selector.partId); assert.equal(event.voiceId, selector.voiceId);
    assert(compare(event.start, section.start) >= 0 && compare(eventEnd(event), section.end) <= 0);
    if (event.kind === 'note') assert(!event.effects.some((e) => e.affectsMelody));
    return { start: event.start, end: eventEnd(event) };
  })).concat(section.intentionalRests.map((r) => ({ start: r.start, end: add(r.start, r.duration) }))).sort((a, b) => compare(a.start, b.start));
  for (const interval of intervals) { assert.deepEqual(interval.start, cursor, 'Selection must tile time exactly without gaps or polyphony'); cursor = interval.end; }
  assert.deepEqual(cursor, section.end);
}
assert.deepEqual(cursor, { n: 184, d: 1 });
assert(vocal.every((e) => selectedIds.has(e.id)), 'Every part-0 merged attack must survive the proposed section map');

const referenceFacts: unknown[] = [];
if (args.includes('--compare-reference')) {
  const path = '/home/taytay/workspace/midi-to-readable-notaion/src/server/songsterr.ts';
  const reference = await import(path);
  const RefSchema = z.object({ warnings: z.array(z.string()), track: z.object({ id: z.number(), noteCount: z.number(), measures: z.array(z.object({ voices: z.array(z.object({ beats: z.array(z.object({ id: z.string(), kind: z.string(), start: z.number(), duration: z.number(), notes: z.array(z.object({ midi: z.number(), tie: z.boolean() })).optional() })) })) })) }) });
  const nativeFetch = globalThis.fetch;
  let denied = false;
  const guardedFetch = Object.assign(async (...params: Parameters<typeof fetch>) => {
    const url = new URL(String(params[0]));
    if (denied || url.protocol !== 'https:' || !['www.songsterr.com', 'songsterr.com', 'dqsljvtekg760.cloudfront.net'].includes(url.hostname)) throw new Error('Reference comparison stopped by host/restriction policy');
    const response = await nativeFetch(...params);
    if ([401, 403, 429, 451].includes(response.status)) { denied = true; await response.body?.cancel(); throw new Error('Reference comparison stopped on access denial, no alternate CDN request'); }
    return response;
  }, { preconnect: nativeFetch.preconnect });
  globalThis.fetch = guardedFetch;
  try {
    for (const partId of [0, 1, 2, 7, 8, 9]) {
      const imported = RefSchema.parse(await reference.importSong({ url: ACCEPTANCE_URL, partId }));
      assert.deepEqual(imported.warnings, []); assert.equal(imported.track.id, partId); assert.equal(imported.track.measures.length, 46);
      const fact = partFacts.find((p) => p.partId === partId)!;
      assert.equal(imported.track.noteCount, fact.rawNoteSlots);
      let referenceSlots = 0;
      for (const [barIndex, measure] of imported.track.measures.entries()) for (const voice of measure.voices) for (const beat of voice.beats) {
        const refs = source.events.filter((e) => e.partId === partId).flatMap((event) => event.refs.filter((r) => {
          const expectedId = `${r.partId}:${Number(r.barId.slice(4)) - 1}:${Number(r.voiceId.split(':v')[1])}:${Number(r.beatId.split(':bt')[1])}`;
          return expectedId === beat.id;
        }).map((ref) => ({ event, ref })));
        assert(refs.length > 0, `Reference beat identity retained: ${beat.id}`);
        assert(refs.every(({ ref }) => Math.abs(4 * ref.rawWholeNoteDuration.n / ref.rawWholeNoteDuration.d - beat.duration) < 1e-10), `Reference rhythm: ${beat.id}`);
        if (beat.kind === 'notes') {
          referenceSlots += beat.notes!.length;
          const expectedPitches = beat.notes!.map((n) => n.midi).sort((a, b) => a - b);
          assert.deepEqual(refs.map(({ event }) => event.kind === 'note' ? event.soundingMidi : -1).sort((a, b) => a - b), expectedPitches);
          for (const note of beat.notes!.filter((n) => !n.tie)) assert(refs.some(({ event }) => event.kind === 'note' && event.soundingMidi === note.midi && Math.abs(event.start.n / event.start.d - (barIndex * 4 + beat.start)) < 1e-10));
        }
      }
      assert.equal(referenceSlots, fact.rawNoteSlots);
      referenceFacts.push({ partId, referenceNoteSlots: imported.track.noteCount, bars: imported.track.measures.length, warnings: imported.warnings, comparison: 'all beat identities, pitch members, exact fraction durations and attack onsets agree' });
    }
  } finally { globalThis.fetch = nativeFetch; }
}

await Bun.write(resolve(out, 'source.json'), JSON.stringify(source, null, 2));
await Bun.write(resolve(out, 'melody-proposal.json'), JSON.stringify(proposal, null, 2));
const summary = { status: 'verified-source-proposal-not-approved-arrangement', sourcePath: resolve(out, 'source.json'), proposalPath: resolve(out, 'melody-proposal.json'), sourceRevision: source.revision, identity: source.manifest.identity, writtenBars: 46, writtenQuarters: 184, partFacts, sectionMap, key: source.key, diagnostics: result.diagnostics, referenceFacts, notes: ['No engine/form expansion/UI/export implemented.', 'Expected downstream performed form is 64 occurrences/256 quarters; this importer retains written repeats only.', 'Source header is provisional. API must restamp before persistence and regenerate selection binding.', 'Source rests and intentional rests together tile every selected section; source-rest refs are preserved.', 'Raw score content is copyrighted and saved only under gitignored tests/source/.local.'] };
await Bun.write(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

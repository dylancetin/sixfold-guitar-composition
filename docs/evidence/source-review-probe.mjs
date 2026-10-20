// Independent U04 judge: no score fixture or copied song notes. All music stays local.
// Usage: bun this-file.mjs REPO LOCAL_LIVE_DIR [--manifest]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const repo = resolve(process.argv[2] ?? '.');
const local = resolve(process.argv[3] ?? join(repo, 'tests/source/.local/live'));
const load = async (path) => JSON.parse(await readFile(path, 'utf8'));
const domain = await import(pathToFileURL(join(repo, 'src/domain/index.ts')).href);
const api = await import(pathToFileURL(join(repo, 'src/source/index.ts')).href);
const reference = await import('/home/taytay/workspace/midi-to-readable-notaion/src/server/songsterr.ts');
let checks = 0;
const eq = (actual, expected, label) => { checks++; assert.deepEqual(actual, expected, label); };
const ok = (value, label) => { checks++; assert(value, label); };
const gcd = (a, b) => b === 0n ? a : gcd(b, a % b);
const rat = (n, d = 1n) => { n = BigInt(n); d = BigInt(d); const g = gcd(n, d); return [n / g, d / g]; };
const plus = (a, b) => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const cmp = (a, b) => a[0] * b[1] < b[0] * a[1] ? -1 : a[0] * b[1] > b[0] * a[1] ? 1 : 0;
const key = (a) => `${a[0]}/${a[1]}`;
const fromQ = (a) => rat(a.n, a.d);
const end = (a) => plus(fromQ(a.start), fromQ(a.duration));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = await readFile(join(local, 'source.json'));
const source = domain.SourceScoreV1Schema.parse(JSON.parse(sourceBytes));
ok(await domain.verifyRevisionDigest(source), 'source digest');
eq(source.parts.map((p) => p.id), Array.from({ length: 11 }, (_, i) => i), 'all part identities');
eq(source.bars.length, 46, 'bar count');
eq(source.key.status, 'unknown', 'key uncertainty');
if (process.argv.includes('--manifest')) {
  const facts = await load(join(repo, 'docs/evidence/source-live-facts.json'));
  eq(hash(sourceBytes), facts.sourceFileSha256, 'worker source-file hash');
  eq(sourceBytes.length, facts.sourceFileByteLength, 'worker source-file size');
  eq(source.revision.id, facts.sourceRevision.id, 'worker revision id');
  eq(source.revision.digest, facts.sourceRevision.digest, 'worker revision digest');
  eq(source.manifest.artifacts, facts.rawArtifacts, 'worker raw artifact manifest');
}
const retained = new Map();
for (const artifact of source.manifest.artifacts) {
  const bytes = await readFile(join(local, 'raw', artifact.id === 'song-page' ? 'song-page.html' : artifact.id + '.json'));
  eq(hash(bytes), artifact.sha256, `raw hash ${artifact.id}`);
  eq(bytes.length, artifact.byteLength, `raw size ${artifact.id}`);
  retained.set(artifact.id, bytes);
}
const html = retained.get('song-page').toString();
const state = /<script\b[^>]*\bid="state"[^>]*>([\s\S]*?)<\/script>/.exec(html);
ok(state, 'independently find raw page state');
const metadata = JSON.parse(state[1]).meta.current;
eq([metadata.songId, metadata.revisionId, metadata.defaultTrack], [692866, 847990, 2], 'raw page identities/default');
eq([metadata.hasPlayer, metadata.isBlocked, metadata.isRestricted, metadata.restriction], [true, false, false, ''], 'raw access flags');
const expectedAll = [];
const parts = [];
for (let partId = 0; partId < 11; partId++) {
  const raw = JSON.parse(retained.get('part-' + partId));
  eq([raw.songId, raw.revisionId, raw.partId, raw.version], [692866, 847990, partId, 5], 'raw part identity');
  eq(raw.measures.flatMap((m, i) => m.repeatStart ? [i + 1] : []), [5, 17, 43], 'raw repeat starts');
  eq(raw.measures.flatMap((m, i) => (m.repeat ?? m.repeatCount ?? 0) ? [[i + 1, m.repeat ?? m.repeatCount]] : []), [[7, 2], [19, 2], [46, 4]], 'raw repeat ends/total passes');
  eq(raw.automations.tempo.map((t) => [t.measure + 1, t.position ?? 0, t.type ?? 4, t.bpm]), [[1, 0, 4, 80], [5, 0, 4, 90], [40, 0, 4, 87], [41, 0, 4, 85], [43, 0, 4, 90]], 'raw tempo automation');
  const events = source.events.filter((e) => e.partId === partId);
  const expected = [];
  const previous = new Map();
  const tripletBars = new Set();
  let barStart = rat(0); let meter;
  let slots = 0;
  for (const [bi, measure] of raw.measures.entries()) {
    meter = measure.signature ?? meter;
    eq(meter, [4, 4], 'raw meter');
    const bar = source.bars[bi];
    eq(key(fromQ(bar.start)), key(barStart), 'bar offset');
    for (const [vi, voice] of measure.voices.entries()) {
      let offset = rat(0);
      let prior = previous.get(vi) ?? new Map();
      for (const [ti, beat] of voice.beats.entries()) {
        const duration = rat(4 * beat.duration[0], beat.duration[1]);
        const start = plus(barStart, offset);
        const beatId = `p${partId}:b${bi + 1}:v${vi}:bt${ti}`;
        const isRest = beat.rest || voice.rest || measure.rest || beat.notes.every((n) => n.rest);
        if (beat.tuplet === 3) tripletBars.add(bi + 1);
        const refs = beat.notes.map((note, ni) => ({
          sourceNoteId: `${beatId}:n${ni}`, partId, barId: `bar-${bi + 1}`, voiceId: `p${partId}:v${vi}`, beatId, noteIndex: ni,
          rawWholeNoteDuration: key(rat(...beat.duration)),
          sourcePosition: partId !== 10 && note.string >= 0 && note.fret !== undefined ? { stringIndex: note.string, fret: note.fret } : null,
        }));
        if (isRest) {
          expected.push({ id: beatId + ':rest', kind: 'rest', start, duration, refs });
          prior = new Map();
        } else {
          const members = new Map();
          beat.notes.forEach((note, ni) => {
            slots++;
            const midi = partId === 10 ? note.fret : raw.tuning[note.string] + note.fret;
            const values = members.get(midi) ?? []; values.push({ note, ref: refs[ni] }); members.set(midi, values);
            const unknown = Object.keys(note).filter((k) => !['fret', 'string', 'tie', 'rest', 'accentuated', 'ghost', 'velocity'].includes(k));
            eq(unknown, [], 'no silently unhandled actual-song note construct');
          });
          const current = new Map();
          for (const [midi, values] of members) {
            const tied = values[0].note.tie === true;
            let event;
            if (tied) {
              event = prior.get(midi);
              ok(event, 'raw tie has earlier same-pitch attack');
              eq(key(plus(event.start, event.duration)), key(start), 'raw tie adjacency');
              event.duration = plus(event.duration, duration);
              event.refs.push(...values.map((m) => m.ref));
              event.tied = true;
            } else {
              event = { kind: 'note', id: values[0].ref.sourceNoteId, midi, start, duration, refs: values.map((m) => m.ref), tied: false };
              expected.push(event);
            }
            current.set(midi, event);
          }
          prior = current;
        }
        offset = plus(offset, duration);
      }
      eq(key(offset), '4/1', 'raw exact full voice');
      previous.set(vi, prior);
    }
    barStart = plus(barStart, rat(meter[0] * 4, meter[1]));
  }
  eq(events.length, expected.length, 'no added/deleted events');
  for (const wanted of expected) {
    const event = events.find((e) => e.id === wanted.id);
    ok(event, 'original attack/rest id retained');
    eq(event.kind, wanted.kind, 'event kind');
    eq(key(fromQ(event.start)), key(wanted.start), 'exact raw attack/rest onset');
    eq(key(fromQ(event.duration)), key(wanted.duration), 'exact independently merged duration');
    eq(event.refs.map((r) => ({ ...r, rawWholeNoteDuration: key(fromQ(r.rawWholeNoteDuration)) })), wanted.refs, 'every raw ref and source position');
    if (event.kind === 'note') {
      eq(event.soundingMidi, wanted.midi, 'raw sounding pitch');
      eq(event.tieChainId, wanted.tied ? `tie:${event.id}` : null, 'tie identity');
      if ([0, 1].includes(partId)) eq(event.effects.filter((e) => e.affectsMelody), [], 'relevant actual source effects supported');
    }
  }
  eq(new Set(events.flatMap((e) => e.refs.map((r) => r.sourceNoteId))).size, events.reduce((n, e) => n + e.refs.length, 0), 'raw ref uniqueness');
  const fact = { partId, slots, attacks: expected.filter((e) => e.kind === 'note').length, tripletBars: [...tripletBars] };
  parts.push(fact); expectedAll.push(...expected);
  if ([0, 1, 2, 7, 8, 9].includes(partId)) {
    const ref = reference.normalizeTrack({ metadata: metadata.tracks.find((p) => p.partId === partId), revision: raw });
    eq(ref.warnings, [], 'read-only reference normalization');
    eq(ref.track.noteCount, slots, 'reference slot count');
    for (const [bi, measure] of ref.track.measures.entries()) for (const [vi, voice] of measure.voices.entries()) for (const [ti, beat] of voice.beats.entries()) {
      const beatId = `p${partId}:b${bi + 1}:v${vi}:bt${ti}`;
      const rawBeat = raw.measures[bi].voices[vi].beats[ti];
      eq(beat.kind, rawBeat.notes.every((n) => n.rest) ? 'rest' : 'notes', 'reference kind');
      ok(Math.abs(beat.duration - 4 * rawBeat.duration[0] / rawBeat.duration[1]) < 1e-10, 'reference exact source duration');
      const mapped = events.flatMap((event) => event.refs.filter((r) => r.beatId === beatId).map((r) => ({ event, r })));
      eq(mapped.length, rawBeat.notes.length, 'reference members retained');
      if (beat.kind === 'notes') eq(mapped.map(({ event }) => event.soundingMidi).sort((a, b) => a - b), beat.notes.map((n) => n.midi).sort((a, b) => a - b), 'reference pitches');
    }
  }
}
eq(parts[0], { partId: 0, slots: 154, attacks: 141, tripletBars: [6, 8, 9, 18, 20, 21, 29] }, 'part-0 literal oracle');
eq(expectedAll.filter((e) => e.kind === 'note' && e.id.startsWith('p0:')).slice(0, 6).map((e) => [e.midi, key(e.start), key(e.duration)]), [[54, '16/1', '1/1'], [59, '17/1', '1/1'], [61, '18/1', '1/2'], [63, '37/2', '1/2'], [64, '19/1', '1/2'], [63, '39/2', '1/1']], 'independently reconstructed raw bar-5 opening');
eq(source.form.repeats.map((r) => [r.fromBarId, r.toBarId, r.totalPasses]), [['bar-5', 'bar-7', 2], ['bar-17', 'bar-19', 2], ['bar-43', 'bar-46', 4]], 'written repeat oracle');
const proposal = api.createDefaultMelodySelection(source);
eq(proposal.status, 'proposed', 'complete proposed map');
eq(proposal.provenance.approval, 'unapproved', 'not musical approval');
const selected = new Set(); let cursor = rat(0);
eq(proposal.selection.sections.map((s) => [key(fromQ(s.start)), key(fromQ(s.end)), s.selectors.map((p) => p.partId)]), [
  ['0/1', '16/1', [1]], ['16/1', '64/1', [0]], ['64/1', '132/1', [0]], ['132/1', '148/1', [1]], ['148/1', '164/1', [0]], ['164/1', '168/1', []], ['168/1', '184/1', [0]],
], 'complete literal section map');
for (const section of proposal.selection.sections) {
  eq(key(fromQ(section.start)), key(cursor), 'section adjacency');
  const intervals = section.intentionalRests.map((r) => ({ start: fromQ(r.start), end: end(r) }));
  for (const selector of section.selectors) for (const id of selector.eventIds) {
    ok(!selected.has(id), 'no duplicate selection'); selected.add(id);
    const event = source.events.find((e) => e.id === id);
    eq([event.partId, event.voiceId], [selector.partId, selector.voiceId], 'selection source identity');
    ok(cmp(fromQ(event.start), fromQ(section.start)) >= 0 && cmp(end(event), fromQ(section.end)) <= 0, 'no clipping');
    intervals.push({ start: fromQ(event.start), end: end(event) });
  }
  intervals.sort((a, b) => cmp(a.start, b.start));
  for (const interval of intervals) { eq(key(interval.start), key(cursor), 'no gap/overlap/polyphony'); cursor = interval.end; }
  eq(key(cursor), key(fromQ(section.end)), 'exact section coverage');
}
eq(key(cursor), '184/1', 'full-song written coverage');
for (const event of source.events.filter((e) => e.partId === 0 && e.kind === 'note')) ok(selected.has(event.id), 'every main melody attack selected');
for (const event of source.events.filter((e) => e.partId === 1 && (e.start.n / e.start.d < 16 || e.start.n / e.start.d >= 132 && e.start.n / e.start.d < 148))) ok(selected.has(event.id), 'all intro/interlude events selected without omitted polyphony');
eq(proposal.provenance.choices.flatMap((c) => c.omittedOverlappingEventIds), [], 'no omitted actual-song notes in proposed ranges');
const silent = proposal.selection.sections[5];
eq(silent.intentionalRests.map((r) => [key(fromQ(r.start)), key(fromQ(r.duration))]), [['164/1', '4/1']], 'bar-42 intentional source silence');
const restEvidence = proposal.provenance.choices[5].intentionalSilenceSourceEventIds;
eq(restEvidence.length, 1, 'source silence evidence');
ok(source.events.some((e) => e.id === restEvidence[0] && e.kind === 'rest' && key(fromQ(e.start)) === '164/1' && key(fromQ(e.duration)) === '4/1'), 'actual bar-42 source rest');

// Replay actual captured bytes through public API; mutate only an in-memory copy.
const url = source.manifest.identity.url;
const replay = async (mutate, expectedStatus, label) => {
  const raws = new Map([...retained].map(([id, bytes]) => [id, id === 'song-page' ? bytes.toString() : JSON.parse(bytes)]));
  mutate(raws); let calls = 0;
  const result = await api.createSongsterrSourceAdapter({ fetch: async (address) => {
    calls++;
    return new Response(calls === 1 ? raws.get('song-page') : JSON.stringify(raws.get('part-' + /\/(\d+)\.json$/.exec(address)[1])));
  }, saveArtifact: async () => {}, now: () => new Date(source.manifest.retrievedAt) }).import({ kind: 'songsterr-url', url });
  eq(result.status, expectedStatus, label);
  if (expectedStatus !== 'source-ready') ok(!('source' in result), 'no partial result');
  return { result, calls };
};
const unchanged = await replay(() => {}, 'source-ready', 'raw replay');
eq(unchanged.result.source, source, 'exact replay of all persisted source data');
const firstAttack = (raws) => raws.get('part-0').measures[4].voices[0].beats[0];
await replay((r) => { firstAttack(r).notes[0].tie = true; }, 'unsupported', 'independent orphan tie corruption');
await replay((r) => { firstAttack(r).duration = [1, 3]; }, 'unsupported', 'independent exact duration corruption');
await replay((r) => { delete firstAttack(r).notes[0].fret; }, 'unsupported', 'independent missing pitch corruption');
await replay((r) => { r.get('part-0').measures[5].repeatStart = true; }, 'unsupported', 'independent nested repeat corruption');
await replay((r) => { r.get('part-0').measures[4].alternateEnding = [1]; }, 'unsupported', 'independent ending corruption');
await replay((r) => { firstAttack(r).graceNote = 'beforeBeat'; }, 'unsupported', 'independent grace timing corruption');
await replay((r) => { r.get('part-1').automations.tempo[0].bpm += 1; }, 'unsupported', 'independent cross-part structure corruption');
const privatePart = await replay((r) => { r.get('part-0').isPrivate = true; }, 'restricted', 'independent raw access restriction');
eq(privatePart.calls, 2, 'stop all later requests');
const effect = await replay((r) => { firstAttack(r).notes[0].slide = { target: 8 }; }, 'source-ready', 'unsupported effects retained in source');
eq(api.createDefaultMelodySelection(effect.result.source).status, 'selection-needed', 'unsupported relevant pitch effect cannot silently produce proposal');
// Identity stamping remains API owned, and selection must bind the new digest.
const stamped = structuredClone(source);
stamped.revision = { id: 'review-api-source-r1', parentId: null, digest: '0'.repeat(64) };
stamped.revision.digest = await domain.revisionDigest(stamped);
ok(await domain.verifyRevisionDigest(stamped), 'API-stamped digest verifies');
eq(api.createDefaultMelodySelection(stamped).selection.sourceRevision, { id: stamped.revision.id, digest: stamped.revision.digest }, 'selection rebind after API identity stamping');
console.log(JSON.stringify({ status: 'VERIFIED U04 source, not musical approval', checkedAt: new Date().toISOString(), repo, local, checks, sourceFileSha256: hash(sourceBytes), sourceFileBytes: sourceBytes.length, sourceRevision: source.revision, parts, independentCorruptCases: 9, rawReplayExact: true, selection: 'complete monophonic 0–184; all 141 main attacks; part1 intro/interlude; source-silent42', key: source.key.status }, null, 2));

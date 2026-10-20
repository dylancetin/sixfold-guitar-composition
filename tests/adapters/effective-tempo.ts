// Integration regression: REQUIRES the actual independent engine validator, never a passing stub.
// ADAPTERS_VALIDATOR_MODULE=/absolute/path/to/src/engine/index.ts bun tests/adapters/effective-tempo.ts [evidence-directory]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Midi } from '@tonejs/midi';
import { parseMidi } from 'midi-file';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createAlphaTabScore, createPlaybackController, createTempoClock, compileTimeline } from '../../src/adapters';
import { createScoreAdapter } from '../../src/adapters/server';
import type { ScoreV1, Validator } from '../../src/domain';
import { FakeAudioContext } from './fake-audio';
import { stamp, study } from './fixture';

const validatorPath = process.env.ADAPTERS_VALIDATOR_MODULE ?? path.resolve('src/engine/index.ts');
const { guitarValidator: validator } = await import(pathToFileURL(validatorPath).href) as { guitarValidator: Validator };
assert.equal(typeof validator?.validate, 'function', 'Actual independent guitarValidator is required');
const root = path.resolve(process.argv[2] ?? '/tmp/opencode/guitar-adapters-effective-tempo');
await mkdir(root, { recursive: true });
const observations: object[] = [];
const ticks = (score: ScoreV1) => score.performedSounds.map(p => ({ id: p.id, soundId: p.soundId, start: p.start, duration: p.duration }));
const halfSpeed = async (score: ScoreV1) => {
  score.revision.parentId = score.revision.id; score.revision.id += '-half';
  score.preferences.tempoScale = 0.5;
  for (const occurrence of score.occurrences) occurrence.entryQuarterBpm *= 0.5;
  for (const tempo of score.performedTempos) tempo.quarterBpm *= 0.5;
  await stamp(score);
};
async function runCase(name: string, source: Awaited<ReturnType<typeof study>>['source'], score: ScoreV1, expectedBpms: number[], expectedSeconds: number, runtimeSeconds: number) {
  const dir = path.join(root, name); await mkdir(dir, { recursive: true });
  const validation = validator.validate(source, score, { approvedRevisions: [] });
  await writeFile(path.join(dir, 'source.json'), JSON.stringify(source, null, 2));
  await writeFile(path.join(dir, 'score.json'), JSON.stringify(score, null, 2));
  await writeFile(path.join(dir, 'validation.json'), JSON.stringify(validation, null, 2));
  assert.equal(validation.status, 'passed', JSON.stringify(validation));
  assert.equal(validation.validatorVersion, 'independent-guitar-validator-2-role-order-v1');
  if (validation.status !== 'passed') throw new Error('Validator rejected regression');
  let calls = 0;
  const adapter = createScoreAdapter({ validator: { validate: (...args) => { calls++; return validator.validate(...args); } }, getValidationContext: () => ({ approvedRevisions: [] }) });
  const draft = { status: 'validatedDraft' as const, score, validation };
  const before = ticks(score);
  const midi = await adapter.exportArtifact(source, draft, 'midi'), pdf = await adapter.exportArtifact(source, draft, 'pdf');
  for (const artifact of [midi, pdf]) assert.equal(artifact.manifest.validationVersion, validation.validatorVersion, 'Actual export manifest must retain the current independent validation version');
  await writeFile(path.join(dir, 'score.mid'), midi.bytes); await writeFile(path.join(dir, 'score.pdf'), pdf.bytes);
  await writeFile(path.join(dir, 'midi-manifest.json'), JSON.stringify(midi.manifest, null, 2));
  await writeFile(path.join(dir, 'pdf-manifest.json'), JSON.stringify(pdf.manifest, null, 2));
  const parsed = parseMidi(midi.bytes), tone = new Midi(midi.bytes);
  const tempos: { tick: number; micros: number }[] = [];
  let tick = 0;
  for (const event of parsed.tracks[0]!) { tick += event.deltaTime; if (event.type === 'setTempo') tempos.push({ tick, micros: event.microsecondsPerBeat }); }
  const expectedTempos = score.performedTempos.map((t, i) => ({ tick: t.start.n * 960 / t.start.d, micros: Math.floor(60000000 / expectedBpms[i]!) }));
  const task = getDocument({ data: new Uint8Array(pdf.bytes), standardFontDataUrl: new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).pathname });
  let text = '';
  try { const document = await task.promise; for (let page = 1; page <= document.numPages; page++) text += (await (await document.getPage(page)).getTextContent()).items.filter((i): i is Extract<typeof i, { str: string }> => 'str' in i).map(i => i.str).join(' '); }
  finally { await task.destroy(); }
  const captions = [...text.matchAll(/=\s*(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]));
  const audioContext = new FakeAudioContext(), audio = createPlaybackController(score, audioContext.options());
  const initial = audio.getSnapshot(); await audio.play();
  audioContext.advance(2.25); const position = audio.getSnapshot().positionQuarter;
  audio.setTempoScale(0.75); const changed = audio.getSnapshot(); const metrics = audio.getMetrics();
  const observation = { name, validatorVersion: validation.validatorVersion, validatorCalls: calls, revisionScale: 0.5, canonicalBpms: score.performedTempos.map(t => t.quarterBpm), expectedBpms, expectedSeconds, actualMidiSeconds: tone.duration, actualAudioSeconds: initial.durationSeconds, runtimeRequestedScale: 0.75, expectedRuntimeSeconds: runtimeSeconds, actualRuntimeSeconds: changed.durationSeconds, quarterBeforeRuntimeChange: position, quarterAfterRuntimeChange: changed.positionQuarter, tempos, expectedTempos, pdfTempoCaptions: captions, scheduledEvents: metrics.scheduleLog, unchangedCanonicalTicks: JSON.stringify(before) === JSON.stringify(ticks(score)) };
  observations.push(observation);
  await writeFile(path.join(dir, 'observation.json'), JSON.stringify(observation, null, 2));
  await audio.dispose();
  assert.deepEqual(tempos, expectedTempos, 'MIDI consumes canonical effective BPM exactly once');
  assert(Math.abs(tone.duration - expectedSeconds) < 0.00001, 'MIDI seconds mismatch');
  assert.equal(initial.durationSeconds, expectedSeconds, 'Initial WebAudio consumes canonical effective BPM directly');
  assert(Math.abs(changed.durationSeconds - runtimeSeconds) < 0.00001, 'Absolute runtime scale must use requested/revision ratio');
  assert.equal(position, changed.positionQuarter, 'Tempo change preserves quarter');
  assert.deepEqual(captions, expectedBpms, 'Actual PDF metronome captions must equal effective canonical BPM');
  assert.deepEqual(ticks(score), before, 'Canonical note ticks unchanged');
  assert.equal(calls, 2, 'Each actual artifact request reruns real validation');
  const expectedIntervals = score.performedSounds.map(p => { const sound = score.sounds.find(s => s.id === p.soundId)!; return `${sound.role}/${sound.soundingMidi}/${p.start.n * 960 / p.start.d}/${p.duration.n * 960 / p.duration.d}`; }).sort();
  const actualIntervals = tone.tracks.flatMap(track => track.notes.map(note => `${track.name}/${note.midi}/${note.ticks}/${note.durationTicks}`)).sort();
  assert.deepEqual(actualIntervals, expectedIntervals, 'Same complete sounding role/pitch/tick union at non-unit tempo');
  const native = createAlphaTabScore(score); assert.equal(native.projection.playback.events.length, score.performedSounds.length);
}

try {
  const fixture = await study();
  const invalid = structuredClone(fixture.score); invalid.preferences.tempoScale = 0.5; await stamp(invalid);
  const invalidReport = validator.validate(fixture.source, invalid, { approvedRevisions: [] });
  assert.equal(invalidReport.status, 'failed', 'Old preference-only scaled fixture was NOT a valid canonical revision');
  await writeFile(path.join(root, 'old-invalid-scaled-fixture-report.json'), JSON.stringify(invalidReport, null, 2));
  await halfSpeed(fixture.score);
  await runCase('constant-80-at-half', fixture.source, fixture.score, [40, 40], 12, 8);

  const repeat = await study(2);
  repeat.source.tempos.push({ id: 'tempo-120', barId: 'b2', offset: { n: 0, d: 1 }, quarterBpm: 120 });
  repeat.source.manifest.identity = { kind: 'original-fixture', name: 'Two-bar effective-tempo repeat restoration regression', author: 'Guitar composition project' };
  const raw = new TextEncoder().encode(JSON.stringify({ parts: repeat.source.parts, bars: repeat.source.bars, tempos: repeat.source.tempos, form: repeat.source.form, events: repeat.source.events }));
  repeat.source.manifest.artifacts = [{ id: 'tempo-restoration-raw', sha256: createHash('sha256').update(raw).digest('hex'), byteLength: raw.byteLength, mediaType: 'application/json' }];
  await stamp(repeat.source); repeat.score.source = { revision: { id: repeat.source.revision.id, digest: repeat.source.revision.digest }, manifest: structuredClone(repeat.source.manifest) };
  repeat.score.selection.sourceRevision = { ...repeat.score.source.revision }; repeat.score.tempos = structuredClone(repeat.source.tempos);
  for (const [i, occurrence] of repeat.score.occurrences.entries()) {
    occurrence.entryQuarterBpm = i % 2 === 0 ? 80 : 120;
    repeat.score.performedTempos[i]!.quarterBpm = occurrence.entryQuarterBpm; repeat.score.performedTempos[i]!.sourceTempoId = i % 2 === 0 ? 't80' : 'tempo-120';
  }
  await halfSpeed(repeat.score);
  await writeFile(path.join(root, 'repeat-source-raw.json'), raw);
  await runCase('repeat-entry-restoration', repeat.source, repeat.score, [40, 60, 40, 60], 20, 40 / 3);
  const clock = createTempoClock(compileTimeline(repeat.score));
  assert.equal(clock.toSeconds(8), 10); assert.equal(clock.toSeconds(12), 16, 'Jump restores 40, not carried 60 BPM');
  await writeFile(path.join(root, 'result.json'), JSON.stringify({ status: 'passed', validatorPath, observations }, null, 2));
  console.log(JSON.stringify({ status: 'passed', root, validatorPath, observations }, null, 2));
} catch (cause) {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  await writeFile(path.join(root, 'result.json'), JSON.stringify({ status: 'failed', validatorPath, error: error.message, stack: error.stack, observations }, null, 2));
  throw error;
}

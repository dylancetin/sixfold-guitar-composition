import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { parseMidi, writeMidi } from 'midi-file';
import { add, q } from '../../src/domain';
import { compileTimeline, createAlphaTabScore, createPlaybackController, createTempoClock } from '../../src/adapters';
import { createScoreAdapter } from '../../src/adapters/server';
import { encodeMidi } from '../../src/adapters/midi';
import { PdfLayoutSettingsSchema } from '../../src/adapters/pdf-settings';
import { checkMidi, checkPdf } from './artifact-oracle';
import { envelope, oracleValidator, stamp, study } from './fixture';
import { FakeAudioContext } from './fake-audio';

describe('canonical notation and runtime export boundary', () => {
  test('stable JSON IDs, exact triplets/crossbar tie, one combined staff/TAB; no repeat commands', async () => {
    const { score } = await study(3);
    const first = createAlphaTabScore(score, { notationMode: 'unfolded' }), second = createAlphaTabScore(score, { notationMode: 'unfolded' });
    expect(first.projection).toEqual(second.projection);
    expect(JSON.parse(JSON.stringify(first.projection))).toEqual(first.projection);
    expect(first.projection.playback.events).toHaveLength(27);
    expect(first.projection.mapping).toHaveLength(33);
    expect(first.placements.filter(p => p.tieDestination)).toHaveLength(3);
    expect(first.placements.every(p => p.writtenMidi === p.soundingMidi + 12)).toBe(true);
    const layout = await first.renderSvg();
    expect(layout.systems.flatMap(s => s.bars)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(layout.beats.every(b => b.bounds.w > 0)).toBe(true);
  });

  test('same sounding source at capo 0/2; frets relative and no extra MIDI offset', async () => {
    const a = await study(2, 0, 2), b = await study(2, 2, 2);
    const na = createAlphaTabScore(a.score), nb = createAlphaTabScore(b.score);
    expect(na.placements.map(p => p.soundingMidi)).toEqual(nb.placements.map(p => p.soundingMidi));
    expect(na.placements[0]?.relativeFret).toBe(2); expect(nb.placements[0]?.relativeFret).toBe(0);
    for (const fixture of [a, b]) {
      const validator = oracleValidator(2, 2), adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }) });
      const artifact = await adapter.exportArtifact(fixture.source, envelope(fixture.source, fixture.score, validator), 'midi');
      expect(checkMidi(artifact.bytes, 2, 2).attacks).toBe(18);
      expect(artifact.manifest.notationSegmentCount).toBe(22);
      expect(artifact.manifest.review).toBe('unreviewed-draft');
      expect(createHash('sha256').update(artifact.bytes).digest('hex')).toBe(artifact.manifest.artifactDigest);
      expect(artifact.filename).toContain(fixture.score.revision.digest.slice(0, 12));
    }
  });

  test('absolute TAB changes displayed frets without changing pitch, ties, timing or canonical score', async () => {
    for (const capo of [0, 2] as const) {
      const { score } = await study(2, capo, 2);
      const original = JSON.stringify(score);
      const relative = createAlphaTabScore(score, { notationMode: 'unfolded' }), absolute = createAlphaTabScore(score, { fretMode: 'absolute', notationMode: 'unfolded' });
      expect(absolute.projection).toEqual(relative.projection);
      expect(absolute.placements).toEqual(relative.placements.map(p => ({ ...p, displayedFret: p.relativeFret + capo })));
      expect(absolute.placements[0]?.displayedFret).toBe(2);
      const layout = await absolute.renderSvg();
      expect(layout.fragments.map(f => f.svg).join('')).toContain('absolute neck frets');
      expect(layout.systems.flatMap(s => s.bars)).toEqual([0, 1, 2, 3]);
      expect(JSON.stringify(score)).toBe(original);
    }
  });

  test('preview spacing and bars per row reduce layout height without changing musical projection', async () => {
    const { score } = await study(4, 2, 2);
    const original = JSON.stringify(score);
    const normal = createAlphaTabScore(score, { notationMode: 'unfolded' });
    let height = (await normal.renderSvg()).height;
    for (const spacing of ['compact', 'tight'] as const) {
      const notation = createAlphaTabScore(score, { spacing, notationMode: 'unfolded' });
      expect(notation.projection).toEqual(normal.projection);
      expect(notation.placements).toEqual(normal.placements);
      const layout = await notation.renderSvg();
      expect(layout.height).toBeLessThan(height); height = layout.height;
      expect(layout.systems.flatMap(s => s.bars)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    }
    for (const barsPerRow of [3, 4]) {
      const notation = createAlphaTabScore(score, { spacing: 'tight', barsPerRow, notationMode: 'unfolded' });
      expect(notation.projection).toEqual(normal.projection);
      const layout = await notation.renderSvg(1000);
      expect(layout.systems.map(s => s.bars.length)).toEqual(barsPerRow === 3 ? [3, 3, 2] : [4, 4]);
      expect(layout.height).toBeLessThan(height);
    }
    expect(JSON.stringify(score)).toBe(original);
  });

  test('shorter exact eighth triplets and overlapping independent harmony durations are not flattened', async () => {
    const { score } = await study();
    for (const [id, start] of [['m1', q(1)], ['m2', q(4, 3)], ['m3', q(5, 3)]] as const) {
      const sound = score.sounds.find(s => s.id === id)!; sound.start = start; sound.duration = q(1, 3);
      const performed = score.performedSounds.find(p => p.soundId === id)!; performed.start = start; performed.duration = q(1, 3);
      const segment = score.notation.find(n => n.eventId === id)!; segment.start = start; segment.duration = q(1, 3); segment.baseDenominator = 8;
    }
    score.rests.push({ id: 'short-triplet-rest', role: 'melody', voiceId: 'melody', start: q(2), duration: q(1), provenance: { kind: 'intentional', selectionRestId: 'test-gap' } });
    score.notation.push({ id: 'short-triplet-rest-segment', eventId: 'short-triplet-rest', kind: 'rest', barId: 'b1', voiceId: 'melody', start: q(2), duration: q(1), baseDenominator: 4, dots: 0, tuplet: null, tie: 'none' });
    score.sounds.push({ id: 'independent-harmony', role: 'harmony', voiceId: 'harmony', start: q(1), duration: q(4), soundingMidi: 50, spelling: { step: 'D', alter: 0, octave: 3 }, provenance: { kind: 'generated', strategyVersion: 'test', evidenceEventIds: ['src-h0'], reason: 'Independent overlapping duration regression' } });
    score.placements.push({ id: 'independent-placement', soundId: 'independent-harmony', stringIndex: 2, fret: 0, finger: 0 });
    score.performedSounds.push({ id: 'independent-harmony@o1-p1', soundId: 'independent-harmony', attackOccurrenceId: 'o1-p1', occurrenceIds: ['o1-p1', 'o2-p1'], start: q(1), duration: q(4), placementId: 'independent-placement' });
    score.notation.push({ id: 'independent-a', eventId: 'independent-harmony', kind: 'note', barId: 'b1', voiceId: 'harmony', start: q(1), duration: q(3), baseDenominator: 2, dots: 1, tuplet: null, tie: 'start' }, { id: 'independent-b', eventId: 'independent-harmony', kind: 'note', barId: 'b2', voiceId: 'harmony', start: q(4), duration: q(1), baseDenominator: 4, dots: 0, tuplet: null, tie: 'end' });
    const notation = createAlphaTabScore(score); await notation.renderSvg();
    expect(notation.projection.playback.events).toHaveLength(10); expect(notation.placements.filter(p => p.tieDestination)).toHaveLength(2);
    // Test the MIDI encoder directly, NOT a fake-authorized export of this deliberately modified fixture.
    const parsed = parseMidi(encodeMidi(compileTimeline(score))), harmony = parsed.tracks[3]!;
    let tick = 0; const independent: { type: string; tick: number }[] = [];
    for (const event of harmony) { tick += event.deltaTime; if ((event.type === 'noteOn' || event.type === 'noteOff') && event.noteNumber === 50) independent.push({ type: event.type, tick }); }
    expect(independent).toEqual([{ type: 'noteOn', tick: 960 }, { type: 'noteOff', tick: 4800 }]);
  });

  test('each download invokes actual injected validator; forged passing envelope cannot authorize omission', async () => {
    const { source, score } = await study();
    const validator = oracleValidator(1, 0), adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }) });
    const forged = envelope(source, score, validator);
    await adapter.exportArtifact(source, forged, 'midi'); await adapter.exportArtifact(source, forged, 'midi');
    expect(validator.calls).toBe(3);
    const changed = structuredClone(forged);
    changed.score.performedSounds = changed.score.performedSounds.filter(p => p.soundId !== 'm4');
    await stamp(changed.score); // valid NEW digest, but wrong music and copied passing envelope
    await expect(adapter.exportArtifact(source, changed, 'midi')).rejects.toMatchObject({ code: 'validation-failed' });
    expect(validator.calls).toBe(4);
  });

  test('stale digests, context/report drift, wrong capo, unsupported timing and cancellation reject', async () => {
    const { source, score } = await study(); const validator = oracleValidator(1, 0);
    const adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }) });
    const draft = envelope(source, score, validator), stale = structuredClone(draft);
    stale.score.instrument.capo = 2;
    await expect(adapter.exportArtifact(source, stale, 'midi')).rejects.toMatchObject({ code: 'revision-stale' });
    const otherSource = structuredClone(source); otherSource.manifest.parser.version = 'other-parser'; await stamp(otherSource);
    await expect(adapter.exportArtifact(otherSource, draft, 'midi')).rejects.toMatchObject({ code: 'revision-stale' });
    const wrong = structuredClone(score); wrong.instrument.capo = 2;
    expect(() => createAlphaTabScore(wrong)).toThrow('Wrong capo');
    const timing = structuredClone(score); const n = timing.notation.find(n => n.id === 'n1')!;
    n.duration = q(4, 7); n.tuplet = { groupId: 'seven', actual: 7, normal: 4, index: 0 };
    timing.sounds.find(s => s.id === n.eventId)!.duration = q(4, 7);
    expect(() => createAlphaTabScore(timing)).toThrow(/rounding/);
    const aborted = new AbortController(); aborted.abort();
    await expect(adapter.exportArtifact(source, draft, 'pdf', aborted.signal)).rejects.toThrow();
    const drift = createScoreAdapter({ validator: { validate: () => ({ ...draft.validation, scoreRevision: { ...score.revision, id: 'wrong' } }) }, getValidationContext: () => ({ approvedRevisions: [] }) });
    await expect(drift.exportArtifact(source, draft, 'midi')).rejects.toThrow();
    const corruptApproval = structuredClone(score); corruptApproval.preferences.tempoScale = 0.75;
    const contextDrift = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [corruptApproval] }) });
    await expect(contextDrift.exportArtifact(source, draft, 'midi')).rejects.toMatchObject({ code: 'revision-stale' });
    let head = score.revision.digest, checks = 0;
    const current = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }), assertCurrentRevision: ref => { checks++; if (ref.digest !== head) throw new Error('head changed'); head = 'changed'; } });
    await expect(current.exportArtifact(source, draft, 'midi')).rejects.toThrow('head changed'); expect(checks).toBe(2);
  });

  test('actual SMF corruption controls: last note omitted, octave shift and unbalanced note-off', async () => {
    const { source, score } = await study(); const validator = oracleValidator(1, 0);
    const adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }) });
    const { bytes } = await adapter.exportArtifact(source, envelope(source, score, validator), 'midi');
    expect(checkMidi(bytes, 1, 0).finalTick).toBe(7680);
    const missing = parseMidi(bytes);
    // Preserve absolute time while removing the actual final bass pair (last sounding note-off).
    const bass = missing.tracks[2]!;
    for (let i = bass.length - 1; i >= 0; i--) {
      const event = bass[i]!;
      if ((event.type === 'noteOn' || event.type === 'noteOff') && event.noteNumber === 43) { bass[i + 1]!.deltaTime += event.deltaTime; bass.splice(i, 1); }
    }
    expect(() => checkMidi(new Uint8Array(writeMidi(missing)), 1, 0)).toThrow('union mismatch');
    const octave = parseMidi(bytes);
    for (const track of octave.tracks) for (const event of track) if (event.type === 'noteOn' || event.type === 'noteOff') event.noteNumber += 12;
    expect(() => checkMidi(new Uint8Array(writeMidi(octave)), 1, 0)).toThrow('union mismatch');
    const unmatched = parseMidi(bytes);
    const off = unmatched.tracks[1]!.find(e => e.type === 'noteOff')!; if (off.type === 'noteOff') off.noteNumber++;
    expect(() => checkMidi(new Uint8Array(writeMidi(unmatched)), 1, 0)).toThrow('unmatched');
  });

  test('MIDI consumes materialized effective BPM without scaling it again or changing sounding notes/ticks', async () => {
    const { source, score } = await study(2, 2, 2); score.preferences.tempoScale = 0.9;
    for (const occurrence of score.occurrences) occurrence.entryQuarterBpm = 72;
    for (const tempo of score.performedTempos) tempo.quarterBpm = 72;
    await stamp(score);
    const validator = oracleValidator(2, 2), adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }) });
    const artifact = await adapter.exportArtifact(source, envelope(source, score, validator), 'midi');
    expect(checkMidi(artifact.bytes, 2, 2, 0.9).finalTick).toBe(15360);
  });

  test('actual multipage A4/Letter PDF: embedded font, all occurrences, guitar octave, staff/TAB raster', async () => {
    const { source, score } = await study(12, 2, 2); const validator = oracleValidator(12, 2);
    const draft = envelope(source, score, validator);
    for (const pdfPageSize of ['A4', 'LETTER'] as const) {
      const adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }), pdfPageSize, notationMode: 'unfolded', pdfLayout: PdfLayoutSettingsSchema.parse({ showMeasureLabels: true }) });
      const artifact = await adapter.exportArtifact(source, draft, 'pdf');
      const result = await checkPdf(artifact.bytes, 12, 2);
      expect(result.pageCount).toBeGreaterThan(1); expect(result.pages.every(p => p.lineCoverage >= 2 / 3)).toBe(true);
    }
  }, 30000);
});

describe('canonical audio clock / sampled acoustic guitar controller', () => {
  test('60 seconds and 20 loops use audio time; no accumulated loop/cursor drift or duplicate tie attack', async () => {
    const { score } = await study(); const ctx = new FakeAudioContext();
    const audio = createPlaybackController(score, ctx.options());
    expect(audio.getSnapshot().readiness).toBe('needs-gesture');
    audio.setLoop({ startQuarter: 0, endQuarter: 8 }); await audio.play();
    ctx.advance(60);
    expect(audio.getSnapshot().positionQuarter).toBeCloseTo(0, 7);
    expect(audio.getMetrics().loopCount).toBe(10);
    ctx.advance(60.02);
    const metrics = audio.getMetrics();
    expect(metrics.loopCount).toBe(20); expect(metrics.maxScheduleLatenessMs).toBeLessThan(0.001);
    const ties = metrics.scheduleLog.filter(r => r.performedSoundId.startsWith('m4@'));
    expect(new Set(ties.map(r => r.cycle)).size).toBe(ties.length);
    for (const record of metrics.scheduleLog) {
      const onset = record.performedSoundId.startsWith('m4@') ? 2.25 : null;
      if (onset !== null) expect(record.expectedAudioTime).toBeCloseTo(record.cycle * 6 + onset, 9);
    }
    expect(metrics.scheduledKeyCount).toBeLessThan(30);
    audio.seek(4.5); expect(audio.getSnapshot().activePerformedSoundIds).toContain('m4@o1-p1');
    expect(audio.getSnapshot().activeSegments.some(s => s.segmentId === 'n4b')).toBe(true);
    await audio.dispose();
  });

  test('role mute/solo acts on one audio union, seek resumes sustain; tempo preserves quarter; pause/stop cancel queue', async () => {
    const { score } = await study(); const ctx = new FakeAudioContext(); const audio = createPlaybackController(score, ctx.options());
    await audio.play(); expect(ctx.bufferSources).toHaveLength(3); expect(ctx.oscillators).toHaveLength(0);
    expect(audio.getSnapshot().tone).toBe('sampled-acoustic-guitar');
    audio.setMuted('bass', true); expect(audio.getSnapshot().audiblePerformedSoundIds).not.toContain('bass0@o1-p1'); expect(ctx.gains[1]!.gain.value).toBe(0);
    audio.setSolo('melody', true); expect(audio.getSnapshot().audiblePerformedSoundIds).toEqual(['m0@o1-p1']); expect(ctx.gains[2]!.gain.value).toBe(0);
    ctx.advance(1); const quarter = audio.getSnapshot().positionQuarter;
    audio.setTempoScale(0.5); expect(audio.getSnapshot().positionQuarter).toBeCloseTo(quarter, 10);
    expect(audio.getSnapshot().durationSeconds).toBe(12);
    audio.seek(4.5); const records = audio.getMetrics().scheduleLog.filter(r => r.performedSoundId === 'm4@o1-p1');
    expect(records.at(-1)!.elapsedSeconds).toBeCloseTo(2.25, 8);
    audio.pause(); const paused = audio.getSnapshot().positionQuarter; expect(audio.getMetrics().activeSourceCount).toBe(0);
    expect(ctx.bufferSources.every(n => n.disconnected)).toBe(true);
    ctx.advance(2); expect(audio.getSnapshot().positionQuarter).toBe(paused);
    await audio.play(); audio.stop(); expect(audio.getSnapshot().positionQuarter).toBe(0); expect(audio.getMetrics().activeSourceCount).toBe(0);
    await audio.play(); audio.seek(8); expect(audio.getSnapshot().state).toBe('ended'); expect(audio.getSnapshot().positionQuarter).toBe(8);
    await audio.dispose(); expect(audio.getSnapshot().state).toBe('disposed');
  });

  test('pending gesture resume cannot resurrect playback after stop', async () => {
    const { score } = await study(); const ctx = new FakeAudioContext(); let release!: () => void;
    ctx.resumePromise = new Promise<void>(resolve => { release = resolve; });
    const audio = createPlaybackController(score, ctx.options());
    const pending = audio.play(); audio.stop(); release(); await pending;
    expect(audio.getSnapshot().state).not.toBe('playing'); expect(ctx.bufferSources).toHaveLength(0);
    await audio.dispose();
  });

  test('tempo map boundary restores instead of carrying old BPM; tempo multiplier is applied once', async () => {
    const { score } = await study(3); // direct canonical clock fixture: entries 80/120/80...
    score.performedTempos[1]!.quarterBpm = 120; score.occurrences[1]!.entryQuarterBpm = 120;
    const timeline = compileTimeline(score), clock = createTempoClock(timeline);
    expect(clock.toSeconds(4)).toBe(3); expect(clock.toSeconds(8)).toBe(5); expect(clock.toSeconds(12)).toBe(8);
    expect(createTempoClock(timeline, 0.5).toSeconds(12)).toBe(16);
    expect(clock.toQuarter(8)).toBe(12);
  });

  test('cross-jump ties are explicitly rejected', async () => {
    const { score } = await study(2); score.occurrences[1]!.entry = 'repeat-jump';
    expect(() => compileTimeline(score)).toThrow('Tie crosses a form jump');
    // Same absolute start does not license a second performance expansion.
    score.occurrences[2]!.start = add(score.occurrences[2]!.start, q(1));
    expect(() => compileTimeline(score)).toThrow();
  });
});

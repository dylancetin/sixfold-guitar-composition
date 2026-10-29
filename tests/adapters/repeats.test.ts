import { expect, test } from 'bun:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { AdapterProjectionSchema, q } from '../../src/domain';
import { compileTimeline, createAlphaTabScore, createTempoClock } from '../../src/adapters';
import { encodeMidi } from '../../src/adapters/midi';
import { createScoreAdapter } from '../../src/adapters/server';
import { checkMidi } from './artifact-oracle';
import { envelope, oracleValidator, stamp, study } from './fixture';
import { guitarEngine } from '../../src/engine';
import { literalPlanner, oneBarStudy } from '../engine/studies';
import { parseMidi } from 'midi-file';

test('lossless four-pass engraving has real repeat glyphs, all performed aliases and unchanged MIDI', async () => {
  const { source, score } = await study(4);
  const before = JSON.stringify(score), midi = encodeMidi(compileTimeline(score));
  const folded = createAlphaTabScore(score, { showMeasureLabels: true }), unfolded = createAlphaTabScore(score, { notationMode: 'unfolded' });
  expect(folded.projection.schemaVersion).toBe(2);
  expect(folded.projection.form).toBe('folded-linear-repeats');
  if (folded.projection.schemaVersion !== 2) throw new Error('Expected folded projection');
  expect(folded.projection.engraving.bars.map(b => [b.label, b.occurrenceIds, b.displayStart])).toEqual([
    ['S1', ['o1-p1', 'o1-p2', 'o1-p3', 'o1-p4'], { n: 0, d: 1 }],
    ['S2', ['o2-p1', 'o2-p2', 'o2-p3', 'o2-p4'], { n: 4, d: 1 }],
  ]);
  expect(folded.projection.engraving.repeats).toEqual(score.form.repeats);
  expect(folded.projection.mapping).toHaveLength(44);
  expect(folded.projection.playback.events).toEqual(unfolded.projection.playback.events);
  expect(folded.placements.filter(p => p.tieDestination)).toHaveLength(1);
  expect(AdapterProjectionSchema.parse(unfolded.projection).schemaVersion).toBe(1);
  const layout = await folded.renderSvg();
  expect(layout.systems.flatMap(s => s.bars)).toEqual([0, 1]);
  for (const mapping of folded.projection.mapping) {
    const aliases = layout.beats.filter(b => b.nativeBeatId === mapping.nativeBeatId);
    expect(aliases.some(b => b.occurrenceId === mapping.occurrenceId)).toBe(true);
    expect(aliases.every(b => JSON.stringify(b.bounds) === JSON.stringify(aliases[0]!.bounds))).toBe(true);
  }
  const svg = layout.fragments.map(f => f.svg).join('');
  expect(svg.match(/&#57412;/g)).toHaveLength(8);
  expect([...svg.matchAll(/> = (\d+)<\/text>/g)].map(m => Number(m[1]))).toEqual([80]);
  expect(svg).toContain('x4'); expect(svg).not.toContain('FINAL'); expect(svg).not.toContain('/P1');
  const validator = oracleValidator(4, 0), adapter = createScoreAdapter({ validator, getValidationContext: () => ({ approvedRevisions: [] }) });
  const draft = envelope(source, score, validator);
  const pdf = await adapter.exportArtifact(source, draft, 'pdf');
  expect(pdf.manifest.notationSegmentCount).toBe(44);
  expect((await adapter.project(draft)).mapping).toHaveLength(44);
  const task = getDocument({ data: new Uint8Array(pdf.bytes), useSystemFonts: true });
  try {
    const document = await task.promise;
    let text = '';
    for (let page = 1; page <= document.numPages; page++) text += (await (await document.getPage(page)).getTextContent()).items.map(i => 'str' in i ? i.str : '').join(' ');
    expect(text.split(String.fromCodePoint(57412)).length - 1).toBe(8);
    expect(text).toContain('x4'); expect(text).not.toContain('S='); expect(text).not.toContain('P=pass');
    expect(text).not.toMatch(/\bo[12]-p\d+\/S|\bS[12]\b/);
  } finally { await task.destroy(); }
  expect(checkMidi((await adapter.exportArtifact(source, draft, 'midi')).bytes, 4, 0).attacks).toBe(36);
  expect(encodeMidi(compileTimeline(score))).toEqual(midi);
  expect(JSON.stringify(score)).toBe(before);
});

test('folded engraving shows inherited repeat-entry restoration but suppresses redundant bar tempos', async () => {
  const fixture = oneBarStudy([['first', 0, 0, 4, 65], ['repeat-entry', 0, 4, 4, 64], ['repeat-end', 0, 8, 4, 67]]);
  fixture.source.bars = Array.from({ length: 3 }, (_, i) => ({ id: `b${i + 1}`, number: i + 1, start: q(i * 4), length: q(4), meter: { beats: 4, beatUnit: 4 }, kind: 'full' }));
  fixture.source.form.repeats = [{ id: 'r', fromBarId: 'b2', toBarId: 'b3', totalPasses: 2 }];
  fixture.source.tempos = [{ id: 't80', barId: 'b1', offset: q(0), quarterBpm: 80 }, { id: 't120', barId: 'b3', offset: q(0), quarterBpm: 120 }];
  await stamp(fixture.source);
  fixture.request.sourceRevision.digest = fixture.source.revision.digest;
  fixture.request.selection.sourceRevision.digest = fixture.source.revision.digest;
  fixture.request.selection.sections[0]!.end = q(12);
  const result = guitarEngine.arrange(fixture.source, fixture.request, fixture.plan, literalPlanner);
  if (result.status !== 'candidate') throw new Error(JSON.stringify(result));
  const timeline = compileTimeline(result.score), before = encodeMidi(timeline);
  const notation = createAlphaTabScore(result.score);
  expect(notation.projection.form).toBe('folded-linear-repeats');
  const svg = (await notation.renderSvg()).fragments.map(f => f.svg).join('');
  expect([...svg.matchAll(/> = (\d+)<\/text>/g)].map(m => Number(m[1]))).toEqual([80, 80, 120]);
  expect(svg).not.toMatch(/\/S\d+\/P|>S\d+</);
  expect(notation.projection.playback.events).toHaveLength(5);
  expect(createTempoClock(timeline).durationSeconds).toBe(13);
  let tick = 0;
  const tempos = parseMidi(before).tracks[0]!.flatMap(event => {
    tick += event.deltaTime;
    return event.type === 'setTempo' ? [{ tick, bpm: Math.round(60000000 / event.microsecondsPerBeat) }] : [];
  });
  expect(tempos).toEqual([{ tick: 0, bpm: 80 }, { tick: 3840, bpm: 80 }, { tick: 7680, bpm: 120 }, { tick: 11520, bpm: 80 }, { tick: 15360, bpm: 120 }]);
  expect(encodeMidi(compileTimeline(result.score))).toEqual(before);
});

test('different continuation fingering, string placement or relative effective tempo explicitly unfolds', async () => {
  for (const difference of ['finger', 'string', 'tempo'] as const) {
    const { score } = await study(2);
    if (difference === 'tempo') {
      score.occurrences[2]!.entryQuarterBpm = 90; score.performedTempos[2]!.quarterBpm = 90;
    } else {
      const performed = score.performedSounds.find(p => p.soundId === (difference === 'finger' ? 'm4' : 'm1') && p.attackOccurrenceId === 'o1-p2')!;
      const placement = { ...score.placements.find(p => p.id === performed.placementId)!, id: 'pass-specific' };
      if (difference === 'finger') placement.finger = 4;
      else { placement.stringIndex = 4; placement.fret = 8; placement.finger = 4; }
      score.placements.push(placement); performed.placementId = placement.id;
    }
    const notation = createAlphaTabScore(score, { showFingerNumbers: false });
    expect(notation.projection.schemaVersion).toBe(1);
    if (notation.projection.schemaVersion !== 1) throw new Error('Expected unfolded fallback');
    expect(notation.projection.unfoldedReason).toContain('differ');
    expect(notation.projection.mapping).toHaveLength(22);
    const layout = await notation.renderSvg();
    expect(layout.systems.flatMap(s => s.bars)).toEqual([0, 1, 2, 3]);
    const svg = layout.fragments.map(f => f.svg).join('');
    expect(svg).toContain('unfolded'); expect(svg).not.toContain('&#57412;');
  }
});

test('invalid repeat form or performed data rejects instead of becoming an unfolded fallback', async () => {
  const { score } = await study(2);
  score.form.repeats[0]!.totalPasses = 4;
  expect(() => createAlphaTabScore(score)).toThrow(/occurrence|schedule/i);
  score.form.repeats[0]!.totalPasses = 2;
  score.form.repeats.push({ ...score.form.repeats[0]!, id: 'overlap' });
  expect(() => createAlphaTabScore(score)).toThrow(/overlap|nested/i);
  score.form.repeats.pop(); score.performedSounds.pop();
  expect(() => createAlphaTabScore(score)).toThrow(/performed segment/);
});

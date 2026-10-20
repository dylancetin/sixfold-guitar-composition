import { expect, test } from 'bun:test';
import * as at from '@coderline/alphatab';
import { createAlphaTabScore } from '../../src/adapters';
import { gapStudy } from './gap-fixture';

test('five-halves gap: old three-dot triplet is 1280, lossless generated rests total 2400 ticks', async () => {
  // Independent pinned-native negative control, not the adapter's expected-duration computation.
  const oldVoice = new at.model.Voice(), old = new at.model.Beat();
  old.duration = 2; old.dots = 3; old.tupletNumerator = 3; old.tupletDenominator = 2;
  oldVoice.addBeat(old); old.updateDurations();
  expect(old.playbackDuration).toBe(1280); expect(old.playbackDuration).not.toBe(2400);

  const { score } = await gapStudy();
  const unchanged = JSON.stringify(score);
  // Observation-only native capture; no native model escapes production adapters or enters persistence.
  const finish = at.model.Score.prototype.finish;
  let captured: InstanceType<typeof at.model.Score> | undefined;
  at.model.Score.prototype.finish = function(settings) { finish.call(this, settings); captured = this; };
  let notation: ReturnType<typeof createAlphaTabScore>;
  try { notation = createAlphaTabScore(score); } finally { at.model.Score.prototype.finish = finish; }
  expect(captured).toBeDefined();
  const bass = captured!.tracks[0]!.staves[0]!.bars[0]!.voices[1]!;
  expect(bass.beats.map(b => ({ start: b.playbackStart, duration: b.playbackDuration, rest: b.isRest }))).toEqual([
    { start: 0, duration: 1440, rest: false },
    { start: 1440, duration: 1920, rest: true },
    { start: 3360, duration: 480, rest: true },
  ]);
  expect(bass.beats.filter(b => b.isRest).reduce((sum, b) => sum + b.playbackDuration, 0)).toBe(2400);
  expect(bass.beats.every(b => b.dots <= 2 && !b.hasTuplet)).toBe(true);
  expect(notation.projection.mapping).toHaveLength(11);
  expect(notation.projection.playback.events).toHaveLength(9);
  const mapping = notation.projection.mapping.find(m => m.segmentId === 'nb0')!;
  expect(mapping.nativeBeatId).toBe(String(bass.beats[0]!.id));
  const bassEvent = notation.projection.playback.events.find(e => e.soundId === 'bass0')!;
  expect(bassEvent.start).toEqual({ n: 0, d: 1 }); expect(bassEvent.duration).toEqual({ n: 3, d: 2 });
  const layout = await notation.renderSvg();
  expect(layout.beats.some(b => b.nativeBeatId === mapping.nativeBeatId)).toBe(true);
  expect(JSON.stringify(score)).toBe(unchanged);
});

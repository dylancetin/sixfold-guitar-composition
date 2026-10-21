import { expect, test } from 'bun:test';
import { previewAudioPlan } from '../../src/adapters/preview-audio';
import { createPluckedVoice } from '../../src/adapters/plucked';
import { encodeMp3, pcm16 } from '../../src/client/mp3-encoder';
import { score } from '../fixtures/original';
import { study } from '../adapters/fixture';
import { FakeAudioContext } from '../adapters/fake-audio';

test('MP3 plan keeps every role, sounding pitch, triplet, single tied attack and final sustain', () => {
  const before = JSON.stringify(score), plan = previewAudioPlan(score);
  expect(plan.durationSeconds).toBe(6);
  expect(plan.notes).toHaveLength(9);
  expect(new Set(plan.notes.map(n => n.role))).toEqual(new Set(['melody', 'bass', 'harmony']));
  expect(plan.notes.find(n => n.id === 'm1@o1')).toMatchObject({ midi: 67, start: 0.75 });
  expect(plan.notes.find(n => n.id === 'm1@o1')!.end).toBeCloseTo(1.25, 10);
  expect(plan.notes.filter(n => n.id.startsWith('m4@'))).toEqual([{ id: 'm4@o1', midi: 65, role: 'melody', start: 2.25, end: 3.75 }]);
  expect(plan.notes.find(n => n.id === 'bass1@o2')).toMatchObject({ midi: 43, start: 3, end: 6 });
  expect(JSON.stringify(score)).toBe(before);
});

test('MP3 uses explicit performed repeats and restored effective tempos exactly once', async () => {
  const { score } = await study(3);
  score.performedTempos[1]!.quarterBpm = 120; score.occurrences[1]!.entryQuarterBpm = 120;
  const plan = previewAudioPlan(score);
  expect(plan.durationSeconds).toBe(17); // Three two-bar passes: 3 + 2 + 3 + 3 + 3 + 3 seconds.
  expect(plan.notes).toHaveLength(score.performedSounds.length);
  const scaled = structuredClone(score); scaled.preferences.tempoScale = 0.5;
  // Effective performed BPM already includes the published scale; do not apply it again.
  expect(previewAudioPlan(scaled).durationSeconds).toBe(17);
  for (const tempo of score.performedTempos) tempo.quarterBpm = 0.1;
  for (const occurrence of score.occurrences) occurrence.entryQuarterBpm = 0.1;
  expect(() => previewAudioPlan(score)).toThrow('up to 10 minutes');
});

test('download and live preview share sampled guitar, original sounding pitch and exact note boundaries', () => {
  const ctx = new FakeAudioContext();
  const voice = createPluckedVoice(ctx as unknown as BaseAudioContext, ctx.destination as AudioNode, 69, 1, 2);
  voice.source.start(1, voice.offset); voice.source.stop(2);
  expect(ctx.oscillators).toHaveLength(0);
  const source = ctx.bufferSources[0]!;
  // Zone root 62 plus the original SF2's +11-cent tuning correction, no capo/octave offset.
  expect(source.playbackRate.value).toBeCloseTo(2 ** ((69 - 62 + 0.11) / 12), 12);
  expect(source.startTime).toBe(1); expect(source.stopTime).toBe(2); expect(source.offset).toBe(0);
  expect(source.loop).toBe(true); expect(source.loopStart).toBeLessThan(source.loopEnd);
  expect(source.buffer!.samples.some(value => value !== 0)).toBe(true);
  expect(ctx.gains[0]!.gain.events[1]).toMatchObject({ kind: 'linear', at: 1.002 });
  expect(ctx.gains[0]!.gain.events.at(-1)).toEqual({ kind: 'linear', value: 0, at: 2 });
});

test('held guitar notes resume the decaying sample loop; buffers are reused per context', () => {
  const ctx = new FakeAudioContext(), context = ctx as unknown as BaseAudioContext, destination = ctx.destination as AudioNode;
  const first = createPluckedVoice(context, destination, 52, 0, 1);
  const resumed = createPluckedVoice(context, destination, 52, 2, 3, 2.5);
  expect(resumed.source.buffer).toBe(first.source.buffer); expect(ctx.buffers).toHaveLength(1);
  expect(resumed.offset).toBeGreaterThanOrEqual(resumed.source.loopStart);
  expect(resumed.offset).toBeLessThan(resumed.source.loopEnd);
  expect(ctx.gains[1]!.gain.events[1]!.value).toBeLessThan(ctx.gains[0]!.gain.events[1]!.value);
  for (const midi of [0, 40, 54, 55, 63, 64, 84, 85, 93, 94, 127]) {
    const voice = createPluckedVoice(context, destination, midi, 0, 0.001);
    expect(voice.source.buffer!.duration).toBeGreaterThan(voice.source.loopEnd);
    const events = ctx.gains.at(-1)!.gain.events;
    expect(events.every((event, i) => Number.isFinite(event.value) && event.value >= 0 && (i === 0 || event.at >= events[i - 1]!.at))).toBe(true);
  }
  expect(ctx.buffers).toHaveLength(5);
  expect(() => createPluckedVoice(context, destination, NaN, 0, 1)).toThrow();
  expect(() => createPluckedVoice(context, destination, 69, 1, 1)).toThrow();
});

test('PCM saturates safely; real MP3 encoder emits a complete 44.1 kHz mono frame stream', async () => {
  expect([...pcm16(new Float32Array([-2, -1, 0, 1, 2, NaN]))]).toEqual([-32768, -32768, 0, 32767, 32767, 0]);
  const progress: number[] = [];
  const samples = Float32Array.from({ length: 44100 }, (_, i) => 0.1 * Math.sin(2 * Math.PI * 440 * i / 44100));
  const blob = encodeMp3(samples, 44100, value => progress.push(value));
  expect(blob.type).toBe('audio/mpeg');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let offset = 0, frames = 0;
  while (offset < bytes.length) {
    expect(bytes[offset]).toBe(255);
    expect(bytes[offset + 1]! & 0xfe).toBe(0xfa); // MPEG-1, Layer III.
    expect(bytes[offset + 2]! >> 4).toBe(9); // 128 kbps.
    expect((bytes[offset + 2]! >> 2) & 3).toBe(0); // 44.1 kHz.
    expect(bytes[offset + 3]! >> 6).toBe(3); // Mono.
    offset += Math.floor(144 * 128000 / 44100) + ((bytes[offset + 2]! >> 1) & 1);
    frames++;
  }
  expect(offset).toBe(bytes.length);
  expect(frames * 1152 / 44100).toBeGreaterThanOrEqual(1);
  expect(frames * 1152 / 44100).toBeLessThan(1.1);
  expect(progress.at(-1)).toBe(100);
  expect(() => encodeMp3(new Float32Array(), 44100, () => {})).toThrow();
  expect(() => encodeMp3(samples, 48000, () => {})).toThrow();
});

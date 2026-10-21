import type { ScoreV1 } from '../domain';
import { requireAdapter } from './errors';
import { createPluckedVoice } from './plucked';
import { compileTimeline, createTempoClock } from './timeline';

export const PREVIEW_SAMPLE_RATE = 44100;
export const MAX_PREVIEW_SECONDS = 600;

/** Full published performance, not the listener's temporary mute/loop/tempo state. */
export function previewAudioPlan(score: ScoreV1) {
  const timeline = compileTimeline(score), clock = createTempoClock(timeline);
  requireAdapter(Number.isFinite(clock.durationSeconds) && clock.durationSeconds > 0 && clock.durationSeconds <= MAX_PREVIEW_SECONDS, 'MP3 previews support arrangements up to 10 minutes. The PDF and MIDI are still available.');
  const number = (q: { n: number; d: number }) => q.n / q.d;
  return { durationSeconds: clock.durationSeconds, notes: timeline.notes.map(note => ({
    id: note.performedSoundId, midi: note.soundingMidi, role: note.role,
    start: clock.toSeconds(number(note.start)), end: clock.toSeconds(number(note.start) + number(note.duration)),
  })) };
}

export async function renderPreviewAudio(score: ScoreV1, signal: AbortSignal): Promise<Float32Array<ArrayBuffer>> {
  signal.throwIfAborted();
  if (typeof OfflineAudioContext === 'undefined') throw new Error('This browser cannot render MP3 audio. Try a current browser, or download MIDI instead.');
  const plan = previewAudioPlan(score);
  // Mono, bounded allocation. Offline rendering is silent and faster than real time.
  const context = new OfflineAudioContext(1, Math.ceil(plan.durationSeconds * PREVIEW_SAMPLE_RATE), PREVIEW_SAMPLE_RATE);
  const mix = context.createGain(); mix.gain.value = 0.65; mix.connect(context.destination);
  for (const note of plan.notes) {
    const voice = createPluckedVoice(context, mix, note.midi, note.start, note.end);
    voice.source.start(note.start, voice.offset); voice.source.stop(note.end);
  }
  const rendered = await context.startRendering();
  signal.throwIfAborted();
  return new Float32Array(rendered.getChannelData(0));
}

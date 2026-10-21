import { guitarSamples } from './guitar-samples';

const buffers = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();
function sampleBuffer(context: BaseAudioContext, index: number) {
  let bank = buffers.get(context);
  if (!bank) { bank = new Map(); buffers.set(context, bank); }
  let buffer = bank.get(index);
  if (!buffer) {
    const zone = guitarSamples[index]!, bytes = atob(zone.pcm16);
    buffer = context.createBuffer(1, bytes.length / 2, zone.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const value = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8);
      samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
    }
    bank.set(index, buffer);
  }
  return buffer;
}

/** Shared sampled acoustic guitar voice for live playback and offline downloads. */
export function createPluckedVoice(context: BaseAudioContext, destination: AudioNode, midi: number, start: number, end: number, elapsedSeconds = 0) {
  const index = guitarSamples.findIndex(zone => midi >= zone.low && midi <= zone.high), zone = guitarSamples[index];
  if (!zone || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new Error('Invalid guitar voice pitch or interval');
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const rate = 2 ** ((midi - zone.root + zone.correction / 100) / 12);
  source.buffer = sampleBuffer(context, index); source.loop = true;
  source.loopStart = zone.loopStart / zone.sampleRate; source.loopEnd = zone.loopEnd / zone.sampleRate;
  source.playbackRate.setValueAtTime(rate, start);
  // Seeking into a held note resumes its decayed loop, not a fresh pick attack.
  let offset = elapsedSeconds * rate;
  if (offset >= source.loopEnd) offset = source.loopStart + (offset - source.loopStart) % (source.loopEnd - source.loopStart);
  const brightness = (age: number) => Math.min(10000, frequency * 5 + 700 + frequency * 13 * Math.exp(-age / 0.07));
  filter.type = 'lowpass'; filter.Q.value = 0.5;
  filter.frequency.setValueAtTime(brightness(elapsedSeconds), start);
  filter.frequency.exponentialRampToValueAtTime(brightness(elapsedSeconds + Math.min(0.25, end - start)), Math.min(start + 0.25, end));
  const decay = Math.min(3.2, Math.max(0.8, 2.4 * 2 ** ((52 - midi) / 48)));
  const amplitude = (age: number) => Math.max(0.00001, 0.38 * 10 ** (-zone.attenuation / 200) * Math.exp(-age / decay));
  const attackEnd = start + Math.min(0.002, (end - start) / 4), releaseStart = Math.max(attackEnd, end - 0.012);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(amplitude(elapsedSeconds + attackEnd - start), attackEnd);
  gain.gain.exponentialRampToValueAtTime(amplitude(elapsedSeconds + releaseStart - start), releaseStart);
  gain.gain.linearRampToValueAtTime(0, end);
  source.connect(filter); filter.connect(gain); gain.connect(destination);
  return { source, filter, gain, offset };
}

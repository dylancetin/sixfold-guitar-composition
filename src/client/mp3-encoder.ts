import { Mp3Encoder } from '@breezystack/lamejs';

/** LAME's signed PCM input must saturate, never wrap loud samples around. */
export function pcm16(samples: Float32Array): Int16Array {
  return Int16Array.from(samples, value => {
    const bounded = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    return Math.round(bounded * (bounded < 0 ? 32768 : 32767));
  });
}

export function encodeMp3(samples: Float32Array, sampleRate: number, progress: (percent: number) => void): Blob {
  if (sampleRate !== 44100 || !samples.length || samples.length > sampleRate * 600) throw new Error('Invalid or oversized MP3 audio.');
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let lastPercent = -1;
  for (let offset = 0; offset < samples.length; offset += 1152) {
    const encoded = encoder.encodeBuffer(pcm16(samples.subarray(offset, offset + 1152)));
    if (encoded.length) chunks.push(new Uint8Array(encoded));
    const percent = Math.floor(Math.min(offset + 1152, samples.length) / samples.length * 100);
    if (percent !== lastPercent) { progress(percent); lastPercent = percent; }
  }
  chunks.push(new Uint8Array(encoder.flush()));
  return new Blob(chunks, { type: 'audio/mpeg' });
}

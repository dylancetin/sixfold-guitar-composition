import { encodeMp3 } from './mp3-encoder';

export type Mp3Reply = { kind: 'progress'; percent: number } | { kind: 'ready'; blob: Blob } | { kind: 'error'; message: string };
self.onmessage = (event: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
  try {
    const blob = encodeMp3(event.data.samples, event.data.sampleRate, percent => self.postMessage({ kind: 'progress', percent } satisfies Mp3Reply));
    self.postMessage({ kind: 'ready', blob } satisfies Mp3Reply);
  } catch {
    self.postMessage({ kind: 'error', message: 'MP3 encoding failed. Try again, or download MIDI instead.' } satisfies Mp3Reply);
  }
};

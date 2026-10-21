import type { ScoreV1 } from '../domain';
import { PREVIEW_SAMPLE_RATE, renderPreviewAudio } from '../adapters/preview-audio';
import type { Mp3Reply } from './mp3-worker';

export async function createPreviewMp3(score: ScoreV1, signal: AbortSignal, progress: (message: string) => void): Promise<Blob> {
  progress('Rendering audio…');
  const samples = await renderPreviewAudio(score, signal);
  signal.throwIfAborted();
  progress('Encoding MP3: 0%');
  const worker = new Worker(new URL('./mp3-worker.ts', import.meta.url), { type: 'module' });
  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(signal.reason); };
    const fail = (message: string) => { cleanup(); reject(new Error(message)); };
    const timer = setTimeout(() => fail('MP3 encoding took too long. Try again, or download MIDI instead.'), 120000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<Mp3Reply>) => {
      const reply = event.data;
      if (reply.kind === 'progress') progress(`Encoding MP3: ${reply.percent}%`);
      else if (reply.kind === 'error') fail(reply.message);
      else { cleanup(); resolve(reply.blob); }
    };
    worker.onerror = () => fail('The MP3 encoder could not start. Try again, or download MIDI instead.');
    worker.onmessageerror = () => fail('The MP3 audio could not be read. Try again, or download MIDI instead.');
    try { worker.postMessage({ samples, sampleRate: PREVIEW_SAMPLE_RATE }, [samples.buffer]); }
    catch { fail('The MP3 audio could not reach the encoder. Try again, or download MIDI instead.'); }
  });
}

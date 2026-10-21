// Deterministic WebAudio boundary double; it does not prove speaker output.
class Parameter {
  value = 1;
  events: { kind: string; value: number; at: number }[] = [];
  setValueAtTime(value: number, at: number) { this.value = value; this.events.push({ kind: 'set', value, at }); }
  linearRampToValueAtTime(value: number, at: number) { this.value = value; this.events.push({ kind: 'linear', value, at }); }
  exponentialRampToValueAtTime(value: number, at: number) { this.value = value; this.events.push({ kind: 'exponential', value, at }); }
  cancelScheduledValues(at: number) { this.events = this.events.filter(e => e.at < at); }
}
class Node {
  disconnected = false;
  connect(_destination: object) { return _destination; }
  disconnect() { this.disconnected = true; }
}
class Gain extends Node { gain = new Parameter(); }
class Filter extends Node { type = ''; frequency = new Parameter(); Q = new Parameter(); }
export class Oscillator extends Node {
  type = ''; frequency = new Parameter(); startTime: number | null = null; stopTime: number | null = null; onended: (() => void) | null = null;
  start(time: number) { this.startTime = time; }
  stop(time: number) { this.stopTime = time; }
}
class SampleBuffer {
  readonly samples: Float32Array;
  constructor(readonly length: number, readonly sampleRate: number) { this.samples = new Float32Array(length); }
  getChannelData(_channel: number) { return this.samples; }
  get duration() { return this.length / this.sampleRate; }
}
class BufferSource extends Node {
  buffer: SampleBuffer | null = null; playbackRate = new Parameter(); loop = false; loopStart = 0; loopEnd = 0;
  startTime: number | null = null; stopTime: number | null = null; offset = 0; onended: (() => void) | null = null;
  start(time: number, offset = 0) { this.startTime = time; this.offset = offset; }
  stop(time: number) { this.stopTime = time; }
}
export class FakeAudioContext {
  currentTime = 0; state = 'suspended'; destination = {}; onstatechange: (() => void) | null = null;
  oscillators: Oscillator[] = []; gains: Gain[] = []; tick: (() => void) | null = null;
  bufferSources: BufferSource[] = []; buffers: SampleBuffer[] = [];
  resumePromise: Promise<void> | null = null;
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createOscillator() { const node = new Oscillator(); this.oscillators.push(node); return node; }
  createBuffer(_channels: number, length: number, sampleRate: number) { const buffer = new SampleBuffer(length, sampleRate); this.buffers.push(buffer); return buffer; }
  createBufferSource() { const source = new BufferSource(); this.bufferSources.push(source); return source; }
  createBiquadFilter() { return new Filter(); }
  async resume() { if (this.resumePromise) await this.resumePromise; this.state = 'running'; this.onstatechange?.(); }
  async close() { this.state = 'closed'; this.onstatechange?.(); }
  advance(seconds: number, step = 0.025) {
    const until = this.currentTime + seconds;
    while (this.currentTime < until - 1e-12) {
      this.currentTime = Math.min(until, this.currentTime + step);
      for (const node of [...this.oscillators, ...this.bufferSources]) if (node.onended && node.stopTime !== null && node.stopTime <= this.currentTime) { const end = node.onended; node.onended = null; end(); }
      this.tick?.();
    }
  }
  options() {
    return {
      audioContextFactory: () => this as unknown as AudioContext,
      scheduler: (tick: () => void, _ms: number) => { this.tick = tick; return () => { this.tick = null; }; },
    };
  }
}

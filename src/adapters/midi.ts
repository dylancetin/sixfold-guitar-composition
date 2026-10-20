import { exactTicks } from '../domain';
import { requireAdapter } from './errors';
import { PPQ, ROLES } from './timeline';
import type { CompiledTimeline } from './timeline';

type MidiEvent = { tick: number; order: number; data: number[] };
function vlq(value: number): number[] {
  requireAdapter(Number.isSafeInteger(value) && value >= 0 && value <= 0x0fffffff, 'MIDI delta exceeds SMF range');
  const bytes = [value & 127];
  while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value & 127) | 128);
  return bytes;
}
const int = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => Math.floor(n / 256 ** (bytes - 1 - i)) & 255);
const text = (s: string) => [...new TextEncoder().encode(s)];
function meta(type: number, data: number[]): number[] { return [255, type, ...vlq(data.length), ...data]; }
function track(events: MidiEvent[], end: number): number[] {
  const bytes: number[] = []; let previous = 0;
  for (const event of events.sort((a, b) => a.tick - b.tick || a.order - b.order)) {
    bytes.push(...vlq(event.tick - previous), ...event.data); previous = event.tick;
  }
  bytes.push(...vlq(end - previous), 255, 47, 0);
  return [...text('MTrk'), ...int(bytes.length, 4), ...bytes];
}

/** SMF1 conductor + three role tracks; no native repeats, capo shifts, notation attacks or hidden track. */
export function encodeMidi(timeline: CompiledTimeline): Uint8Array {
  const end = exactTicks(timeline.end, PPQ);
  const conductor: MidiEvent[] = [{ tick: 0, order: 0, data: meta(3, text(`Revision ${timeline.score.revision.id} ${timeline.score.revision.digest}`)) }];
  for (const tempo of timeline.score.performedTempos) {
    const micros = Math.floor(60000000 / (tempo.quarterBpm * timeline.score.preferences.tempoScale));
    requireAdapter(micros >= 1 && micros <= 0xffffff, 'Tempo exceeds MIDI microsecond range');
    conductor.push({ tick: exactTicks(tempo.start, PPQ), order: 1, data: meta(81, int(micros, 3)) });
  }
  for (const occurrence of timeline.score.occurrences) {
    conductor.push({ tick: exactTicks(occurrence.start, PPQ), order: 2, data: meta(88, [occurrence.meter.beats, Math.log2(occurrence.meter.beatUnit), 24, 8]) });
    conductor.push({ tick: exactTicks(occurrence.start, PPQ), order: 3, data: meta(6, text(`${occurrence.id}/${occurrence.writtenBarId}/P${occurrence.pass}`)) });
  }
  const tracks = [track(conductor, end)];
  for (const [channel, role] of ROLES.entries()) {
    const events: MidiEvent[] = [{ tick: 0, order: 0, data: meta(3, text(role)) }, { tick: 0, order: 1, data: [192 | channel, 24] }];
    const pitchEnds = new Map<number, number>();
    for (const note of timeline.notes.filter(n => n.role === role)) {
      const start = exactTicks(note.start, PPQ), release = start + exactTicks(note.duration, PPQ);
      requireAdapter((pitchEnds.get(note.soundingMidi) ?? -1) <= start, `Overlapping unison ${role}/${note.soundingMidi} cannot be independently released on one MIDI role channel`);
      pitchEnds.set(note.soundingMidi, release);
      events.push({ tick: start, order: 3, data: [144 | channel, note.soundingMidi, 82] });
      events.push({ tick: release, order: 2, data: [128 | channel, note.soundingMidi, 0] });
    }
    tracks.push(track(events, end));
  }
  return new Uint8Array([...text('MThd'), 0, 0, 0, 6, 0, 1, 0, tracks.length, ...int(PPQ, 2), ...tracks.flat()]);
}

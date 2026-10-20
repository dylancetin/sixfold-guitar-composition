import { add, compare, exactTicks, q, ScoreV1Schema, subtract } from '../domain';
import type { NotationSegment, Occurrence, PerformedSound, Placement, Q, ScoreV1, Sound } from '../domain';
import { requireAdapter } from './errors';

export const PPQ = 960;
export const ROLES = ['melody', 'bass', 'harmony'] as const;
export type Role = typeof ROLES[number];
export type PerformedNote = {
  performedSoundId: string; soundId: string; occurrenceId: string; occurrenceIds: string[];
  role: Role; soundingMidi: number; start: Q; duration: Q; placement: Placement;
};
export type PerformedSegment = { segment: NotationSegment; occurrence: Occurrence; at: Q; performed: PerformedNote | null };

function unique<T>(values: T[], key: (value: T) => string, label: string): Map<string, T> {
  const map = new Map(values.map(value => [key(value), value]));
  requireAdapter(map.size === values.length, `Duplicate ${label} ID`);
  return map;
}

/** Representation checks, NOT the independent musical/physical validator. No form expansion here. */
export function compileTimeline(input: ScoreV1) {
  const score = ScoreV1Schema.parse(input);
  const bars = unique(score.bars, b => b.id, 'bar');
  const sounds = unique(score.sounds, s => s.id, 'sound');
  const rests = unique(score.rests, s => s.id, 'rest');
  requireAdapter([...sounds.keys()].every(id => !rests.has(id)), 'Sound/rest IDs overlap');
  unique(score.notation, n => n.id, 'segment');
  unique(score.performedSounds, p => p.id, 'performed sound');
  const placements = unique(score.placements, p => p.id, 'placement');
  const occurrences = unique(score.occurrences, o => o.id, 'occurrence');
  let end = q(0);
  for (const occurrence of score.occurrences) {
    const bar = bars.get(occurrence.writtenBarId);
    requireAdapter(bar && compare(bar.length, occurrence.length) === 0, 'Missing/mismatched occurrence bar');
    requireAdapter(compare(occurrence.start, end) === 0, 'Occurrences must be one contiguous explicit timeline starting at zero');
    requireAdapter(occurrence.meter.beats === bar.meter.beats && occurrence.meter.beatUnit === bar.meter.beatUnit, 'Occurrence meter differs from written bar');
    end = add(end, occurrence.length);
    exactTicks(end, PPQ);
  }
  for (const event of [...score.sounds, ...score.rests]) {
    const segments = score.notation.filter(n => n.eventId === event.id).sort((a, b) => compare(a.start, b.start));
    let position = event.start;
    requireAdapter(segments.length > 0, `No notation for ${event.id}`);
    for (const [index, segment] of segments.entries()) {
      const bar = bars.get(segment.barId);
      requireAdapter(bar && segment.voiceId === event.voiceId && compare(segment.start, position) === 0, `Notation gap/overlap/voice mismatch: ${event.id}`);
      requireAdapter(segment.kind === (sounds.has(event.id) ? 'note' : 'rest'), 'Notation kind mismatch');
      requireAdapter(compare(segment.start, bar.start) >= 0 && compare(add(segment.start, segment.duration), add(bar.start, bar.length)) <= 0, 'Notation crosses its written bar');
      if (segment.kind === 'note') {
        const expected = segments.length === 1 ? 'none' : index === 0 ? 'start' : index === segments.length - 1 ? 'end' : 'continue';
        requireAdapter(segment.tie === expected, `Incomplete/incorrect tie chain: ${event.id}`);
      }
      exactTicks(segment.duration, PPQ);
      position = add(position, segment.duration);
    }
    requireAdapter(compare(position, add(event.start, event.duration)) === 0, `Notation does not tile ${event.id}`);
  }
  requireAdapter(score.notation.every(n => sounds.has(n.eventId) || rests.has(n.eventId)), 'Orphan notation segment');
  const notes: PerformedNote[] = score.performedSounds.map((performed: PerformedSound) => {
    const sound = sounds.get(performed.soundId);
    const placement = placements.get(performed.placementId);
    const attack = occurrences.get(performed.attackOccurrenceId);
    requireAdapter(sound && placement && placement.soundId === sound.id && attack, 'Missing performed sound/placement/attack reference');
    const attackBar = bars.get(attack.writtenBarId)!;
    requireAdapter(compare(performed.start, add(attack.start, subtract(sound.start, attackBar.start))) === 0, 'Performed attack does not match written sound');
    requireAdapter(compare(performed.duration, sound.duration) === 0, 'Performed sound duration differs from written sound');
    const sounding = score.instrument.tuning[placement.stringIndex]! + score.instrument.capo + placement.fret;
    requireAdapter(sounding === sound.soundingMidi, `Wrong capo/placement pitch for ${performed.id}`);
    requireAdapter(score.instrument.capo + placement.fret <= Math.min(score.instrument.maxPhysicalFret, score.ability.maxPhysicalFret), 'Physical fret exceeds limit');
    const covered = score.occurrences.filter(o => compare(o.start, add(performed.start, performed.duration)) < 0 && compare(add(o.start, o.length), performed.start) > 0);
    requireAdapter(JSON.stringify(covered.map(o => o.id)) === JSON.stringify(performed.occurrenceIds), 'Incomplete occurrence coverage');
    for (let i = 1; i < covered.length; i++) {
      const previous = bars.get(covered[i - 1]!.writtenBarId)!;
      const current = bars.get(covered[i]!.writtenBarId)!;
      requireAdapter(compare(add(previous.start, previous.length), current.start) === 0 && covered[i]!.entry === 'contiguous', 'Tie crosses a form jump');
    }
    requireAdapter(compare(add(performed.start, performed.duration), end) <= 0, 'Sound extends beyond performance');
    exactTicks(performed.start, PPQ); exactTicks(performed.duration, PPQ);
    return { performedSoundId: performed.id, soundId: sound.id, occurrenceId: attack.id, occurrenceIds: [...performed.occurrenceIds], role: sound.role, soundingMidi: sound.soundingMidi, start: performed.start, duration: performed.duration, placement };
  }).sort((a, b) => compare(a.start, b.start) || a.performedSoundId.localeCompare(b.performedSoundId));
  const segments: PerformedSegment[] = [];
  for (const occurrence of score.occurrences) {
    const bar = bars.get(occurrence.writtenBarId)!;
    for (const segment of score.notation.filter(n => n.barId === bar.id)) {
      const at = add(occurrence.start, subtract(segment.start, bar.start));
      const matches = notes.filter(n => n.soundId === segment.eventId && n.occurrenceIds.includes(occurrence.id) && compare(n.start, at) <= 0 && compare(add(n.start, n.duration), add(at, segment.duration)) >= 0);
      requireAdapter(segment.kind === 'rest' || matches.length === 1, `Missing/duplicate performed segment ${segment.id}@${occurrence.id}; orphan continuation is unsupported`);
      segments.push({ segment, occurrence, at, performed: matches[0] ?? null });
    }
  }
  requireAdapter(notes.every(n => segments.some(s => s.performed === n && compare(s.at, n.start) === 0)), 'Performed sound has no engraved attack');
  let prior = q(-1);
  for (const tempo of score.performedTempos) {
    const occurrence = occurrences.get(tempo.occurrenceId);
    requireAdapter(occurrence && compare(tempo.start, occurrence.start) >= 0 && compare(tempo.start, add(occurrence.start, occurrence.length)) < 0, 'Tempo outside occurrence');
    requireAdapter(compare(tempo.start, prior) > 0, 'Tempos must be strictly ordered without duplicates');
    exactTicks(tempo.start, PPQ); prior = tempo.start;
  }
  for (const occurrence of score.occurrences) {
    requireAdapter(score.performedTempos.some(t => t.occurrenceId === occurrence.id && compare(t.start, occurrence.start) === 0 && t.quarterBpm === occurrence.entryQuarterBpm), 'Missing/mismatched explicit occurrence entry tempo');
  }
  return { score, bars, sounds, rests, notes, segments, end };
}

export type CompiledTimeline = ReturnType<typeof compileTimeline>;

/** Float conversion occurs only at the audio boundary. Tempo scale multiplies BPM exactly once. */
export function createTempoClock(timeline: CompiledTimeline, scale = timeline.score.preferences.tempoScale) {
  requireAdapter(Number.isFinite(scale) && scale > 0, 'Invalid tempo scale');
  const points = timeline.score.performedTempos.map(t => ({ quarter: t.start.n / t.start.d, bpm: t.quarterBpm * scale, seconds: 0 }));
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!;
    points[i]!.seconds = previous.seconds + (points[i]!.quarter - previous.quarter) * 60 / previous.bpm;
  }
  const toSeconds = (quarter: number) => {
    const point = points.findLast(p => p.quarter <= quarter) ?? points[0]!;
    return point.seconds + (quarter - point.quarter) * 60 / point.bpm;
  };
  const toQuarter = (seconds: number) => {
    const point = points.findLast(p => p.seconds <= seconds) ?? points[0]!;
    return point.quarter + (seconds - point.seconds) * point.bpm / 60;
  };
  return { toSeconds, toQuarter, durationSeconds: toSeconds(timeline.end.n / timeline.end.d) };
}

export function eventForSegment(timeline: CompiledTimeline, segment: NotationSegment): Sound | ScoreV1['rests'][number] {
  return timeline.sounds.get(segment.eventId) ?? timeline.rests.get(segment.eventId)!;
}

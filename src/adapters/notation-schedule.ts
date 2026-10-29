import { add, compare, q, subtract } from '../domain';
import type { Occurrence, Q, WrittenBar } from '../domain';
import { requireAdapter } from './errors';
import type { CompiledTimeline } from './timeline';

export type NotationMode = 'auto' | 'unfolded';
export type DisplayBar = {
  nativeBarId: string; written: WrittenBar; representative: Occurrence; occurrences: Occurrence[]; start: Q; label: string;
};
export type NotationSchedule = { folded: boolean; unfoldedReason: string | null; bars: DisplayBar[] };

function checkForm(timeline: CompiledTimeline) {
  const { score } = timeline;
  const indices = new Map(score.bars.map((bar, i) => [bar.id, i]));
  let end = q(0);
  for (const bar of score.bars) {
    requireAdapter(compare(bar.start, end) === 0, 'Written bars must be contiguous from zero');
    end = add(bar.start, bar.length);
  }
  const ranges = score.form.repeats.map(repeat => {
    const from = indices.get(repeat.fromBarId), to = indices.get(repeat.toBarId);
    requireAdapter(from !== undefined && to !== undefined && from <= to, 'Invalid repeat range');
    return { ...repeat, from, to };
  }).sort((a, b) => a.from - b.from);
  const ids = new Set<string>();
  let previousEnd = -1;
  for (const range of ranges) {
    requireAdapter(!ids.has(range.id), 'Duplicate repeat ID'); ids.add(range.id);
    requireAdapter(range.from > previousEnd, 'Nested/overlapping repeats are unsupported'); previousEnd = range.to;
  }
  // Check supplied visits against each written block. Never manufacture a second performance.
  let cursor = 0;
  for (let index = 0; index < score.bars.length;) {
    const range = ranges.find(r => r.from === index);
    const last = range?.to ?? index;
    for (let pass = 1; pass <= (range?.totalPasses ?? 1); pass++) for (let bar = index; bar <= last; bar++) {
      const occurrence = score.occurrences[cursor];
      requireAdapter(occurrence && occurrence.writtenBarId === score.bars[bar]!.id && occurrence.pass === pass, 'Occurrence schedule differs from written repeat form');
      const entry = cursor === 0 ? 'start' : pass > 1 && bar === index ? 'repeat-jump' : 'contiguous';
      requireAdapter(occurrence.entry === entry, 'Occurrence entry differs from written repeat form'); cursor++;
    }
    index = last + 1;
  }
  requireAdapter(cursor === score.occurrences.length, 'Extra occurrences outside written repeat form');
}

function visitFacts(timeline: CompiledTimeline, occurrence: Occurrence): string {
  return JSON.stringify({
    segments: timeline.segments.filter(s => s.occurrence.id === occurrence.id).map(({ segment, at, performed }) => ({
      segment, offset: subtract(at, occurrence.start),
      performed: performed && {
        soundId: performed.soundId, role: performed.role, soundingMidi: performed.soundingMidi,
        start: subtract(performed.start, occurrence.start), duration: performed.duration,
        bars: performed.occurrenceIds.map(id => timeline.score.occurrences.find(o => o.id === id)!.writtenBarId),
        stringIndex: performed.placement.stringIndex, fret: performed.placement.fret, finger: performed.placement.finger,
        tieDestination: compare(at, performed.start) > 0,
      },
    })),
    tempos: timeline.score.performedTempos.filter(t => t.occurrenceId === occurrence.id).map(t => ({ offset: subtract(t.start, occurrence.start), quarterBpm: t.quarterBpm, origin: t.origin, sourceTempoId: t.sourceTempoId })),
  });
}

export function createNotationSchedule(timeline: CompiledTimeline, mode: NotationMode = 'auto'): NotationSchedule {
  checkForm(timeline);
  const { score } = timeline;
  let unfoldedReason: string | null = null;
  if (mode !== 'unfolded' && score.form.repeats.length) for (const bar of score.bars) {
    const visits = score.occurrences.filter(o => o.writtenBarId === bar.id);
    const first = visitFacts(timeline, visits[0]!);
    if (visits.slice(1).some(o => visitFacts(timeline, o) !== first)) {
      unfoldedReason = `passes differ at S${bar.number}`;
      break;
    }
  }
  const folded = mode !== 'unfolded' && score.form.repeats.length > 0 && unfoldedReason === null;
  const representatives = folded ? score.bars.map(b => score.occurrences.find(o => o.writtenBarId === b.id)!) : score.occurrences;
  const bars = representatives.map((representative, index): DisplayBar => {
    const written = timeline.bars.get(representative.writtenBarId)!;
    return {
      nativeBarId: String(index), written, representative,
      occurrences: folded ? score.occurrences.filter(o => o.writtenBarId === written.id) : [representative],
      start: folded ? written.start : representative.start,
      label: folded ? `S${written.number}` : `${representative.id}/S${written.number}/P${representative.pass}`,
    };
  });
  return { folded, unfoldedReason, bars };
}

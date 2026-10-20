import { add, compare, q, subtract } from '../domain';
import type { Diagnostic, Form, Occurrence, PerformedTempo, Q, SourceEvent, TempoPoint, WrittenBar } from '../domain';

export type FormInput = { bars: WrittenBar[]; tempos: TempoPoint[]; form: Form; events?: SourceEvent[] };
export type FormExpansion =
  | { status: 'expanded'; occurrences: Occurrence[]; performedTempos: PerformedTempo[]; length: Q }
  | { status: 'unsupported' | 'invalid-input'; diagnostics: Diagnostic[] };

export function diagnostic(code: Diagnostic['code'], message: string, eventIds: string[] = [], barIds: string[] = []): Diagnostic {
  return { code, severity: 'error', message, barIds, eventIds, occurrenceIds: [] };
}

/** Exact finite linear-repeat unfolding. Never delegates tempo inheritance to a renderer. */
export function expandForm(input: FormInput, tempoScale = 1): FormExpansion {
  const fail = (message: string, unsupported = false): FormExpansion => ({
    status: unsupported ? 'unsupported' : 'invalid-input',
    diagnostics: [diagnostic(unsupported ? 'unsupported-construct' : 'invalid-input', message)],
  });
  const { bars, tempos, form } = input;
  if (form.kind !== 'linear-repeats' || form.tempoPolicy !== 'restore-written-position' || form.jumpTiePolicy !== 'reject-cross-jump') return fail('Unsupported form/direction policy', true);
  if (!bars.length || !Number.isFinite(tempoScale) || tempoScale <= 0) return fail('Missing bars or invalid tempo scale');
  const indices = new Map<string, number>();
  let end = q(0);
  for (const [i, bar] of bars.entries()) {
    if (indices.has(bar.id) || compare(bar.start, end) !== 0 || compare(bar.length, q(0)) <= 0) return fail('Bars must be unique, ordered, and exactly contiguous from zero');
    if (bar.kind === 'full' && compare(bar.length, q(bar.meter.beats * 4, bar.meter.beatUnit)) !== 0) return fail('Full bar differs from its meter');
    indices.set(bar.id, i);
    end = add(end, bar.length);
  }
  const ranges = form.repeats.map((r) => ({ ...r, from: indices.get(r.fromBarId), to: indices.get(r.toBarId) }));
  ranges.sort((a, b) => (a.from ?? -1) - (b.from ?? -1));
  let previousEnd = -1;
  const repeatIds = new Set<string>();
  for (const r of ranges) {
    if (r.from === undefined || r.to === undefined || r.to < r.from || !Number.isInteger(r.totalPasses) || r.totalPasses < 2 || r.totalPasses > 16 || repeatIds.has(r.id)) return fail('Invalid repeat range, count, or duplicate ID');
    if (r.from <= previousEnd) return fail('Nested/overlapping repeats and alternate endings are unsupported', true);
    repeatIds.add(r.id);
    previousEnd = r.to;
    const from = bars[r.from]!.start;
    const to = add(bars[r.to]!.start, bars[r.to]!.length);
    for (const e of input.events ?? []) {
      const release = add(e.start, e.duration);
      if ((compare(e.start, from) < 0 && compare(release, from) > 0) || (compare(e.start, to) < 0 && compare(release, to) > 0)) {
        return { status: 'unsupported', diagnostics: [diagnostic('unsupported-construct', 'Sound/rest crosses a repeat jump or becomes an orphan continuation; explicit source interpretation required', [e.id], [r.fromBarId, r.toBarId])] };
      }
    }
  }
  const absolute = tempos.map((t) => {
    const index = indices.get(t.barId);
    return { point: t, at: index === undefined ? null : add(bars[index]!.start, t.offset) };
  });
  const tempoIds = new Set<string>();
  for (const { point, at } of absolute) {
    const bar = bars[indices.get(point.barId) ?? -1];
    if (!bar || !at || compare(point.offset, q(0)) < 0 || compare(point.offset, bar.length) >= 0 || !Number.isFinite(point.quarterBpm) || point.quarterBpm <= 0 || point.quarterBpm * tempoScale > 400 || tempoIds.has(point.id)) return fail('Invalid written tempo reference, offset, ID, or effective BPM');
    tempoIds.add(point.id);
  }
  absolute.sort((a, b) => compare(a.at!, b.at!));
  if (!absolute.length || compare(absolute[0]!.at!, q(0)) !== 0) return fail('An explicit initial tempo at zero is required');
  for (let i = 1; i < absolute.length; i++) if (compare(absolute[i - 1]!.at!, absolute[i]!.at!) === 0) return fail('Conflicting written tempos at the same position');
  const schedule: number[] = [];
  for (let i = 0; i < bars.length;) {
    const r = ranges.find((r) => r.from === i);
    if (r) {
      for (let pass = 0; pass < r.totalPasses; pass++) for (let j = r.from!; j <= r.to!; j++) schedule.push(j);
      i = r.to! + 1;
    } else schedule.push(i++);
  }
  const occurrences: Occurrence[] = [];
  const performedTempos: PerformedTempo[] = [];
  const visits = new Map<string, number>();
  let start = q(0);
  for (const [i, index] of schedule.entries()) {
    const bar = bars[index]!;
    const effective = absolute.filter((t) => compare(t.at!, bar.start) <= 0).at(-1)!;
    const occurrence: Occurrence = {
      id: `o${i + 1}`, writtenBarId: bar.id, pass: (visits.get(bar.id) ?? 0) + 1,
      start, length: bar.length, meter: bar.meter, entryQuarterBpm: effective.point.quarterBpm * tempoScale,
      entry: i === 0 ? 'start' : schedule[i - 1] === index - 1 ? 'contiguous' : 'repeat-jump',
    };
    visits.set(bar.id, occurrence.pass);
    occurrences.push(occurrence);
    performedTempos.push({ occurrenceId: occurrence.id, start, quarterBpm: occurrence.entryQuarterBpm, origin: 'entry-restore', sourceTempoId: effective.point.id });
    for (const { point, at } of absolute) if (compare(at!, bar.start) > 0 && compare(at!, add(bar.start, bar.length)) < 0) {
      performedTempos.push({ occurrenceId: occurrence.id, start: add(start, subtract(at!, bar.start)), quarterBpm: point.quarterBpm * tempoScale, origin: 'written-point', sourceTempoId: point.id });
    }
    start = add(start, bar.length);
  }
  return { status: 'expanded', occurrences, performedTempos, length: start };
}

/** Floating seconds are used only at the playback/physical-transition boundary. */
export function secondsBetween(start: Q, end: Q, tempos: PerformedTempo[]): number {
  let cursor = start;
  let bpm = tempos.filter((t) => compare(t.start, start) <= 0).at(-1)?.quarterBpm;
  if (!bpm) throw new RangeError('No effective tempo');
  let seconds = 0;
  for (const t of tempos) if (compare(t.start, start) > 0 && compare(t.start, end) < 0) {
    const delta = subtract(t.start, cursor);
    seconds += delta.n / delta.d * 60 / bpm;
    cursor = t.start;
    bpm = t.quarterBpm;
  }
  const delta = subtract(end, cursor);
  return seconds + delta.n / delta.d * 60 / bpm;
}

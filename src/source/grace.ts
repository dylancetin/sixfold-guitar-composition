import { add, compare, multiply, q, subtract } from '../domain';
import type { Q } from '../domain';
import { fail } from './common';
import type { RawBeat } from './raw';

/**
 * Resolve the player's bounded grace-note time borrowing before creating events.
 * Grace notation does not add to a bar's written duration. The group borrows
 * from the preceding beat (beforeBeat) or following beat (onBeat). Its budget
 * is at most the mean nominal grace duration and leaves half of the donor
 * (a quarter/eighth for dotted/double-dotted grace notation).
 */
export function graceDurations(beats: RawBeat[], nominal: { duration: Q; dots: number }[], played: Q[], barId: string, firstBar: boolean): Q[] {
  const result = played.map((duration) => ({ ...duration }));
  for (let i = 0; i < beats.length;) {
    const kind = beats[i]!.graceNote;
    if (!kind) { i++; continue; }
    let end = i + 1;
    while (end < beats.length && beats[end]!.graceNote === kind) end++;
    if (beats[end]?.graceNote) fail('Mixed before/on-beat grace groups need explicit interpretation.', 'unsupported', 'unsupported-construct', [barId]);
    // At score zero the player falls back to on-beat grace rather than negative time.
    const onBeat = kind === 'onBeat' || (i === 0 && firstBar);
    const donor = onBeat ? end : i - 1;
    if (donor < 0 || donor >= beats.length || beats[donor]!.graceNote) fail('Cross-bar/orphan grace group needs a supported donor; no grace note was dropped.', 'unsupported', 'unsupported-construct', [barId]);
    if (beats.slice(i, end).some((beat) => beat.rest || beat.notes.some((note) => note.rest || note.tie))) fail('Rest/tied grace notes need explicit interpretation.', 'unsupported', 'unsupported-construct', [barId]);
    if (onBeat && beats[donor]!.notes.some((note) => note.tie)) fail('On-beat grace cannot split a tied continuation without explicit interpretation.', 'unsupported', 'unsupported-construct', [barId]);
    const count = end - i;
    const total = nominal.slice(i, end).reduce((sum, rhythm) => add(sum, rhythm.duration), q(0));
    const dots = Math.max(...nominal.slice(i, end).map((rhythm) => rhythm.dots));
    const keep = dots >= 2 ? q(1, 8) : dots === 1 ? q(1, 4) : q(1, 2);
    const available = multiply(played[donor]!, subtract(q(1), keep));
    const mean = multiply(total, q(1, count));
    const budget = compare(available, mean) < 0 ? available : mean;
    const borrowed = compare(total, budget) > 0 ? budget : total;
    for (let index = i; index < end; index++) result[index] = compare(total, budget) > 0 ? multiply(borrowed, q(1, count)) : nominal[index]!.duration;
    result[donor] = subtract(result[donor]!, borrowed);
    if (compare(result[donor]!, q(0)) <= 0) fail('Grace groups exhaust their shared donor; no zero/negative note accepted.', 'unsupported', 'unsupported-construct', [barId]);
    i = end;
  }
  return result;
}

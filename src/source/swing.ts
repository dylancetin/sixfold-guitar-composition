import { add, compare, multiply, q, subtract } from '../domain';
import type { Q } from '../domain';
import { fail } from './common';
import type { RawPart } from './raw';

export type TripletFeel = 'off' | '8th' | '16th';

/** Feel is a written-position setting, inherited until an explicit reset. */
export function effectiveTripletFeels(raw: RawPart): TripletFeel[] {
  let feel: TripletFeel = 'off';
  return raw.measures.map((measure, index) => {
    const value = measure.tripletFeel;
    if (value === 'off' || value === 'none') feel = 'off';
    else if (value === '8th' || value === '16th') feel = value;
    else if (value !== undefined && value !== null) fail(`Unsupported swing/triplet feel ${JSON.stringify(value)}; rhythm not changed.`, 'unsupported', 'unsupported-construct', [`bar-${index + 1}`]);
    return feel;
  });
}

type Rhythm = { duration: Q; actual: number | null };

/**
 * Materialize the player's 2:1 feel in canonical time, not renderer playback.
 * Map both boundaries, so dotted notes, rests and ties keep their exact releases.
 * An explicit tuplet/finer subdivision disables its pair across the bar's voices;
 * in particular, an already notated triplet must never be swung a second time.
 */
export function swingDurations(voices: { rest?: boolean; rhythms: Rhythm[] }[], feel: TripletFeel, barLength: Q): Q[][] {
  if (feel === 'off') return voices.map((voice) => voice.rhythms.map((rhythm) => rhythm.duration));
  const unitsPerQuarter = feel === '8th' ? 2 : 4;
  const unit = q(1, unitsPerQuarter);
  const pair = multiply(unit, q(2));
  const groupAt = (time: Q): number => Number(BigInt(time.n) * BigInt(pair.d) / (BigInt(time.d) * BigInt(pair.n)));
  const straight = new Set<number>();
  for (const voice of voices) {
    if (voice.rest) continue;
    let at = q(0);
    for (const rhythm of voice.rhythms) {
      if (rhythm.actual === 2 || multiply(rhythm.duration, q(unitsPerQuarter)).d !== 1) straight.add(groupAt(at));
      at = add(at, rhythm.duration);
    }
  }
  function boundary(time: Q): Q {
    const group = groupAt(time);
    const start = multiply(pair, q(group));
    if (straight.has(group) || compare(add(start, pair), barLength) > 0) return time;
    const offset = subtract(time, start);
    return add(start, compare(offset, unit) <= 0
      ? multiply(offset, q(4, 3))
      : add(multiply(unit, q(4, 3)), multiply(subtract(offset, unit), q(2, 3))));
  }
  return voices.map((voice) => {
    let at = q(0);
    return voice.rhythms.map((rhythm) => {
      const end = add(at, rhythm.duration);
      const duration = voice.rest ? rhythm.duration : subtract(boundary(end), boundary(at));
      at = end;
      return duration;
    });
  });
}

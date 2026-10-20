import type { Sound } from '../domain';

/** V1 role meaning, not a tuning/difficulty policy: bass < inner < lead.
 * Callers test exact interval overlap separately. Equal cross-role pitches are
 * not a bass foundation beneath an inner voice either. No implicit inversion.
 */
export function roleOrderConflict(a:Pick<Sound,'role'|'soundingMidi'>,b:Pick<Sound,'role'|'soundingMidi'>):boolean {
  const order={bass:0,harmony:1,melody:2};
  return a.role!==b.role&&(order[a.role]-order[b.role])*(a.soundingMidi-b.soundingMidi)<=0;
}

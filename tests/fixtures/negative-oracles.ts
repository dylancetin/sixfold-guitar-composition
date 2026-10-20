import { add, compare, overlaps } from '../../src/domain';
import type { Q, Sound } from '../../src/domain';
import { originalMelody } from './literal-oracles';
import type { ContactOracle } from './literal-oracles';

// Deliberately test-only: these small oracle predicates are NOT the independent product validator.
export function matchesLiteralMelody(sounds: Sound[]): boolean {
  const melody = sounds.filter((s) => s.role === 'melody');
  return melody.length === originalMelody.length && originalMelody.every((expected, index) => {
    const actual = melody[index];
    return actual?.id === expected.id && actual.soundingMidi === expected.pitch &&
      compare(actual.start, expected.start) === 0 && compare(add(actual.start, actual.duration), expected.end) === 0;
  });
}

export function contactOracleErrors(contacts: ContactOracle[]): string[] {
  const errors = new Set<string>();
  for (let i = 0; i < contacts.length; i++) {
    const a = contacts[i]!;
    for (const b of contacts.slice(i + 1)) {
      if (!overlaps(a.start, a.end, b.start, b.end)) continue;
      if (a.string === b.string) errors.add('string-collision');
      if (a.finger > 0 && a.finger === b.finger) errors.add('finger-collision');
    }
  }
  for (const boundary of contacts.flatMap((c) => [c.start, c.end])) {
    const active = contacts.filter((c) => compare(c.start, boundary) <= 0 && compare(boundary, c.end) < 0);
    if (active.filter((c) => c.fret > 0).length > 4) errors.add('too-many-stopped-contacts');
    const frets = active.filter((c) => c.fret > 0).map((c) => c.fret);
    if (frets.length && Math.max(...frets) - Math.min(...frets) > 4) errors.add('stopped-span');
  }
  return [...errors].sort();
}

export function secondsForFourQuarterEntries(bpms: number[]): number {
  return bpms.reduce((seconds, bpm) => seconds + 240 / bpm, 0);
}

export function rationalLabel(value: Q): string {
  return value.d === 1 ? `${value.n}` : `${value.n}/${value.d}`;
}

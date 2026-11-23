import type { SourceEvent } from '../domain';
import { fail } from './common';

type Effect = Extract<SourceEvent, { kind: 'note' }>['effects'][number];

// Opt-in simplification, NOT an ornament-performance decoder. Raw values remain intact.
// Closed `legato`/`shift` slides are resolved separately by explicit endpoints (slides.ts).
const OPEN_SLIDES = new Set(['below', 'above', 'downwards', 'upwards', 'belowdownwards', 'belowupwards', 'abovedownwards', 'aboveupwards', 'belowlegato', 'belowshift', 'abovelegato', 'aboveshift']);
const VIBRATO = new Set(['slight', 'wide']);

export type OrnamentKey = 'slide' | 'leftHandVibrato' | 'vibratoWithTremoloBar' | 'letRing';

/** Returns null when the field is not a simplifiable ornament (callers keep the unsupported effect). */
export function simplifiedOrnament(key: string, value: unknown, location: string): Effect | null {
  if (key === 'slide') {
    if (value === 'legato' || value === 'shift') return null;
    if (typeof value !== 'string' || !OPEN_SLIDES.has(value)) fail(`Unknown slide ${JSON.stringify(value)?.slice(0, 80)} at ${location}; even an opted-in notated-pitch draft cannot silently discard unknown ornament data.`);
  } else if (key === 'leftHandVibrato' || key === 'vibratoWithTremoloBar') {
    if (typeof value !== 'string' || !VIBRATO.has(value)) fail(`Unknown ${key} ${JSON.stringify(value)?.slice(0, 80)} at ${location}; even an opted-in notated-pitch draft cannot silently discard unknown ornament data.`);
  } else if (key === 'letRing') {
    if (value !== true) fail(`Unknown letRing ${JSON.stringify(value)?.slice(0, 80)} at ${location}; even an opted-in notated-pitch draft cannot silently discard unknown ornament data.`);
  } else return null;
  return {
    code: 'source-ornament-simplified', affectsMelody: false,
    description: JSON.stringify({ location, field: key, value, policy: 'explicit-notated-pitch-draft',
      limitation: key === 'slide'
        ? 'Slide-in/slide-out glide intentionally NOT reproduced. The notated destination pitch, onset and exact metrical duration are preserved; this is a simplified melody, not exact expressive source fidelity.'
        : key === 'letRing'
        ? 'Let-ring sustain beyond the written duration intentionally NOT reproduced. The notated pitch, onset and exact metrical duration are preserved; this is a simplified melody, not exact expressive source fidelity.'
        : 'Vibrato intentionally NOT reproduced. The notated pitch, onset and exact metrical duration are preserved; this is a simplified melody, not exact expressive source fidelity.' }),
  };
}

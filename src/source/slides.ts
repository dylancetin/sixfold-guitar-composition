import { compare, eventEnd } from '../domain';
import type { SourceEvent } from '../domain';
import type { RawPart } from './raw';

/** Resolve only closed slides with an explicit contiguous destination on the
 * same source string. The nominal endpoint transcription preserves both notes;
 * it does not synthesize an unspecified continuous pitch-bend curve. */
export function resolveClosedSlides(raw: RawPart, events: SourceEvent[]): number {
  const byRef = new Map(events.flatMap((event) => event.refs.map((ref) => [ref.sourceNoteId, event] as const)));
  let resolved = 0;
  for (const [barIndex, measure] of raw.measures.entries()) {
    for (const [voiceIndex, voice] of measure.voices.entries()) {
      for (const [beatIndex, beat] of voice.beats.entries()) {
        for (const [noteIndex, note] of beat.notes.entries()) {
          if (note.slide !== 'legato' && note.slide !== 'shift') continue;
          const sourceNoteId = `p${raw.partId}:b${barIndex + 1}:v${voiceIndex}:bt${beatIndex}:n${noteIndex}`;
          const event = byRef.get(sourceNoteId);
          if (event?.kind !== 'note') continue;
          const effect = event.effects.find((effect) => effect.code === 'unsupported-slide' && effect.description.endsWith(`at ${sourceNoteId}; original retained in raw.`));
          const nextBar = beatIndex + 1 < voice.beats.length ? barIndex : barIndex + 1;
          const nextBeatIndex = nextBar === barIndex ? beatIndex + 1 : 0;
          const nextMeasure = raw.measures[nextBar];
          const nextVoice = nextMeasure?.voices[voiceIndex];
          const nextBeat = nextVoice?.beats[nextBeatIndex];
          if (!effect || !nextBeat || nextMeasure?.rest || nextVoice?.rest || nextBeat.rest || nextBeat.graceNote || beat.graceNote || note.string === undefined) continue;
          const targets = nextBeat.notes.map((target, index) => ({ target, index })).filter(({ target }) => !target.rest && !target.tie && target.string === note.string && target.fret !== undefined);
          if (targets.length !== 1) continue;
          const target = targets[0]!;
          const targetRef = `p${raw.partId}:b${nextBar + 1}:v${voiceIndex}:bt${nextBeatIndex}:n${target.index}`;
          const destination = byRef.get(targetRef);
          if (destination?.kind !== 'note' || event === destination || compare(eventEnd(event), destination.start)) continue;
          // This is a supported endpoint interpretation, not a generic exemption
          // for slides: unknown/open-ended/orphan slides remain unsupported.
          effect.code = 'articulation-closed-slide';
          effect.affectsMelody = false;
          effect.description = JSON.stringify({ kind: note.slide, sourceNoteId, targetRef, fromMidi: event.soundingMidi, toMidi: destination.soundingMidi, policy: 'explicit-contiguous-slide-endpoints-v1', limitation: 'Nominal note endpoints and timing retained; continuous glide and slide glyph are not reproduced.' });
          resolved++;
        }
      }
    }
  }
  return resolved;
}

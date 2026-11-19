import { z } from 'zod';
import { add, compare, IdSchema, RevisionRefSchema, subtract, TimeSchema } from '../domain';
import type { ScoreV1, SourceScoreV1 } from '../domain';

const SourceSyllableSchema = z.strictObject({
  id: IdSchema, line: z.number().int().min(1).max(5), text: z.string().min(1).max(1024),
  source: z.strictObject({ eventId: IdSchema, beatId: IdSchema, partId: z.number().int().nonnegative(), voiceId: IdSchema, barId: IdSchema }),
  writtenStart: TimeSchema,
});
export type SourceSyllable = z.infer<typeof SourceSyllableSchema>;
export const LyricsReviewSchema = z.strictObject({
  status: z.literal('model-aligned-draft'), coverage: z.enum(['partial', 'complete']),
  note: z.string().min(1).max(2000), sourceUrl: z.url().refine(url => /^https?:\/\//.test(url)),
});
export const PreviewLyricsSchema = z.strictObject({
  sourceRevision: RevisionRefSchema, scoreRevision: RevisionRefSchema,
  review: LyricsReviewSchema.optional(),
  syllables: z.array(SourceSyllableSchema.extend({
    soundId: IdSchema, segmentId: IdSchema,
    occurrences: z.array(z.strictObject({ occurrenceId: IdSchema, start: TimeSchema })).min(1),
  })).max(20_000),
});
export type PreviewLyrics = z.infer<typeof PreviewLyricsSchema>;
const sameRevision = (a: { id: string; digest: string }, b: { id: string; digest: string }) => a.id === b.id && a.digest === b.digest;

export function mapLyricsToScore(source: SourceScoreV1, score: ScoreV1, syllables: SourceSyllable[]): PreviewLyrics {
  if (!sameRevision(source.revision, score.source.revision) || !sameRevision(source.revision, score.selection.sourceRevision)) throw new Error('Lyrics source revision mismatch');
  return PreviewLyricsSchema.parse({
    sourceRevision: score.source.revision, scoreRevision: { id: score.revision.id, digest: score.revision.digest },
    syllables: syllables.flatMap(syllable => {
      const event = source.events.find(e => e.id === syllable.source.eventId && e.kind === 'note');
      const selected = score.selection.sections.some(section => section.selectors.some(selector => selector.partId === syllable.source.partId && selector.voiceId === syllable.source.voiceId && selector.eventIds.includes(syllable.source.eventId)));
      // Normalization keeps the attack's chord refs first and appends tied continuations.
      // All simultaneous chord members share this beat coordinate; later refs do not.
      const attack = event?.refs[0];
      if (!event || !attack || !selected || compare(event.start, syllable.writtenStart) || attack.beatId !== syllable.source.beatId || attack.partId !== syllable.source.partId || attack.voiceId !== syllable.source.voiceId || attack.barId !== syllable.source.barId) return [];
      const sounds = score.sounds.filter(sound => sound.role === 'melody' && sound.provenance.kind === 'source' && sound.provenance.eventIds.includes(event.id) && compare(sound.start, syllable.writtenStart) === 0);
      if (sounds.length !== 1) return [];
      const sound = sounds[0]!;
      const segments = score.notation.filter(segment => segment.kind === 'note' && segment.eventId === sound.id && segment.barId === syllable.source.barId && compare(segment.start, syllable.writtenStart) === 0);
      if (segments.length !== 1) return [];
      const segment = segments[0]!;
      const occurrences = score.occurrences.filter(o => o.writtenBarId === segment.barId).map(o => ({ occurrenceId: o.id, start: add(o.start, subtract(segment.start, score.bars.find(b => b.id === o.writtenBarId)!.start)) }));
      return occurrences.length ? [{ ...syllable, soundId: sound.id, segmentId: segment.id, occurrences }] : [];
    }),
  });
}

/** Display data is optional and must never make a valid score unrenderable. */
export function lyricsForScore(score: ScoreV1, input?: PreviewLyrics): PreviewLyrics['syllables'] {
  const parsed = PreviewLyricsSchema.safeParse(input);
  if (!parsed.success || !sameRevision(parsed.data.sourceRevision, score.source.revision) || !sameRevision(parsed.data.scoreRevision, score.revision)) return [];
  return parsed.data.syllables.filter(syllable => {
    const sound = score.sounds.find(s => s.id === syllable.soundId && s.role === 'melody');
    const segment = score.notation.find(s => s.id === syllable.segmentId && s.eventId === sound?.id && s.kind === 'note' && s.barId === syllable.source.barId && compare(s.start, syllable.writtenStart) === 0);
    if (!sound || !segment || sound.provenance.kind !== 'source' || !sound.provenance.eventIds.includes(syllable.source.eventId) || compare(sound.start, syllable.writtenStart)) return false;
    if (!score.selection.sections.some(section => section.selectors.some(s => s.partId === syllable.source.partId && s.voiceId === syllable.source.voiceId && s.eventIds.includes(syllable.source.eventId)))) return false;
    const occurrences = score.occurrences.filter(o => o.writtenBarId === segment.barId);
    return occurrences.length === syllable.occurrences.length && occurrences.every(o => {
      const matching = syllable.occurrences.filter(a => a.occurrenceId === o.id);
      return matching.length === 1 && compare(matching[0]!.start, add(o.start, subtract(segment.start, score.bars.find(b => b.id === segment.barId)!.start))) === 0;
    });
  });
}

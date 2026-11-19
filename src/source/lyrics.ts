import { z } from 'zod';
import type { SourceScoreV1 } from '../domain';
import type { SourceSyllable } from '../lyrics';
import { rawBeatId } from './common';

export const LyricPartSchema = z.object({
  songId: z.number().int().positive(), revisionId: z.number().int().positive(), partId: z.number().int().nonnegative(),
  version: z.number().int().positive().optional(),
  newLyrics: z.array(z.object({ text: z.string().max(100_000), line: z.number().int().min(1).max(5), offset: z.number().int().nonnegative() })).max(10).optional(),
  measures: z.array(z.object({ voices: z.array(z.object({ beats: z.array(z.object({
    rest: z.boolean().optional(), graceNote: z.string().nullable().optional(),
    notes: z.array(z.object({ tie: z.boolean().optional() })).min(1).max(128),
  })).max(4096) })).min(1).max(16) })).max(1000),
});
type Token = { kind: 'syllable'; text: string; position: number } | { kind: 'separator'; newline: boolean };

// Separators are individual slots, not whitespace-delimited words. In particular,
// two spaces reserve one blank beat, whereas a newline never reserves that slot.
function tokens(text: string): Token[] {
  const result: Token[] = [];
  const input = `${text.replace(/\t/g, ' ').replace(/-—–/g, '-').replace(/__+/g, '_').replace(/_/g, '\u00a0')}\n`;
  let position = 0;
  for (const match of input.matchAll(/\[.*?\]|\s?-\s?|\r\n|\n|\s/g)) {
    const index = match.index;
    const separator = match[0];
    if (index > position) {
      let word = input.slice(position, index).replace(/^.*]/, '').replace(/[()]/g, '');
      if (separator.includes('-') && !separator.startsWith('[')) word += '-';
      result.push({ kind: 'syllable', text: word.replace(/\+/g, ' '), position });
    }
    position = index + separator.length;
    if (!separator.startsWith('[')) result.push({ kind: 'separator', newline: separator.includes('\n') });
  }
  return result;
}

export function anchorSourceLyrics(raw: z.infer<typeof LyricPartSchema>, source: SourceScoreV1): SourceSyllable[] {
  const result: SourceSyllable[] = [];
  // The source uses a second set of five blocks when present, not both sets.
  const lines = (raw.newLyrics ?? []).slice((raw.newLyrics?.length ?? 0) > 5 ? 5 : 0);
  for (const line of lines) {
    const stream = tokens(line.text);
    let cursor = 0, previous: Token | undefined;
    for (const [barIndex, measure] of raw.measures.entries()) {
      if (barIndex < Math.max(1, line.offset) - 1) continue;
      for (const [beatIndex, beat] of measure.voices[0]!.beats.entries()) {
        if (beat.rest || beat.graceNote) continue;
        let syllable: Extract<Token, { kind: 'syllable' }> | undefined;
        while (cursor < stream.length) {
          const token = stream[cursor]!;
          if (token.kind === 'syllable') {
            // A tie extends the previous syllable. Leave the next word for the
            // next attack. Slides and hammer/pulls do consume a new syllable.
            if (beat.notes.every(note => note.tie)) break;
            syllable = token; cursor++; previous = token; break;
          }
          cursor++;
          const blank = previous?.kind === 'separator' && !previous.newline;
          previous = token;
          if (blank) break;
        }
        if (!syllable?.text.trim()) continue;
        const beatId = rawBeatId(raw.partId, barIndex, 0, beatIndex);
        const events = source.events.filter(event => event.kind === 'note' && event.partId === raw.partId && event.refs[0]?.beatId === beatId);
        for (const event of events) {
          const ref = event.refs[0]!;
          result.push({ id: `lyric:${raw.partId}:${line.line}:${syllable.position}:${event.id}`, line: line.line, text: syllable.text,
            source: { eventId: event.id, beatId, partId: raw.partId, voiceId: ref.voiceId, barId: ref.barId }, writtenStart: event.start });
        }
      }
    }
  }
  return result;
}

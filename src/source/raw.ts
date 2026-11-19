import { z } from 'zod';
import { fail } from './common';

const positiveId = z.number().int().positive().max(2_147_483_647);
const partId = z.number().int().min(0).max(4095);
const midi = z.number().int().min(0).max(127);
const tuning = z.array(midi).min(1).max(16);
const flag = z.boolean().optional();
export const MetadataTrackSchema = z.looseObject({
  partId, name: z.string().max(1024).optional(), title: z.string().max(1024).optional(),
  instrumentId: z.number().int().min(0).max(4095).optional(), tuning: tuning.optional(),
  isVocalTrack: flag, isDrums: flag,
});
export const MetadataSchema = z.looseObject({
  songId: positiveId, revisionId: positiveId, image: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  title: z.string().min(1).max(2048), artist: z.string().min(1).max(2048),
  tracks: z.array(MetadataTrackSchema).min(1).max(32).refine((tracks) => new Set(tracks.map((t) => t.partId)).size === tracks.length),
  hasPlayer: z.boolean(), isBlocked: z.boolean(), isRestricted: z.boolean(), restriction: z.string().max(4096),
  defaultTrack: partId.optional(),
});
const Whole = z.tuple([z.number().int().positive().max(1_000_000_000), z.number().int().positive().max(1_000_000_000)]);
export const RawNoteSchema = z.looseObject({
  string: z.number().int().min(-1).max(31).optional(), fret: midi.optional(), rest: flag, tie: flag,
  hp: flag, staccato: flag,
  slide: z.string().max(64).optional(),
});
export const RawBeatSchema = z.looseObject({
  duration: Whole, type: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32), z.literal(64)]).optional(),
  dots: z.number().int().min(0).max(3).optional(), dotted: flag,
  tuplet: z.number().int().min(2).max(16).optional(), tupletStart: flag, tupletStop: flag,
  graceNote: z.enum(['beforeBeat', 'onBeat']).nullable().optional(),
  // Printed label/layout metadata only; never a replacement for explicit notes.
  chord: z.strictObject({ text: z.string().max(1024), width: z.number().finite().nonnegative().max(10000).optional() }).optional(),
  rest: flag, notes: z.array(RawNoteSchema).min(1).max(128),
});
const VoiceSchema = z.looseObject({ rest: flag, beats: z.array(RawBeatSchema).max(4096) });
const TempoSchema = z.looseObject({
  measure: z.number().int().nonnegative().max(9999), position: z.number().int().nonnegative().max(4096).default(0),
  type: z.number().int().positive().max(64).default(4), bpm: z.number().finite().positive().max(400), linear: flag,
});
export const RawMeasureSchema = z.looseObject({
  signature: z.tuple([z.number().int().positive().max(32), z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32)])]).optional(),
  voices: z.array(VoiceSchema).min(1).max(16), rest: flag, repeatStart: flag,
  repeat: z.number().int().min(0).max(16).optional(), repeatCount: z.number().int().min(0).max(16).optional(),
});
export const RawPartSchema = z.looseObject({
  songId: positiveId, revisionId: positiveId, partId,
  version: z.union([z.literal(5), z.literal(8)]).optional(), name: z.string().max(1024).optional(), title: z.string().max(1024).optional(),
  instrumentId: z.number().int().min(0).max(4095).optional(), tuning: tuning.optional(), tuningFlat: flag,
  // Banjo-style short drone string. Only an explicit false (no drone) is interpretable.
  tuningShortDrone: flag,
  capo: z.number().int().nonnegative().max(24).nullable().optional(),
  grandStaffGroup: z.number().int().nonnegative().max(4095).optional(),
  // Songsterr marks an opening pickup bar; its exact length comes from source beats.
  anacrusis: flag,
  measures: z.array(RawMeasureSchema).min(1).max(1000),
  automations: z.looseObject({ tempo: z.array(TempoSchema).min(1).max(1000) }),
});
export type Metadata = z.infer<typeof MetadataSchema>;
export type MetadataTrack = z.infer<typeof MetadataTrackSchema>;
export type RawPart = z.infer<typeof RawPartSchema>;
export type RawBeat = z.infer<typeof RawBeatSchema>;

export function parseBoundary<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    fail(`${label} schema drift/invalid data at ${issue?.path.join('.')}: ${issue?.message}. No partial pitched score accepted.`);
  }
  return result.data;
}
export function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return fail('Source contains invalid JSON.'); }
}
export function checkRestrictions(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const v = value as Record<string, unknown>;
  if (v.isBlocked === true || v.isRestricted === true || v.hasPlayer === false || v.isPrivate === true || (v.restriction !== undefined && v.restriction !== '')) {
    fail('Source declares blocked/restricted/private/unavailable player access; stopped. Supply an authorized structured file.', 'restricted', 'restricted-source');
  }
}
export async function metadataFromPage(html: string): Promise<Metadata> {
  const chunks: string[] = [];
  let count = 0;
  await new HTMLRewriter().on('script#state', { element() { count++; }, text(chunk) { chunks.push(chunk.text); } }).transform(new Response(html)).text();
  if (count !== 1 || !chunks.length) fail('Public page has no unique script#state; no scraping fallback attempted.');
  const state = parseBoundary(z.object({ meta: z.object({ current: z.unknown() }) }), parseJson(chunks.join('')), 'Page state');
  checkRestrictions(state.meta.current);
  return parseBoundary(MetadataSchema, state.meta.current, 'Page metadata/restriction flags');
}

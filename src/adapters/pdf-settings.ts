import { z } from 'zod';

/** Layout only: these settings cannot alter any canonical musical event. */
export const PdfLayoutSettingsSchema = z.strictObject({
  spacing: z.enum(['normal', 'compact', 'tight']).default('normal'),
  barsPerRow: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  scale: z.union([z.literal(.5), z.literal(.65), z.literal(.75), z.literal(.85), z.literal(1), z.literal(1.25), z.literal(1.5)]).default(1),
  fretMode: z.enum(['relative', 'absolute']).default('relative'),
  showFingerNumbers: z.boolean().default(false),
  showMeasureLabels: z.boolean().default(false),
  tabOnly: z.boolean().default(false),
});
export type PdfLayoutSettings = z.infer<typeof PdfLayoutSettingsSchema>;

export function pdfLayoutQuery(input: unknown): string {
  const settings = PdfLayoutSettingsSchema.parse(input);
  return new URLSearchParams(Object.entries(settings).map(([key, value]) => [key, String(value)])).toString();
}

export function parsePdfLayoutQuery(params: URLSearchParams): PdfLayoutSettings {
  const input: Record<string, unknown> = Object.create(null);
  for (const [key, value] of params) {
    if (Object.hasOwn(input, key)) throw new Error('Duplicate PDF layout setting');
    input[key] = key === 'scale' || key === 'barsPerRow' ? Number(value)
      : key === 'showFingerNumbers' || key === 'showMeasureLabels' || key === 'tabOnly' ? value === 'true' ? true : value === 'false' ? false : value : value;
  }
  return PdfLayoutSettingsSchema.parse(input);
}

import { expect, test } from 'bun:test';
import { parsePdfLayoutQuery, PdfLayoutSettingsSchema, pdfLayoutQuery } from '../../src/adapters/pdf-settings';

test('measure labels are hidden by default and the PDF audit option round-trips strictly', () => {
  expect(PdfLayoutSettingsSchema.parse({}).showMeasureLabels).toBe(false);
  expect(parsePdfLayoutQuery(new URLSearchParams()).showMeasureLabels).toBe(false);
  for (const showMeasureLabels of [false, true]) {
    const settings = PdfLayoutSettingsSchema.parse({ showMeasureLabels });
    expect(parsePdfLayoutQuery(new URLSearchParams(pdfLayoutQuery(settings)))).toEqual(settings);
  }
  for (const query of ['showMeasureLabels=1', 'showMeasureLabels=yes', 'showMeasureLabels=true&showMeasureLabels=false']) {
    expect(() => parsePdfLayoutQuery(new URLSearchParams(query))).toThrow();
  }
});

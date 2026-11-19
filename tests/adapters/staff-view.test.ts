import { expect, test } from 'bun:test';
import * as at from '@coderline/alphatab';
import { createAlphaTabScore } from '../../src/adapters';
import { hideCollidingTabRests } from '../../src/adapters/alpha-tab';
import { q } from '../../src/domain';
import { parsePdfLayoutQuery, PdfLayoutSettingsSchema, pdfLayoutQuery } from '../../src/adapters/pdf-settings';
import { study } from './fixture';

const TREBLE_CLEF = '&#57424;', TAB_CLEF = '&#57453;';

test('staff view switches notes/TAB/both without changing mappings, frets or timing', async () => {
  const { score } = await study(2, 2, 2);
  const original = JSON.stringify(score);
  const both = createAlphaTabScore(score, { notationMode: 'unfolded', showFingerNumbers: true });
  const tab = createAlphaTabScore(score, { notationMode: 'unfolded', showFingerNumbers: true, staves: 'tab' });
  const notes = createAlphaTabScore(score, { notationMode: 'unfolded', showFingerNumbers: true, staves: 'notation' });
  expect(createAlphaTabScore(score, { notationMode: 'unfolded', showFingerNumbers: true, staves: 'both' }).projection).toEqual(both.projection);
  expect(both.projection.engraving.staffAndTab).toBe(true);
  for (const single of [tab, notes]) {
    expect(single.projection.engraving.staffAndTab).toBe(false);
    expect({ ...single.projection, engraving: { ...single.projection.engraving, staffAndTab: true } }).toEqual(both.projection);
    expect(single.placements).toEqual(both.placements);
  }
  const [bothLayout, tabLayout, notesLayout] = [await both.renderSvg(), await tab.renderSvg(), await notes.renderSvg()];
  const svg = (layout: typeof bothLayout) => layout.fragments.map(f => f.svg).join('');
  const bothSvg = svg(bothLayout), tabSvg = svg(tabLayout), notesSvg = svg(notesLayout);
  expect(bothSvg).toContain(TREBLE_CLEF); expect(bothSvg).toContain(TAB_CLEF);
  expect(tabSvg).not.toContain(TREBLE_CLEF); expect(tabSvg).toContain(TAB_CLEF);
  expect(notesSvg).toContain(TREBLE_CLEF); expect(notesSvg).not.toContain(TAB_CLEF);
  // Every performed beat stays clickable/cursor-addressable in single-staff layouts.
  for (const layout of [tabLayout, notesLayout]) {
    expect(layout.beats.length).toBe(bothLayout.beats.length);
    expect(layout.height).toBeLessThan(bothLayout.height);
  }
  // Finger numbers are drawn only beside staff notes.
  const fingers = (text: string) => text.match(/&#606(?:8[89]|9[0-2]);/g) ?? [];
  expect(fingers(tabSvg)).toHaveLength(0);
  expect(fingers(notesSvg).length).toBe(fingers(bothSvg).length);
  expect(fingers(bothSvg).length).toBeGreaterThan(0);
  // Notes-only drops the TAB fret caption.
  expect(notesSvg).not.toContain('frets relative to capo'); expect(bothSvg).toContain('frets relative to capo');
  expect(JSON.stringify(score)).toBe(original);
});

test('staff view PDF option defaults to both and round-trips strictly', () => {
  expect(PdfLayoutSettingsSchema.parse({}).staves).toBe('both');
  expect(parsePdfLayoutQuery(new URLSearchParams()).staves).toBe('both');
  for (const staves of ['both', 'notation', 'tab'] as const) {
    const settings = PdfLayoutSettingsSchema.parse({ staves });
    expect(parsePdfLayoutQuery(new URLSearchParams(pdfLayoutQuery(settings)))).toEqual(settings);
  }
  for (const query of ['staves=1', 'staves=notes', 'staves=TAB', 'staves=tab&staves=both', 'tabOnly=true']) expect(() => parsePdfLayoutQuery(new URLSearchParams(query))).toThrow();
});

test('TAB-only keeps one rest per fully silent span and hides rests under another voice', () => {
  const beat = (notes: number) => { const b = new at.model.Beat(); for (let i = 0; i < notes; i++) b.addNote(new at.model.Note()); return b; };
  const span = (lane: number, from: number, to: number, notes = 0) => ({ beat: beat(notes), lane, start: q(from), end: q(to) });
  const melodyNote = span(0, 0, 1, 1), melodyRest = span(0, 1, 2), bassRest = span(1, 0, 2);
  const silentMelody = span(0, 2, 4), silentBass = span(1, 2, 4), bassNote = span(1, 4, 5, 1), melodyRestOverBass = span(0, 4, 5);
  const beats = [melodyNote, melodyRest, silentMelody, melodyRestOverBass, bassRest, silentBass, bassNote];
  hideCollidingTabRests(beats);
  const hidden = (b: typeof melodyNote) => b.beat.style?.colors.get(at.model.BeatSubElement.GuitarTabRests)?.a === 0;
  expect(hidden(bassRest)).toBe(true); // overlaps the melody's first note
  expect(hidden(melodyRest)).toBe(false); // nothing else sounds in beat 2
  expect(hidden(silentMelody)).toBe(false); expect(hidden(silentBass)).toBe(true); // one mark per silence
  expect(hidden(melodyRestOverBass)).toBe(true);
  expect(hidden(melodyNote) || hidden(bassNote)).toBe(false);
});

test('hidden TAB rests leave no glyphs in the SVG used by the viewer and PDF', async () => {
  const { score } = await study(2, 2, 2);
  const svg = (await createAlphaTabScore(score, { notationMode: 'unfolded', staves: 'tab' }).renderSvg()).fragments.map(f => f.svg).join('');
  expect(svg).not.toContain('rgba(0,0,0,0)');
});

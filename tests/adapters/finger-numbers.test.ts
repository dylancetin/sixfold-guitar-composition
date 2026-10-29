import { expect, test } from 'bun:test';
import { createAlphaTabScore } from '../../src/adapters';
import { stamp, study } from './fixture';

test('preview finger numbers match canonical left-hand placements, including opens, ties and capo numbering', async () => {
  for (const capo of [0, 2] as const) {
    const { score } = await study(2, capo, capo);
    score.placements.find(p => p.fret > 0 && p.finger === 3)!.finger = 4;
    await stamp(score);
    const original = JSON.stringify(score);
    const baseline = createAlphaTabScore(score, { notationMode: 'unfolded' });
    const hidden = (await baseline.renderSvg()).fragments.map(f => f.svg).join('');
    expect(hidden.match(/&#606(?:8[89]|9[0-2]);/g) ?? []).toHaveLength(0);
    const expected = score.occurrences.flatMap(occurrence => score.notation
      .filter(segment => segment.kind === 'note' && segment.barId === occurrence.writtenBarId)
      .map(segment => {
        const performed = score.performedSounds.find(p => p.soundId === segment.eventId && p.occurrenceIds.includes(occurrence.id))!;
        return score.placements.find(p => p.id === performed.placementId)!.finger;
      }));
    for (const fretMode of ['relative', 'absolute'] as const) {
      const shown = createAlphaTabScore(score, { showFingerNumbers: true, fretMode, spacing: 'tight', barsPerRow: 3, notationMode: 'unfolded' });
      expect(shown.projection).toEqual(baseline.projection);
      expect(shown.placements).toEqual(baseline.placements.map(p => ({ ...p, displayedFret: p.relativeFret + (fretMode === 'absolute' ? capo : 0) })));
      const svg = (await shown.renderSvg()).fragments.map(f => f.svg).join('');
      for (const finger of [0, 1, 2, 3, 4]) {
        expect(svg.split(`&#${60688 + finger};`).length - 1).toBe(expected.filter(f => f === finger).length);
      }
      // Open strings must never turn into alphaTab's thumb symbol.
      expect(svg).not.toContain('&#60696;');
    }
    expect(JSON.stringify(score)).toBe(original);
  }
});

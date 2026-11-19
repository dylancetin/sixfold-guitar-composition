import { expect, test } from 'bun:test';
import { createAlphaTabScore, compileTimeline } from '../../src/adapters';
import { encodeMidi } from '../../src/adapters/midi';
import { lyricsForScore, mapLyricsToScore } from '../../src/lyrics';
import type { SourceSyllable } from '../../src/lyrics';
import { study } from './fixture';

test('native SVG engraves selected syllables once beneath staff, with exact folded and unfolded pass mappings', async () => {
  const { source, score } = await study(3);
  const before = JSON.stringify(score), midi = encodeMidi(compileTimeline(score));
  const syllables: SourceSyllable[] = source.events.filter(e => ['src-m0', 'src-m1', 'src-m4'].includes(e.id)).map((event, i) => {
    const ref = event.refs[0]!;
    return { id: `original-${i}`, line: 1, text: ['Lan-', 'tern', 'home'][i]!, source: { eventId: event.id, beatId: ref.beatId, barId: ref.barId, partId: ref.partId, voiceId: ref.voiceId }, writtenStart: event.start };
  });
  const lyrics = mapLyricsToScore(source, score, syllables);
  expect(lyrics.syllables.at(-1)!.segmentId).toBe('n4a');
  expect(lyrics.syllables.at(-1)!.occurrences.map(o => o.occurrenceId)).toEqual(['o1-p1', 'o1-p2', 'o1-p3']);
  const folded = createAlphaTabScore(score, { lyrics, spacing: 'tight', barsPerRow: 2 });
  const hidden = createAlphaTabScore(score);
  expect(folded.projection).toEqual(hidden.projection);
  expect(folded.lyricPlacements).toHaveLength(3);
  expect(folded.lyricPlacements.every(p => p.occurrenceIds.length === 3)).toBe(true);
  const layout = await folded.renderSvg();
  const svg = layout.fragments.map(f => f.svg).join('');
  for (const placement of folded.lyricPlacements) {
    const text = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]+)<\/text>/g)].filter(m => m[3] === placement.text);
    expect(text).toHaveLength(1);
    const beat = layout.beats.find(b => b.nativeBeatId === placement.nativeBeatId)!;
    expect(Number(text[0]![1])).toBeCloseTo(beat.cursorX);
  }
  const lyricsY = Number(svg.match(/<text x="[\d.]+" y="([\d.]+)"[^>]*>Lan-<\/text>/)![1]);
  const fragment = layout.fragments.find(f => f.svg.includes('>Lan-</text>'))!;
  const lyricBeat = layout.beats.find(b => b.nativeBeatId === folded.lyricPlacements[0]!.nativeBeatId)!;
  expect(lyricsY + fragment.y).toBeGreaterThan(lyricBeat.bounds.y + lyricBeat.bounds.h);
  const tabY = Number(svg.match(/<text x="[\d.]+" y="([\d.]+)" style='[^']*14px Arial[^']*'>0<\/text>/)![1]);
  expect(lyricsY).toBeLessThan(tabY);
  expect((await hidden.renderSvg()).fragments.map(f => f.svg).join('')).not.toContain('Lan-');
  const unfolded = createAlphaTabScore(score, { lyrics, notationMode: 'unfolded', barsPerRow: 2 });
  expect(unfolded.lyricPlacements).toHaveLength(9);
  const unfoldedSvg = (await unfolded.renderSvg()).fragments.map(f => f.svg).join('');
  expect(unfoldedSvg.split('>home</text>').length - 1).toBe(3);
  expect(folded.lyricPlacements.filter(p => p.text === 'home')).toHaveLength(1);
  expect(encodeMidi(compileTimeline(score))).toEqual(midi);
  expect(JSON.stringify(score)).toBe(before);
});

test('optional display lyrics reject wrong source, score, onset, role and repeat aliases without breaking notation', async () => {
  const { source, score } = await study(2);
  const event = source.events[0]!, ref = event.refs[0]!;
  const lyrics = mapLyricsToScore(source, score, [{ id: 'fixture', text: 'Light', line: 1, source: { eventId: event.id, beatId: ref.beatId, partId: ref.partId, voiceId: ref.voiceId, barId: ref.barId }, writtenStart: event.start }]);
  for (const corrupt of [
    (input: typeof lyrics) => { input.sourceRevision.id = 'wrong'; },
    (input: typeof lyrics) => { input.sourceRevision.digest = 'a'.repeat(64); },
    (input: typeof lyrics) => { input.scoreRevision.id = 'wrong'; },
    (input: typeof lyrics) => { input.scoreRevision.digest = 'a'.repeat(64); },
    (input: typeof lyrics) => { input.syllables[0]!.writtenStart = { n: 1, d: 1 }; },
    (input: typeof lyrics) => { input.syllables[0]!.soundId = 'bass0'; },
    (input: typeof lyrics) => { input.syllables[0]!.occurrences[1]!.start = { n: 0, d: 1 }; },
  ]) {
    const input = structuredClone(lyrics); corrupt(input);
    expect(lyricsForScore(score, input)).toEqual([]);
    expect(createAlphaTabScore(score, { lyrics: input }).lyricPlacements).toEqual([]);
  }
  const multipleLines = structuredClone(lyrics);
  multipleLines.syllables.push({ ...multipleLines.syllables[0]!, id: 'second-verse', line: 2, text: 'Glow' });
  const notation = createAlphaTabScore(score, { lyrics: multipleLines });
  expect(notation.lyricPlacements).toHaveLength(2);
  expect(notation.lyricPlacements[0]!.nativeBeatId).toBe(notation.lyricPlacements[1]!.nativeBeatId);
  const svg = (await notation.renderSvg()).fragments.map(f => f.svg).join('');
  const coordinates = (text: string) => svg.match(new RegExp(`<text x="([\\d.]+)" y="([\\d.]+)"[^>]*>${text}</text>`))!.slice(1).map(Number);
  const first = coordinates('Light'), second = coordinates('Glow');
  expect(second[0]).toBe(first[0]); expect(second[1]!).toBeGreaterThan(first[1]!);
});

test('crowded lyric rows wrap without losing beat mappings and wider renders restore the requested layout', async () => {
  const { source, score } = await study(3);
  const syllables: SourceSyllable[] = source.events.filter(e => ['src-m0', 'src-m1', 'src-m4'].includes(e.id)).map((event, i) => {
    const ref = event.refs[0]!;
    return { id: `spacing-${i}`, line: 1, text: ['Lanternlight', 'Homeward', 'Glow'][i]!,
      source: { eventId: event.id, beatId: ref.beatId, barId: ref.barId, partId: ref.partId, voiceId: ref.voiceId }, writtenStart: event.start };
  });
  const notation = createAlphaTabScore(score, { lyrics: mapLyricsToScore(source, score, syllables), barsPerRow: 2 });
  const narrow = await notation.renderSvg(350);
  expect(narrow.systems.map(system => system.bars)).toEqual([[0], [1]]);
  const first = narrow.beats.find(beat => beat.nativeBeatId === notation.lyricPlacements[0]!.nativeBeatId)!;
  const second = narrow.beats.find(beat => beat.nativeBeatId === notation.lyricPlacements[1]!.nativeBeatId)!;
  expect(second.cursorX - first.cursorX).toBeGreaterThan(110);
  expect(notation.projection.mapping.every(mapping => narrow.beats.some(beat => beat.nativeBeatId === mapping.nativeBeatId && beat.occurrenceId === mapping.occurrenceId))).toBe(true);
  const wide = await notation.renderSvg(1500);
  expect(wide.width).toBe(1500);
  expect(wide.systems.map(system => system.bars)).toEqual([[0, 1]]);
  expect(await notation.renderSvg(350)).toEqual(narrow);
});

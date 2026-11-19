import { expect, test } from 'bun:test';
import { q } from '../../src/domain';
import { anchorSourceLyrics, LyricPartSchema } from '../../src/source/lyrics';
import { normalizePart, normalizeStructure } from '../../src/source/normalize';
import { RawPartSchema } from '../../src/source/raw';
import { source as originalSource } from '../fixtures/original';

function fixture(text: string, change: (raw: ReturnType<typeof RawPartSchema.parse>) => void = () => {}) {
  const raw = RawPartSchema.parse({
    songId: 1, revisionId: 2, partId: 0, version: 8, tuning: [64],
    newLyrics: [{ line: 1, offset: 1, text }], automations: { tempo: [{ measure: 0, bpm: 80 }] },
    measures: Array.from({ length: 4 }, () => ({ signature: [4, 4], voices: [{ beats: Array.from({ length: 4 }, () => ({ duration: [1, 4], notes: [{ string: 0, fret: 0 }] })) }] })),
  });
  change(raw);
  const { bars } = normalizeStructure(raw);
  const { part, events } = normalizePart({ partId: 0, name: 'Original lyric study' }, raw, bars);
  const source = { ...structuredClone(originalSource), parts: [part], bars, events };
  return { raw, source, syllables: anchorSourceLyrics(LyricPartSchema.parse(raw), source) };
}
const positions = (text: string) => fixture(text).syllables.map(s => [s.text, s.source.beatId]);

test('syllable delimiters preserve hyphens, every extra space, plus signs, comments and line boundaries', () => {
  expect(positions('Lan-tern  light')).toEqual([['Lan-', 'p0:b1:v0:bt0'], ['tern', 'p0:b1:v0:bt1'], ['light', 'p0:b1:v0:bt3']]);
  expect(positions('One   two')).toEqual([['One', 'p0:b1:v0:bt0'], ['two', 'p0:b1:v0:bt3']]);
  expect(positions('One\n two')).toEqual([['One', 'p0:b1:v0:bt0'], ['two', 'p0:b1:v0:bt1']]);
  expect(positions('blue+sky [aside]rise () home')).toEqual([['blue sky', 'p0:b1:v0:bt0'], ['rise', 'p0:b1:v0:bt1'], ['home', 'p0:b1:v0:bt3']]);
  expect(positions('One [aside] two')).toEqual([['One', 'p0:b1:v0:bt0'], ['two', 'p0:b1:v0:bt2']]);
  expect(positions('One[aside]two')).toEqual([['One', 'p0:b1:v0:bt0'], ['two', 'p0:b1:v0:bt1']]);
  expect(positions('One _ two')).toEqual([['One', 'p0:b1:v0:bt0'], ['two', 'p0:b1:v0:bt3']]);
  expect(positions('One - two')).toEqual([['One-', 'p0:b1:v0:bt0'], ['two', 'p0:b1:v0:bt1']]);
  expect(positions('  One\t two')).toEqual([['One', 'p0:b1:v0:bt1'], ['two', 'p0:b1:v0:bt3']]);
});

test('rests and grace notes consume nothing, ties extend syllables, slide and hp attacks consume normally', () => {
  const { syllables } = fixture('One two three four', raw => {
    const beats = raw.measures[0]!.voices[0]!.beats;
    beats[0]!.rest = true; beats[0]!.notes = [{ rest: true }];
    beats[2]!.notes[0]!.tie = true;
    beats[3]!.notes[0]!.hp = true;
    raw.measures[1]!.voices[0]!.beats[0]!.notes[0]!.slide = 'shift';
  });
  expect(syllables.map(s => [s.text, s.source.beatId, s.writtenStart])).toEqual([
    ['One', 'p0:b1:v0:bt1', q(1)], ['two', 'p0:b1:v0:bt3', q(3)],
    ['three', 'p0:b2:v0:bt0', q(4)], ['four', 'p0:b2:v0:bt1', q(5)],
  ]);
  const grace = fixture('One two', raw => {
    raw.measures[0]!.voices[0]!.beats.splice(1, 0, { duration: [1, 16], graceNote: 'beforeBeat', notes: [{ string: 0, fret: 2 }] });
  });
  expect(grace.syllables.map(s => [s.text, s.source.beatId, s.writtenStart])).toEqual([
    ['One', 'p0:b1:v0:bt0', q(0)], ['two', 'p0:b1:v0:bt2', q(1)],
  ]);
});

test('timing comes from normalized swing events and one-based lyric offset, not raw duration sums', () => {
  const { syllables } = fixture('One two', raw => {
    raw.newLyrics = [{ line: 1, offset: 2, text: 'One two' }];
    raw.measures[1]!.tripletFeel = '8th';
    raw.measures[1]!.voices[0]!.beats = Array.from({ length: 8 }, () => ({ duration: [1, 8], notes: [{ string: 0, fret: 0 }] }));
  });
  expect(syllables.map(s => [s.source.beatId, s.writtenStart])).toEqual([
    ['p0:b2:v0:bt0', q(4)], ['p0:b2:v0:bt1', q(14, 3)],
  ]);
});

test('blank beats can consume separators across a tie without moving the next word', () => {
  const { syllables } = fixture('One  two three', raw => { raw.measures[0]!.voices[0]!.beats[1]!.notes[0]!.tie = true; });
  expect(syllables.map(s => [s.text, s.source.beatId])).toEqual([
    ['One', 'p0:b1:v0:bt0'], ['two', 'p0:b1:v0:bt2'], ['three', 'p0:b1:v0:bt3'],
  ]);
});

test('verse lines retain independent one-based offsets and source beat anchors', () => {
  const { syllables } = fixture('', raw => {
    raw.newLyrics = [{ line: 1, offset: 1, text: 'One two' }, { line: 2, offset: 2, text: 'Blue sky' }];
  });
  expect(syllables.map(s => [s.line, s.text, s.source.beatId, s.writtenStart])).toEqual([
    [1, 'One', 'p0:b1:v0:bt0', q(0)], [1, 'two', 'p0:b1:v0:bt1', q(1)],
    [2, 'Blue', 'p0:b2:v0:bt0', q(4)], [2, 'sky', 'p0:b2:v0:bt1', q(5)],
  ]);
});

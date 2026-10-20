// Acceptance logic deliberately imports no alphaTab or engraving adapter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMidi } from 'midi-file';
import toneMidi from '@tonejs/midi';
const { Midi } = toneMidi;

export const expected = JSON.parse(fs.readFileSync(new URL('fixtures/expected.json', import.meta.url)));
const rational = s => {
  const [n, d = 1] = s.split('/').map(Number);
  assert(Number.isSafeInteger(n) && Number.isSafeInteger(d) && d > 0);
  assert.equal((n * expected.ppq) % d, 0, `unrepresentable rational ${s}`);
  return n * expected.ppq / d;
};
export function literalOracle() {
  const rows = fs.readFileSync(new URL('fixtures/oracle.tsv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  assert.equal(rows.length, 24);
  return rows.flatMap((line, i) => {
    const [bar, ...roles] = line.split('\t');
    assert.equal(Number(bar), i + 1);
    return roles.flatMap((column, role) => column.split(' ').filter(Boolean).map(token => {
      const [pitch, offset, duration] = token.split(/[@:]/);
      return { pitch: Number(pitch), ticks: i * 3840 + rational(offset), durationTicks: rational(duration), role: ['melody','bass','harmony'][role] };
    }));
  });
}
const sorted = notes => notes.map(({pitch,ticks,durationTicks}) => ({pitch,ticks,durationTicks})).sort((a,b) => a.ticks-b.ticks || a.pitch-b.pitch || a.durationTicks-b.durationTicks);
export function checkNotes(notes) {
  assert.deepEqual(sorted(notes), sorted(literalOracle()), 'literal sounding interval oracle mismatch');
  assert.equal(Math.max(...notes.map(n => n.ticks+n.durationTicks)), 92160, 'final bar missing');
}
export function checkMidi(bytes) {
  const parsed = parseMidi(bytes);
  assert.equal(parsed.header.ticksPerBeat, expected.ppq);
  const notes = [], tempos = [], programs = [], ends = [];
  for (const track of parsed.tracks) {
    let ticks = 0;
    const active = new Map();
    for (const event of track) {
      ticks += event.deltaTime;
      const key = `${event.channel}:${event.noteNumber}`;
      if (event.type === 'noteOn' && event.velocity > 0) {
        assert(!active.has(key), `overlapping identical note ${key}`);
        active.set(key, ticks);
      } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        assert(active.has(key), `unmatched off ${key}`);
        notes.push({ pitch:event.noteNumber, ticks:active.get(key), durationTicks:ticks-active.get(key) });
        active.delete(key);
      } else if (event.type === 'setTempo') tempos.push([ticks, event.microsecondsPerBeat]);
      else if (event.type === 'programChange') programs.push(event.programNumber);
      else if (event.type === 'endOfTrack') ends.push(ticks);
    }
    assert.equal(active.size, 0, 'stuck notes');
  }
  checkNotes(notes);
  assert.deepEqual(tempos, expected.tempos.map(([q,bpm]) => [q*960, Math.floor(60000000/bpm)]));
  assert(programs.length > 0 && programs.every(p => p === 24), 'only acoustic nylon guitar program 24');
  // A second, unrelated MIDI reader must see the same bytes/intervals/tempo map.
  const tone = new Midi(bytes);
  checkNotes(tone.tracks.flatMap(t => t.notes.map(n => ({pitch:n.midi,ticks:n.ticks,durationTicks:n.durationTicks}))));
  assert.equal(tone.header.tempos.length, 10);
  return { bytes:bytes.length, header:parsed.header, notes:notes.length, roles:Object.fromEntries(['melody','bass','harmony'].map(r => [r,literalOracle().filter(n => n.role===r).length])), tempos, programs, lastNoteEnd:92160, trackEnds:ends, secondParser:'@tonejs/midi 2.0.28', seconds:tone.duration };
}

// Independent summary predicate for actual PDF.js inspection, also used by negative controls.
export function checkPdfSummary(summary, capo) {
  assert(summary.pages.length >= 3, 'fixture must span first/middle/last pages');
  assert(summary.embeddedBravura, 'embedded Bravura missing');
  const bars = [], systems = [];
  for (const page of summary.pages) {
    assert(page.operators > 500 && page.musicGlyphs >= 10*page.systemLabels.length, `blank/missing music glyph page ${summary.file ?? ''} #${page.number ?? '?'}: ${page.operators} operators, ${page.musicGlyphs} glyphs`);
    assert(page.staffLineGroups >= 1 && page.tabLineGroups >= 1, 'staff or TAB missing');
    assert(page.fontNames.some(n => n.includes('Bravura')), 'page has no Bravura');
    assert(page.text.includes(`Capo ${capo}`), 'capo label missing');
    assert(page.text.includes(expected.revision), 'wrong revision');
    assert(page.inkInBounds, 'clipped page content');
    bars.push(...page.barLabels);
    systems.push(...page.systemLabels);
  }
  assert.deepEqual(bars, Array.from({length:24},(_,i) => i+1), 'missing/duplicated/final PDF bar');
  assert.deepEqual(systems, Array.from({length:12},(_,i) => i+1), 'split/omitted/duplicated system');
  assert(summary.pages.at(-1).text.includes('FINAL O24'), 'final engraved bar missing');
}

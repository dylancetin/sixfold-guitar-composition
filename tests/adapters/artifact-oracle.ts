// Independent actual-byte oracle. Imports NO production adapter or renderer model.
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { Midi } from '@tonejs/midi';
import { parseMidi } from 'midi-file';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { literalAttacks } from './fixture';

export function checkMidi(bytes: Uint8Array, passes: number, pitchShift: number, scale = 1) {
  const parsed = parseMidi(bytes);
  assert.equal(parsed.header.format, 1); assert.equal(parsed.header.ticksPerBeat, 960); assert.equal(parsed.tracks.length, 4);
  const actual: string[] = [], tempos: { tick: number; micros: number }[] = [], ends: number[] = [];
  for (const [trackIndex, track] of parsed.tracks.entries()) {
    let tick = 0; const active = new Map<string, number>();
    for (const event of track) {
      tick += event.deltaTime;
      if (event.type === 'setTempo') tempos.push({ tick, micros: event.microsecondsPerBeat });
      if (event.type === 'programChange') { assert.equal(event.programNumber, 24); assert.equal(event.channel, trackIndex - 1); }
      if (event.type === 'noteOn' || event.type === 'noteOff') {
        assert.equal(event.channel, trackIndex - 1);
        const key = `${event.channel}/${event.noteNumber}`;
        if (event.type === 'noteOn' && event.velocity > 0) { assert(!active.has(key), 'overlapping unison attack'); active.set(key, tick); }
        else {
          assert(active.has(key), 'unmatched note-off');
          actual.push(`${['melody', 'bass', 'harmony'][event.channel]}/${event.noteNumber}/${active.get(key)}/${tick}`); active.delete(key);
        }
      }
    }
    assert.equal(active.size, 0, 'unbalanced MIDI note pairs'); assert.equal(track.at(-1)?.type, 'endOfTrack'); ends.push(tick);
  }
  const expected = Array.from({ length: passes }, (_, pass) => literalAttacks.map(([role, pitch, start, end]) => `${role}/${pitch + pitchShift}/${start + pass * 7680}/${end + pass * 7680}`)).flat().sort();
  assert.deepEqual(actual.sort(), expected, 'MIDI complete role union mismatch (including last note and held tie)');
  assert.deepEqual(ends, [passes * 7680, passes * 7680, passes * 7680, passes * 7680]);
  assert.deepEqual(tempos, Array.from({ length: passes * 2 }, (_, i) => ({ tick: i * 3840, micros: Math.floor(60000000 / (80 * scale)) })));
  const tone = new Midi(bytes);
  const toneNotes = tone.tracks.flatMap(t => t.notes);
  assert.equal(toneNotes.length, passes * 9, 'second independent parser count');
  assert.equal(Math.max(...toneNotes.map(n => n.ticks + n.durationTicks)), passes * 7680);
  assert(Math.abs(tone.duration - passes * 8 * Math.floor(60000000 / (80 * scale)) / 1000000) < 1e-7);
  return { attacks: actual.length, finalTick: Math.max(...ends), seconds: tone.duration, roleCounts: { melody: passes * 5, bass: passes * 2, harmony: passes * 2 } };
}

type Matrix = [number, number, number, number, number, number];
const multiply = (a: Matrix, b: number[]): Matrix => [a[0] * b[0]! + a[2] * b[1]!, a[1] * b[0]! + a[3] * b[1]!, a[0] * b[2]! + a[2] * b[3]!, a[1] * b[2]! + a[3] * b[3]!, a[0] * b[4]! + a[2] * b[5]! + a[4], a[1] * b[4]! + a[3] * b[5]! + a[5]];
type Line = { x: number; y: number; w: number };
function linesFromOperators(ops: { fnArray: number[]; argsArray: any[] }): Line[] {
  let matrix: Matrix = [1, 0, 0, 1, 0, 0]; const stack: Matrix[] = [], lines: Line[] = [];
  for (const [index, fn] of ops.fnArray.entries()) {
    const args = ops.argsArray[index];
    if (fn === OPS.save) stack.push(matrix);
    else if (fn === OPS.restore) { assert(stack.length); matrix = stack.pop()!; }
    else if (fn === OPS.transform) matrix = multiply(matrix, args);
    else if (fn === OPS.constructPath && args[0] === OPS.fill && args[2]) {
      const [x1, y1, x2, y2] = args[2];
      const corners = [[x1, y1], [x1, y2], [x2, y1], [x2, y2]].map(([x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]]);
      const xs = corners.map(p => p[0]!), ys = corners.map(p => p[1]!);
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      if (w > 20 && h > 0.1 && h < 2) lines.push({ x, y: y + h / 2, w });
    }
  }
  return lines;
}
function groups(lines: Line[], count: number, gap: number) {
  const ys = lines.map(l => l.y).sort((a, b) => a - b).filter((y, i, all) => i === 0 || y - all[i - 1]! > 0.15);
  const has = (y: number) => ys.some(actual => Math.abs(actual - y) < 0.15);
  return ys.filter(y => !has(y - gap) && Array.from({ length: count }, (_, i) => has(y + i * gap)).every(Boolean)).map(bottom => ({ bottom, top: bottom + (count - 1) * gap, gap }));
}

export async function checkPdf(bytes: Uint8Array, passes: number, capo: number, firstMidi = 66, onRaster?: (page: number, bytes: Uint8Array) => void) {
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), '%PDF-');
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, fontExtraProperties: true, standardFontDataUrl: new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).pathname });
  const pages: { number: number; systems: number[]; occurrences: string[]; lineCoverage: number; embeddedBravura: boolean }[] = [];
  try {
    const pdf = await task.promise;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number), content = await page.getTextContent(), ops = await page.getOperatorList();
      const items = content.items.filter((i): i is Extract<typeof i, { str: string }> => 'str' in i);
      const text = items.map(i => i.str).join(' ');
      assert(text.includes(`Capo ${capo}`), 'PDF capo caption mismatch');
      assert(text.includes('unreviewed-draft'), 'Draft label missing');
      const systems = [...text.matchAll(/SYSTEM(\d+)/g)].map(m => Number(m[1]));
      assert.equal([...text].filter(c => c === '\ue050').length, systems.length, 'missing treble clef');
      assert.equal([...text].filter(c => c === '\ue06d').length, systems.length, 'missing TAB glyph');
      const fontIds = [...new Set(ops.fnArray.flatMap((fn, i) => fn === OPS.setFont ? [ops.argsArray[i][0]] : []))];
      const embeddedBravura = fontIds.some(id => { const font = page.commonObjs.get(id); return font.name?.includes('Bravura') && font.data?.length > 1000; });
      if (systems.length) assert(embeddedBravura, 'music font missing/unembedded');
      const viewport = page.getViewport({ scale: 1.5 }), base = page.getViewport({ scale: 1 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)), ctx = canvas.getContext('2d');
      await page.render({ canvas: null, canvasContext: ctx as any, viewport, background: 'white' }).promise;
      onRaster?.(number, canvas.toBuffer('image/png'));
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const scale = (base.width - 56) / 750;
      const lines = linesFromOperators(ops), staff = groups(lines, 5, 9 * scale), tab = groups(lines, 6, 13 * scale);
      assert.equal(staff.length, systems.length, 'missing staff lines'); assert.equal(tab.length, systems.length, 'missing TAB lines');
      const heads = [...text].filter(c => ['\ue0a2', '\ue0a3', '\ue0a4'].includes(c));
      assert.equal(heads.length, systems.length * 10, 'actual engraved note/tie head count differs');
      assert.equal(heads.filter(c => c === '\ue0a2').length, systems.length * 2, 'independent whole-note bass duration lost');
      assert.equal(heads.filter(c => c === '\ue0a3').length, systems.length, 'independent half-note harmony duration lost');
      // Reconstruct EVERY actual TAB placement from PDF text geometry, not a native model/manifest.
      // Helvetica TAB digit baselines sit 3.661 SVG units below the string line;
      // alphaTab parenthesizes tied destinations. This is checked in actual PDF coordinates.
      const relativeShift = firstMidi - 64 - capo;
      const fretsByString = [[0, 3], [], [], [2], [0], [0, 3, 2, 0, 1, 1]];
      for (const group of tab) {
        const digits = items.filter(i => /^\(?\d{1,2}\)?$/.test(i.str) && i.transform[5]! >= group.bottom - 5 * scale && i.transform[5]! <= group.top + scale);
        assert.equal(digits.length, 10, 'missing/extra actual TAB fret');
        assert.equal(digits.filter(i => i.str.startsWith('(')).length, 1, 'crossbar tie destination missing from actual TAB');
        const byString = Array.from({ length: 6 }, () => [] as { x: number; fret: number }[]);
        for (const digit of digits) {
          const string = Math.round((digit.transform[5]! + 3.661 * scale - group.bottom) / (13 * scale));
          assert(string >= 0 && string < 6, 'TAB digit outside six strings');
          assert(Math.abs(digit.transform[5]! - (group.bottom + string * 13 * scale - 3.661 * scale)) < 0.2, `TAB digit does not align to string: y=${digit.transform[5]}, bottom=${group.bottom}, string=${string}, scale=${scale}`);
          byString[string]!.push({ x: digit.transform[4]!, fret: Number(digit.str.replace(/[()]/g, '')) });
        }
        assert.deepEqual(byString.map(notes => notes.sort((a, b) => a.x - b.x).map(n => n.fret)), fretsByString.map(frets => frets.map(f => f + relativeShift)), 'actual PDF capo-relative fret sequence differs from literal source pitches');
      }
      let minimumCoverage = 1;
      for (const [lineGroups, count] of [[staff, 5], [tab, 6]] as const) for (const group of lineGroups) for (let i = 0; i < count; i++) {
        const y = group.bottom + i * group.gap;
        const segment = lines.filter(l => Math.abs(l.y - y) < 0.15).sort((a, b) => b.w - a.w)[0]; assert(segment);
        assert(y > 30 && y < base.height - 30, 'engraving outside printable page');
        let hits = 0;
        for (let j = 1; j <= 30; j++) {
          const px = Math.round((segment.x + segment.w * j / 31) * 1.5), py = Math.round((base.height - y) * 1.5);
          let dark = false;
          for (let dy = -2; dy <= 2; dy++) { const k = ((py + dy) * canvas.width + px) * 4; if (pixels[k]! < 220 || pixels[k + 1]! < 220 || pixels[k + 2]! < 220) dark = true; }
          if (dark) hits++;
        }
        minimumCoverage = Math.min(minimumCoverage, hits / 30); assert(hits >= 20, 'clipped/invisible raster staff/TAB');
      }
      if (number === 1) {
        const head = items.find(i => i.str.includes('\ue0a4')); assert(head, 'first notehead missing');
        const topLine = Math.max(...staff.map(g => g.top));
        const expectedBelow = firstMidi === 66 ? 0 : firstMidi === 64 ? 4.5 * scale : NaN;
        assert(Math.abs(head.transform[5]! - (topLine - expectedBelow)) < 0.2, 'Actual engraved guitar display octave wrong');
        assert(Math.abs(head.height - 34 * scale) < 0.01, 'music glyph scale wrong');
      }
      const occurrences = [...text.matchAll(/\bo([12])-p(\d+)\/S([12])\/P(\d+)\b/g)].map(m => {
        assert.equal(m[1], m[3]); assert.equal(m[2], m[4]); return `o${m[1]}-p${m[2]}`;
      });
      pages.push({ number, systems, occurrences, lineCoverage: minimumCoverage, embeddedBravura });
    }
    assert.deepEqual(pages.flatMap(p => p.systems), Array.from({ length: passes }, (_, i) => i + 1), 'complete PDF system coverage');
    assert.deepEqual(pages.flatMap(p => p.occurrences), Array.from({ length: passes }, (_, i) => [`o1-p${i + 1}`, `o2-p${i + 1}`]).flat(), 'missing/final/duplicate PDF occurrence');
    return { pageCount: pages.length, pages };
  } finally { await task.destroy(); }
}

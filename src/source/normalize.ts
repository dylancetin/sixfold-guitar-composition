import { add, compare, contentDigest, eventEnd, multiply, q } from '../domain';
import type { Diagnostic, Form, Meter, SourceEvent, SourceRef, SourceScoreV1, TempoPoint, WrittenBar } from '../domain';
import { diagnostic, fail } from './common';
import type { MetadataTrack, RawBeat, RawPart } from './raw';

type NoteEvent = Extract<SourceEvent, { kind: 'note' }>;
type Effect = NoteEvent['effects'][number];
const rootKeys = new Set('strings frets tuning name instrument instrumentId volume balance measures capo newLyrics voices automations version withLyrics songId partId revisionId hasPlayer isBlocked isRestricted restriction'.split(' '));
const measureKeys = new Set('signature marker voices rest repeatStart repeat repeatCount tempo alternateEnding tripletFeel'.split(' '));
const beatKeys = new Set('type rest text notes duration velocity beamStart beamStop tuplet tupletStart tupletStop dotted dots lyrics'.split(' '));
const noteKeys = new Set('rest string fret tie'.split(' '));
const articulations = new Set(['accentuated', 'ghost', 'velocity']);

function unknownKeys(value: Record<string, unknown>, allowed: Set<string>, label: string, barIds: string[] = []): void {
  const keys = Object.keys(value).filter((key) => !allowed.has(key));
  if (keys.length) fail(`${label}: unsupported fields ${keys.join(', ')}; raw retained, no silent interpretation.`, 'unsupported', 'unsupported-construct', barIds);
}

/** Whole-note duration already includes dots and tuplets: NEVER multiply their timing twice. */
export function decodeExactRhythm(beat: RawBeat, barId: string) {
  const whole = q(beat.duration[0], beat.duration[1]);
  const duration = multiply(whole, q(4));
  const actual = beat.tuplet;
  const normal = actual === undefined ? 1 : actual === 2 ? 3 : 2 ** Math.floor(Math.log2(actual - 1));
  const factor = actual === undefined ? q(1) : q(normal, actual);
  const types = beat.type === undefined ? [1, 2, 4, 8, 16, 32, 64] : [beat.type];
  const dots = beat.dots !== undefined ? [beat.dots] : beat.dotted ? [1] : [0, 1, 2, 3];
  for (const type of types) {
    for (const dot of dots) {
      const expected = multiply(multiply(q(4, type), q(2 ** (dot + 1) - 1, 2 ** dot)), factor);
      if (compare(expected, duration) === 0) return { whole, duration, type, dots: dot, actual: actual ?? null, normal: actual ? normal : null };
    }
  }
  return fail(`Bar ${barId}: exact source fraction disagrees with notation/dots/tuplet or is not representable; not quantized.`, 'unsupported', 'unsupported-construct', [barId]);
}

function spelling(midi: number): NoteEvent['spelling'] {
  // Source is fret-based and declares no enharmonic spelling. This is a disclosed display convention.
  const steps = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'] as const;
  return { step: steps[midi % 12]!, alter: [1, 3, 6, 8, 10].includes(midi % 12) ? 1 : 0, octave: Math.floor(midi / 12) - 1 };
}

export function normalizeStructure(raw: RawPart): { bars: WrittenBar[]; tempos: TempoPoint[]; form: Form } {
  unknownKeys(raw, rootKeys, `Part ${raw.partId}`);
  if (raw.capo) fail(`Part ${raw.partId}: nonzero source capo has unresolved sounding-pitch semantics.`);
  unknownKeys(raw.automations, new Set(['tempo']), `Part ${raw.partId} automations`);
  let meter: Meter | undefined;
  let start = q(0);
  let repeatStart: string | null = null;
  const repeats: Form['repeats'] = [];
  const bars = raw.measures.map((measure, i): WrittenBar => {
    const id = `bar-${i + 1}`;
    unknownKeys(measure, measureKeys, `Part ${raw.partId} bar ${i + 1}`, [id]);
    if (measure.alternateEnding !== undefined && measure.alternateEnding !== 0 && (!Array.isArray(measure.alternateEnding) || measure.alternateEnding.length)) fail('Alternate endings are unsupported; form not flattened.', 'unsupported', 'unsupported-construct', [id]);
    if (measure.tripletFeel !== undefined && measure.tripletFeel !== null && measure.tripletFeel !== 'none') fail('Swing/triplet feel needs explicit interpretation; not treated as straight time.', 'unsupported', 'unsupported-construct', [id]);
    if (measure.signature) meter = { beats: measure.signature[0], beatUnit: measure.signature[1] };
    if (!meter) fail('First source bar must declare a meter.');
    const length = q(meter.beats * 4, meter.beatUnit);
    const bar = { id, number: i + 1, start, length, meter: { ...meter }, kind: 'full' as const };
    start = add(start, length);
    if (measure.repeatStart) {
      if (repeatStart !== null) fail('Nested/unclosed source repeats are unsupported.', 'unsupported', 'form-mismatch', [id]);
      repeatStart = id;
    }
    if (measure.repeat !== undefined && measure.repeatCount !== undefined && measure.repeat !== measure.repeatCount) fail('Conflicting source repeat counts.', 'unsupported', 'form-mismatch', [id]);
    const count = measure.repeat ?? measure.repeatCount ?? 0;
    if (count) {
      if (count < 2) fail('Repeat count must specify at least two total passes.', 'unsupported', 'form-mismatch', [id]);
      repeats.push({ id: `repeat-${repeats.length + 1}`, fromBarId: repeatStart ?? 'bar-1', toBarId: id, totalPasses: count });
      repeatStart = null;
    }
    return bar;
  });
  if (repeatStart) fail('Unclosed repeat start.', 'unsupported', 'form-mismatch', [repeatStart]);
  for (let i = 1; i < repeats.length; i++) if (Number(repeats[i]!.fromBarId.slice(4)) <= Number(repeats[i - 1]!.toBarId.slice(4))) fail('Overlapping/implicit nested repeats are unsupported.', 'unsupported', 'form-mismatch');
  const tempos = raw.automations.tempo.map((point, i): TempoPoint => {
    unknownKeys(point, new Set(['measure', 'position', 'type', 'bpm', 'visible', 'linear']), 'Tempo automation');
    if (point.linear) fail('Continuous tempo ramps are unsupported, not collapsed into steps.');
    const bar = bars[point.measure];
    const offset = q(point.position * 4, point.type);
    if (!bar || compare(offset, bar.length) >= 0) fail('Tempo point is outside its source bar.', 'unsupported', 'tempo-mismatch');
    return { id: `tempo-${i + 1}`, barId: bar.id, offset, quarterBpm: point.bpm };
  });
  tempos.sort((a, b) => bars.findIndex((bar) => bar.id === a.barId) - bars.findIndex((bar) => bar.id === b.barId) || compare(a.offset, b.offset));
  if (tempos[0]?.barId !== 'bar-1' || compare(tempos[0].offset, q(0))) fail('Source must declare an initial tempo at score zero.', 'unsupported', 'tempo-mismatch');
  for (let i = 1; i < tempos.length; i++) if (tempos[i]!.barId === tempos[i - 1]!.barId && compare(tempos[i]!.offset, tempos[i - 1]!.offset) === 0) fail('Ambiguous duplicate source tempo point.', 'unsupported', 'tempo-mismatch');
  for (const [i, measure] of raw.measures.entries()) {
    if (measure.tempo !== undefined) {
      const tempo = measure.tempo as { bpm?: unknown; type?: unknown };
      if (!tempo || typeof tempo !== 'object' || tempo.type !== 4 || !tempos.some((t) => t.barId === bars[i]!.id && t.offset.n === 0 && t.quarterBpm === tempo.bpm)) fail('Legacy measure tempo disagrees with authoritative automations.', 'unsupported', 'tempo-mismatch', [bars[i]!.id]);
    }
  }
  return { bars, tempos, form: { kind: 'linear-repeats', repeats, tempoPolicy: 'restore-written-position', jumpTiePolicy: 'reject-cross-jump' } };
}

export function normalizePart(metadata: MetadataTrack, raw: RawPart, bars: WrittenBar[]): { part: SourceScoreV1['parts'][number]; events: SourceEvent[]; diagnostics: Diagnostic[] } {
  const percussion = metadata.isDrums === true || (raw.instrumentId ?? metadata.instrumentId) === 1024;
  const tuning = raw.tuning ?? metadata.tuning;
  if (!percussion && !tuning) fail(`Part ${raw.partId} has no source tuning; standard guitar tuning not assumed.`);
  const program = raw.instrumentId ?? metadata.instrumentId;
  const voices = Array.from({ length: Math.max(...raw.measures.map((m) => m.voices.length)) }, (_, i) => `p${raw.partId}:v${i}`);
  const part = {
    id: raw.partId, name: metadata.name?.trim() || metadata.title?.trim() || raw.name?.trim() || `Part ${raw.partId}`,
    program: program !== undefined && program <= 127 ? program : null, voices,
    sourceTuning: !percussion && tuning ? { order: 'high-to-low' as const, soundingMidi: tuning } : null,
  };
  const events: SourceEvent[] = [];
  const diagnostics: Diagnostic[] = [];
  const previous = new Map<string, Map<number, NoteEvent>>();
  const unsupported = new Map<string, { bars: Set<string>; events: Set<string> }>();
  function mark(effect: Effect, barId: string, eventId: string) {
    if (!effect.affectsMelody) return;
    const group = unsupported.get(effect.code) ?? { bars: new Set<string>(), events: new Set<string>() };
    group.bars.add(barId); group.events.add(eventId); unsupported.set(effect.code, group);
  }
  let slots = 0;
  for (const [barIndex, measure] of raw.measures.entries()) {
    const bar = bars[barIndex]!;
    for (const [voiceIndex, voice] of measure.voices.entries()) {
      const voiceId = voices[voiceIndex]!;
      unknownKeys(voice, new Set(['beats', 'rest']), `Part ${raw.partId} ${voiceId}`, [bar.id]);
      if (!voice.beats.length) fail(`Part ${raw.partId} ${bar.id}: no explicit source beat/rest; silence not invented.`, 'unsupported', 'unsupported-construct', [bar.id]);
      let offset = q(0);
      let prior = previous.get(voiceId) ?? new Map<number, NoteEvent>();
      for (const [beatIndex, beat] of voice.beats.entries()) {
        if (++slots > 100_000) fail('Source exceeds the 100,000 beat processing bound.');
        const beatId = `p${raw.partId}:b${barIndex + 1}:v${voiceIndex}:bt${beatIndex}`;
        const rhythm = decodeExactRhythm(beat, bar.id);
        const start = add(bar.start, offset);
        offset = add(offset, rhythm.duration);
        if (compare(offset, bar.length) > 0) fail(`Part ${raw.partId} ${bar.id}: voice overfills meter.`, 'unsupported', 'unsupported-construct', [bar.id]);
        const beatEffects: Effect[] = Object.keys(beat).filter((key) => !beatKeys.has(key)).map((key) => ({ code: `unsupported-${key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'field'}`, description: `Uninterpreted source beat field: ${key.slice(0, 100)}. Original value retained in raw artifact.`, affectsMelody: true }));
        if ('graceNote' in beat) fail(`Grace-note timing is not representable in SourceScoreV1 (${beatId}); not converted into a full-duration attack.`);
        const ref = (noteIndex: number): SourceRef => ({
          sourceNoteId: `${beatId}:n${noteIndex}`, partId: raw.partId, barId: bar.id, voiceId, beatId, noteIndex,
          rawWholeNoteDuration: rhythm.whole,
          sourcePosition: !percussion && beat.notes[noteIndex]?.string !== undefined && beat.notes[noteIndex]!.string! >= 0 && beat.notes[noteIndex]?.fret !== undefined ? { stringIndex: beat.notes[noteIndex]!.string!, fret: beat.notes[noteIndex]!.fret! } : null,
        });
        const isRest = beat.rest || voice.rest || measure.rest || beat.notes.every((n) => n.rest);
        if (isRest) {
          if (beat.notes.some((n) => !n.rest && n.fret !== undefined)) fail(`Conflicting rest and sounding-note flags at ${beatId}.`);
          if (beatEffects.length) fail(`Unsupported effect on rest ${beatId}.`);
          events.push({ kind: 'rest', id: `${beatId}:rest`, partId: raw.partId, voiceId, start, duration: rhythm.duration, refs: beat.notes.map((_, n) => ref(n)) });
          prior = new Map();
          continue;
        }
        const current = new Map<number, NoteEvent>();
        const byPitch = new Map<number, number[]>();
        for (const [noteIndex, note] of beat.notes.entries()) {
          if (note.rest) fail(`Mixed rest and pitched chord members at ${beatId}.`);
          if (note.fret === undefined) fail(`Missing source fret at ${beatId}.`);
          const open = note.string === undefined ? undefined : tuning?.[note.string];
          if (!percussion && open === undefined) fail(`Invalid source string/tuning at ${beatId}.`);
          const midi = percussion ? note.fret : open! + note.fret;
          if (midi > 127) fail(`Source pitch outside MIDI range at ${beatId}.`);
          const indexes = byPitch.get(midi) ?? []; indexes.push(noteIndex); byPitch.set(midi, indexes);
        }
        for (const [midi, indexes] of byPitch) {
          const firstIndex = indexes[0]!;
          const tied = beat.notes[firstIndex]!.tie === true;
          if (indexes.some((i) => (beat.notes[i]!.tie === true) !== tied)) fail(`Unison contains conflicting attack/tie flags at ${beatId}.`);
          const effects: Effect[] = [...beatEffects];
          // Retain exact notation hints for every raw member/continuation, without adding parallel domain types.
          effects.push({ code: 'source-notation', description: JSON.stringify({ beatId, type: rhythm.type, dots: rhythm.dots, tuplet: rhythm.actual, normal: rhythm.normal, tupletStart: beat.tupletStart ?? false, tupletStop: beat.tupletStop ?? false }), affectsMelody: false });
          for (const index of indexes) {
            const note = beat.notes[index]!;
            for (const key of Object.keys(note).filter((key) => !noteKeys.has(key))) {
              effects.push({ code: `${articulations.has(key) ? 'articulation' : 'unsupported'}-${key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'field'}`, description: `Source ${key.slice(0, 100)}=${JSON.stringify(note[key]).slice(0, 200)} at ${ref(index).sourceNoteId}; original retained in raw.`, affectsMelody: !articulations.has(key) });
            }
          }
          if (percussion) effects.push({ code: 'unpitched-percussion', description: 'MIDI drum identifier, NOT a pitched melody tone; SourceScoreV1 has no percussion event variant.', affectsMelody: true });
          const refs = indexes.map((i) => ref(i));
          let event: NoteEvent;
          if (tied) {
            const attack = prior.get(midi);
            if (!attack || compare(eventEnd(attack), start)) fail(`Orphan/noncontiguous/pitch-changing tie at ${beatId}; no retrigger invented.`, 'unsupported', 'unsupported-construct', [bar.id]);
            event = attack;
            event.duration = add(event.duration, rhythm.duration);
            event.refs.push(...refs);
            event.effects.push(...effects);
            event.tieChainId = `tie:${event.id}`;
          } else {
            event = { kind: 'note', id: refs[0]!.sourceNoteId, partId: raw.partId, voiceId, start, duration: rhythm.duration, soundingMidi: midi, spelling: spelling(midi), tieChainId: null, refs, effects };
            events.push(event);
          }
          for (const effect of effects) mark(effect, bar.id, event.id);
          current.set(midi, event);
        }
        prior = current;
      }
      if (compare(offset, bar.length)) fail(`Part ${raw.partId} ${bar.id}: exact voice duration does not fill meter; no filler rest invented.`, 'unsupported', 'unsupported-construct', [bar.id]);
      previous.set(voiceId, prior);
    }
  }
  for (const [code, locations] of unsupported) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: ${code} retained and explicitly unsupported for melody selection.`, 'warning', [...locations.bars], [...locations.events]));
  if (events.some((e) => e.kind === 'note' && e.effects.some((effect) => effect.code.startsWith('articulation-')))) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: expressive articulations retained as effects, not reproduced by this source adapter. Nominal pitch/rhythm is preserved.`));
  return { part, events, diagnostics };
}

export async function sameStructure(a: ReturnType<typeof normalizeStructure>, b: ReturnType<typeof normalizeStructure>): Promise<boolean> {
  return await contentDigest(a) === await contentDigest(b);
}

export function deriveUncertainKey(events: SourceEvent[]): SourceScoreV1['key'] {
  const pitchClasses = [...new Set(events.flatMap((event) => event.kind === 'note' && !event.effects.some((e) => e.affectsMelody) ? [event.soundingMidi % 12] : []))].sort((a, b) => a - b);
  return { status: 'unknown', reason: `Fret-based source supplies no declared key/spelling. Observed pitched classes: ${pitchClasses.join(',')}; these do not distinguish tonic/mode or modulation. Any proposed key (including a user hypothesis) requires review. Sharp spellings are a display convention, not key evidence.` };
}

/** Utility used only for source facts/proposals, not a form/performance expansion. */
export function writtenEnd(source: SourceScoreV1) { const last = source.bars.at(-1)!; return add(last.start, last.length); }

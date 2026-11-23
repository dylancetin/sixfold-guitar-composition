import { add, compare, contentDigest, eventEnd, multiply, q } from '../domain';
import type { Diagnostic, Form, Meter, Q, SourceEvent, SourceRef, SourceScoreV1, TempoPoint, WrittenBar } from '../domain';
import { diagnostic, fail, rawBeatId } from './common';
import type { MetadataTrack, RawBeat, RawPart } from './raw';
import { effectiveTripletFeels, swingDurations } from './swing';
import type { TripletFeel } from './swing';
import { graceDurations } from './grace';
import { simplifiedBend } from './bend';
import { resolveClosedSlides } from './slides';
import { simplifiedOrnament } from './ornament';

type NoteEvent = Extract<SourceEvent, { kind: 'note' }>;
type Effect = NoteEvent['effects'][number];
const rootKeys = new Set('clef anacrusis strings frets tuning tuningFlat tuningShortDrone name title grandStaffGroup instrument instrumentId volume balance measures capo newLyrics voices automations version withLyrics songId partId revisionId hasPlayer isBlocked isRestricted restriction'.split(' '));
const measureKeys = new Set('clef signature keySignature marker voices rest repeatStart repeat repeatCount tempo alternateEnding tripletFeel'.split(' '));
const beatKeys = new Set('type rest text notes duration velocity beamStart beamStop tuplet tupletStart tupletStop dotted dots lyrics graceNote chord'.split(' '));
const noteKeys = new Set('rest string fret tie'.split(' '));
const articulations = new Set(['accentuated', 'ghost', 'velocity', 'hp', 'staccato']);

function unknownKeys(value: Record<string, unknown>, allowed: Set<string>, label: string, barIds: string[] = []): void {
  const keys = Object.keys(value).filter((key) => !allowed.has(key));
  if (keys.length) fail(`${label}: unsupported fields ${keys.join(', ')}; raw retained, no silent interpretation.`, 'unsupported', 'unsupported-construct', barIds);
}

type RawMeasure = RawPart['measures'][number];

/**
 * An explicitly silent measure/voice with one undotted whole-rest symbol means the
 * complete current bar, not necessarily four quarters, so it cannot size a pickup.
 */
function isWholeBarRestSymbol(measure: RawMeasure, voice: RawMeasure['voices'][number], beat: RawBeat, rhythm: ReturnType<typeof decodeExactRhythm>): boolean {
  return Boolean((measure.rest || voice.rest) && voice.beats.length === 1 && beat.rest && beat.notes.every((note) => note.rest && note.fret === undefined && !note.tie)
    && !beat.graceNote && rhythm.type === 1 && rhythm.dots === 0 && rhythm.actual === null);
}

/**
 * Songsterr `anacrusis` marks only the opening bar as a pickup shorter than its meter.
 * Its exact length is the explicit non-grace beat content (grace notation adds no bar
 * time); every voice that determines a length must agree. Whole-bar rest symbols are
 * indeterminate and then fill that length. No length is guessed from the meter.
 */
function pickupLength(measure: RawMeasure, meterLength: Q, barId: string): Q {
  const lengths: Q[] = [];
  for (const voice of measure.voices) {
    const rhythms = voice.beats.map((beat) => decodeExactRhythm(beat, barId));
    if (voice.beats.length === 1 && isWholeBarRestSymbol(measure, voice, voice.beats[0]!, rhythms[0]!)) continue;
    lengths.push(rhythms.reduce((sum, rhythm, i) => voice.beats[i]!.graceNote ? sum : add(sum, rhythm.duration), q(0)));
  }
  const length = lengths[0];
  if (!length) return fail('Declared source pickup has no explicit beat content that determines its length; none is guessed.', 'unsupported', 'unsupported-construct', [barId]);
  if (lengths.some((other) => compare(other, length))) fail('Declared source pickup voices disagree on its exact length.', 'unsupported', 'unsupported-construct', [barId]);
  if (compare(length, q(0)) <= 0 || compare(length, meterLength) >= 0) fail('Declared source pickup is not shorter than its meter; not reinterpreted.', 'unsupported', 'unsupported-construct', [barId]);
  return length;
}

/** Nominal whole-note duration includes dots/tuplets, but not measure feel. Never apply either twice. */
export function decodeExactRhythm(beat: RawBeat, barId: string) {
  const whole = q(beat.duration[0], beat.duration[1]);
  const duration = multiply(whole, q(4));
  const actual = beat.tuplet;
  const normal = actual === undefined ? 1 : actual === 2 ? 3 : 2 ** Math.floor(Math.log2(actual - 1));
  const factor = actual === undefined ? q(1) : q(normal, actual);
  const types = beat.type === undefined ? [1, 2, 4, 8, 16, 32, 64, 128] : [beat.type];
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

export function normalizeStructure(raw: RawPart): { bars: WrittenBar[]; tempos: TempoPoint[]; form: Form; tripletFeels: TripletFeel[] } {
  unknownKeys(raw, rootKeys, `Part ${raw.partId}`);
  unknownKeys(raw.automations, new Set(['tempo']), `Part ${raw.partId} automations`);
  let meter: Meter | undefined;
  let start = q(0);
  let repeatStart: string | null = null;
  const repeats: Form['repeats'] = [];
  const tripletFeels = effectiveTripletFeels(raw);
  const bars = raw.measures.map((measure, i): WrittenBar => {
    const id = `bar-${i + 1}`;
    unknownKeys(measure, measureKeys, `Part ${raw.partId} bar ${i + 1}`, [id]);
    if (measure.alternateEnding !== undefined && measure.alternateEnding !== 0 && (!Array.isArray(measure.alternateEnding) || measure.alternateEnding.length)) fail('Alternate endings are unsupported; form not flattened.', 'unsupported', 'unsupported-construct', [id]);
    if (measure.signature) meter = { beats: measure.signature[0], beatUnit: measure.signature[1] };
    if (!meter) fail('First source bar must declare a meter.');
    const meterLength = q(meter.beats * 4, meter.beatUnit);
    const pickup = i === 0 && raw.anacrusis === true;
    const length = pickup ? pickupLength(measure, meterLength, id) : meterLength;
    const bar: WrittenBar = { id, number: i + 1, start, length, meter: { ...meter }, kind: pickup ? 'pickup' : 'full' };
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
    const feel = tripletFeels[point.measure]!;
    if (feel !== 'off' && multiply(offset, q(feel === '8th' ? 1 : 2)).d !== 1) fail('Tempo changes inside a swing pair need explicit interpretation; tempo not shifted.', 'unsupported', 'tempo-mismatch', [bar.id]);
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
  return { bars, tempos, form: { kind: 'linear-repeats', repeats, tempoPolicy: 'restore-written-position', jumpTiePolicy: 'reject-cross-jump' }, tripletFeels };
}

export function normalizePart(metadata: MetadataTrack, raw: RawPart, bars: WrittenBar[], options: { simplifyBends?: boolean; simplifyOrnaments?: boolean } = {}): { part: SourceScoreV1['parts'][number]; events: SourceEvent[]; diagnostics: Diagnostic[] } {
  const percussion = metadata.isDrums === true || (raw.instrumentId ?? metadata.instrumentId) === 1024;
  const rawTuning = raw.tuning ?? metadata.tuning;
  const capo = raw.capo ?? 0;
  if (percussion && capo) fail(`Part ${raw.partId}: source capo on percussion is unsupported.`);
  if (!percussion && !rawTuning) fail(`Part ${raw.partId} has no source tuning; standard guitar tuning not assumed.`);
  if (raw.tuningShortDrone === true) fail(`Part ${raw.partId}: short drone-string tuning is unsupported; open-string pitches not reinterpreted.`);
  // Source frets are capo-relative. Materialize sounding open strings once;
  // final arrangement capo/fingering is independent and must not transpose them.
  const tuning = !percussion ? rawTuning?.map((midi) => midi + capo) : undefined;
  if (tuning?.some((midi) => midi > 127)) fail(`Part ${raw.partId}: source tuning plus capo is outside MIDI range.`);
  const program = raw.instrumentId ?? metadata.instrumentId;
  const voices = Array.from({ length: Math.max(...raw.measures.map((m) => m.voices.length)) }, (_, i) => `p${raw.partId}:v${i}`);
  const part = {
    id: raw.partId, name: metadata.name?.trim() || metadata.title?.trim() || raw.name?.trim() || raw.title?.trim() || `Part ${raw.partId}`,
    program: program !== undefined && program <= 127 ? program : null, voices,
    sourceTuning: !percussion && tuning ? { order: 'high-to-low' as const, soundingMidi: tuning } : null,
  };
  const events: SourceEvent[] = [];
  const diagnostics: Diagnostic[] = [];
  const measureRestBars = new Set<string>();
  const barStartGraceBars = new Set<string>();
  const mutedStringBars = new Set<string>();
  if (capo) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: source capo ${capo} materialized once in sounding open-string pitches (source tuning + capo + relative fret). Original tuning/capo/frets remain in raw artifacts and source positions; the arrangement capo does not transpose these pitches.`, 'info'));
  const tripletFeels = effectiveTripletFeels(raw);
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
    slots += measure.voices.reduce((count, voice) => count + voice.beats.length, 0);
    if (slots > 100_000) fail('Source exceeds the 100,000 beat processing bound.');
    const rhythms = measure.voices.map((voice) => voice.beats.map((beat) => {
      const rhythm = decodeExactRhythm(beat, bar.id);
      // A whole-bar rest symbol fills the current bar (meter or exact pickup).
      // Keep the raw fraction; never resize pitched, partial or ambiguous beats.
      if (isWholeBarRestSymbol(measure, voice, beat, rhythm)) {
        if (compare(rhythm.duration, bar.length)) measureRestBars.add(bar.id);
        return { ...rhythm, duration: bar.length };
      }
      return rhythm;
    }));
    const mainDurations = swingDurations(measure.voices.map((voice, i) => ({ rest: voice.rest === true, rhythms: rhythms[i]!.filter((_, j) => !voice.beats[j]!.graceNote) })), tripletFeels[barIndex]!, bar.length);
    const graced = measure.voices.map((voice, i) => {
      let main = 0;
      const played = voice.beats.map((beat, j) => beat.graceNote ? rhythms[i]![j]!.duration : mainDurations[i]![main++]!);
      return graceDurations(voice.beats, rhythms[i]!, played, bar.id, barIndex === 0);
    });
    const durations = graced.map((voice) => voice.durations);
    if (graced.some((voice) => voice.barStartOnBeat.size)) barStartGraceBars.add(bar.id);
    const graceDonors = measure.voices.map((voice, i) => {
      let main = 0;
      return voice.beats.map((beat, j) => !beat.graceNote && compare(durations[i]![j]!, mainDurations[i]![main++]!) !== 0);
    });
    for (const [voiceIndex, voice] of measure.voices.entries()) {
      const voiceId = voices[voiceIndex]!;
      unknownKeys(voice, new Set(['beats', 'rest']), `Part ${raw.partId} ${voiceId}`, [bar.id]);
      if (!voice.beats.length) fail(`Part ${raw.partId} ${bar.id}: no explicit source beat/rest; silence not invented.`, 'unsupported', 'unsupported-construct', [bar.id]);
      let offset = q(0);
      let prior = previous.get(voiceId) ?? new Map<number, NoteEvent>();
      for (const [beatIndex, beat] of voice.beats.entries()) {
        const beatId = rawBeatId(raw.partId, barIndex, voiceIndex, beatIndex);
        const rhythm = rhythms[voiceIndex]![beatIndex]!;
        const duration = durations[voiceIndex]![beatIndex]!;
        const start = add(bar.start, offset);
        offset = add(offset, duration);
        if (compare(offset, bar.length) > 0) fail(`Part ${raw.partId} ${bar.id}: voice overfills meter.`, 'unsupported', 'unsupported-construct', [bar.id]);
        const beatEffects: Effect[] = Object.keys(beat).filter((key) => !beatKeys.has(key)).map((key) => (options.simplifyOrnaments === true ? simplifiedOrnament(key, (beat as Record<string, unknown>)[key], beatId) : null) ?? ({ code: `unsupported-${key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'field'}`, description: `Uninterpreted source beat field: ${key.slice(0, 100)}. Original value retained in raw artifact.`, affectsMelody: true }));
        const ref = (noteIndex: number): SourceRef => ({
          sourceNoteId: `${beatId}:n${noteIndex}`, partId: raw.partId, barId: bar.id, voiceId, beatId, noteIndex,
          rawWholeNoteDuration: rhythm.whole,
          sourcePosition: !percussion && beat.notes[noteIndex]?.string !== undefined && beat.notes[noteIndex]!.string! >= 0 && beat.notes[noteIndex]?.fret !== undefined ? { stringIndex: beat.notes[noteIndex]!.string!, fret: beat.notes[noteIndex]!.fret! } : null,
        });
        const isRest = beat.rest || voice.rest || measure.rest || beat.notes.every((n) => n.rest);
        if (isRest) {
          if (beat.notes.some((n) => !n.rest && n.fret !== undefined)) fail(`Conflicting rest and sounding-note flags at ${beatId}.`);
          if (beatEffects.length) fail(`Unsupported effect on rest ${beatId}.`);
          events.push({ kind: 'rest', id: `${beatId}:rest`, partId: raw.partId, voiceId, start, duration, refs: beat.notes.map((_, n) => ref(n)) });
          prior = new Map();
          continue;
        }
        const current = new Map<number, NoteEvent>();
        const byPitch = new Map<number, number[]>();
        // A dead (muted) string without a fret is an unpitched strum scratch. It is retained raw and
        // disclosed on the beat's pitched members; a beat of only muted strings is not interpreted.
        const muted = beat.notes.flatMap((note, noteIndex) => !note.rest && note.fret === undefined && (note as { dead?: unknown }).dead === true ? [noteIndex] : []);
        if (muted.length) {
          if (muted.length === beat.notes.length) fail(`Beat of only unpitched muted strings at ${beatId}; no pitch or rest invented.`, 'unsupported', 'unsupported-construct', [bar.id]);
          if (muted.some((i) => Object.keys(beat.notes[i]!).some((key) => !['string', 'dead'].includes(key)))) fail(`Muted string with extra fields at ${beatId}; not interpreted.`, 'unsupported', 'unsupported-construct', [bar.id]);
          mutedStringBars.add(bar.id);
        }
        for (const [noteIndex, note] of beat.notes.entries()) {
          if (muted.includes(noteIndex)) continue;
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
          if (muted.length) effects.push({ code: 'source-muted-strings-omitted', description: JSON.stringify({ beatId, mutedSourceNoteIds: muted.map((i) => ref(i).sourceNoteId), policy: 'unpitched-dead-strings-not-pitched-events' }), affectsMelody: false });
          if (beat.chord) effects.push({ code: 'source-chord-label', description: JSON.stringify({ beatId, ...beat.chord, policy: 'descriptive-label-only-explicit-notes-authoritative' }), affectsMelody: false });
          // Retain exact notation hints for every raw member/continuation, without adding parallel domain types.
          effects.push({ code: 'source-notation', description: JSON.stringify({ beatId, type: rhythm.type, dots: rhythm.dots, tuplet: rhythm.actual, normal: rhythm.normal, tupletStart: beat.tupletStart ?? false, tupletStop: beat.tupletStop ?? false }), affectsMelody: false });
          if (capo) effects.push({ code: 'source-capo', description: JSON.stringify({ fret: capo, policy: 'source-tuning-plus-capo-plus-relative-fret' }), affectsMelody: false });
          if (beat.graceNote) effects.push({ code: 'source-grace', description: JSON.stringify({ beatId, kind: beat.graceNote, policy: 'songsterr-bounded-time-borrowing-v1', ...(graced[voiceIndex]!.barStartOnBeat.has(beatIndex) ? { interpretation: 'bar-opening-before-beat-played-on-beat' } : {}), nominalDuration: rhythm.duration, interpretedDuration: duration }), affectsMelody: false });
          else if (graceDonors[voiceIndex]![beatIndex]) effects.push({ code: 'source-grace-donor', description: JSON.stringify({ beatId, policy: 'songsterr-bounded-time-borrowing-v1', interpretedDuration: duration }), affectsMelody: false });
          if (tripletFeels[barIndex] !== 'off') effects.push({ code: 'source-triplet-feel', description: JSON.stringify({ beatId, feel: tripletFeels[barIndex], writtenDuration: rhythm.duration, interpretedDuration: duration }), affectsMelody: false });
          for (const index of indexes) {
            const note = beat.notes[index]!;
            for (const key of Object.keys(note).filter((key) => !noteKeys.has(key))) {
              if (key === 'bend' && options.simplifyBends === true) {
                effects.push(simplifiedBend(note[key], ref(index).sourceNoteId));
                continue;
              }
              // Display-only spelling hints; sounding pitch still comes from tuning + capo + fret.
              const spelling = note[key];
              if ((key === 'courtesyAccidental' && typeof spelling === 'boolean')
                || (key === 'spn' && Array.isArray(spelling) && spelling.length <= 4 && spelling.every((v) => Number.isInteger(v) && v >= -16 && v <= 16))) {
                effects.push({ code: `source-notation-${key}`, description: JSON.stringify({ sourceNoteId: ref(index).sourceNoteId, field: key, value: spelling, policy: 'display-spelling-only-not-reproduced' }), affectsMelody: false });
                continue;
              }
              const ornament = options.simplifyOrnaments === true ? simplifiedOrnament(key, note[key], ref(index).sourceNoteId) : null;
              if (ornament) { effects.push(ornament); continue; }
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
            event.duration = add(event.duration, duration);
            event.refs.push(...refs);
            event.effects.push(...effects);
            event.tieChainId = `tie:${event.id}`;
          } else {
            event = { kind: 'note', id: refs[0]!.sourceNoteId, partId: raw.partId, voiceId, start, duration, soundingMidi: midi, spelling: spelling(midi), tieChainId: null, refs, effects };
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
  const closedSlides = resolveClosedSlides(raw, events);
  if (raw.measures.some((measure) => measure.voices.some((voice) => voice.beats.some((beat) => beat.chord)))) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: validated printed chord text/layout retained as descriptive source labels, not interpreted as new notes, timing, declared key or automatic chord substitutions. Explicit source notes remain authoritative.`, 'info'));
  if (closedSlides) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: ${closedSlides} closed legato/shift slides resolved to their explicit contiguous same-string source-note endpoints. All nominal pitches, onsets and releases remain intact; continuous glides and slide glyphs are not reproduced in the draft. Open-ended, orphan and unknown slides remain unsupported.`, 'warning'));
  if (measureRestBars.size) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: explicit full-measure rest symbols use the current meter length; original whole-note symbol durations remain in raw references. No pitched or partial beat was resized.`, 'info', [...measureRestBars]));
  const simplifiedBends = events.filter((event) => event.kind === 'note' && event.effects.some((effect) => effect.code === 'source-bend-simplified'));
  if (simplifiedBends.length) diagnostics.push(diagnostic('unsupported-construct', `Explicit simplified-melody draft: ${simplifiedBends.length} bent source notes in part ${raw.partId} retain their notated starting pitches and exact metrical durations, but NOT bend pitch motion. Raw curves are retained. Do not claim exact expressive melody fidelity.`, 'warning', [], simplifiedBends.map((event) => event.id)));
  const simplifiedOrnaments = events.filter((event) => event.kind === 'note' && event.effects.some((effect) => effect.code === 'source-ornament-simplified'));
  if (simplifiedOrnaments.length) diagnostics.push(diagnostic('unsupported-construct', `Explicit simplified-melody draft: ${simplifiedOrnaments.length} source notes in part ${raw.partId} with slide-in/slide-out glides, vibrato or let-ring retain their notated pitches, onsets and exact metrical durations, but NOT the glide, vibrato or let-ring sustain. Raw values are retained. Do not claim exact expressive melody fidelity.`, 'warning', [], simplifiedOrnaments.map((event) => event.id)));
  if (raw.measures.some((measure) => measure.voices.some((voice) => voice.beats.some((beat) => beat.graceNote)))) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: grace pitches and raw references retained as separate exact attacks using disclosed source-player bounded time borrowing. Grace notation adds no extra bar time; donor notes/rests supply the time.`, 'info'));
  if (mutedStringBars.size) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: unpitched muted (dead) strings without frets inside otherwise pitched strums are retained raw and disclosed on those beats, but are not pitched events or percussion audio.`, 'info', [...mutedStringBars]));
  if (barStartGraceBars.size) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: before-beat grace groups that open a bar are played on the beat, borrowing from the following note in the same bar, as at score zero. The previous bar is not shortened and no attack crosses a barline or repeat boundary, so these graces sound slightly later than a before-beat reading.`, 'warning', [...barStartGraceBars]));
  if (tripletFeels.some((feel) => feel !== 'off')) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: eighth/sixteenth swing materialized as exact 2:1 rational timing, with inherited settings and explicit straight-time resets. Explicit tuplets/finer subdivisions retain straight timing in their pair; raw notation durations are retained. No additional playback swing is needed.`, 'info', bars.filter((_, i) => tripletFeels[i] !== 'off').map((bar) => bar.id)));
  const eventsById = new Map(events.map((event) => [event.id, event]));
  for (const [code, locations] of unsupported) {
    const unresolved = [...locations.events].filter((id) => {
      const event = eventsById.get(id);
      return event?.kind === 'note' && event.effects.some((effect) => effect.code === code && effect.affectsMelody);
    });
    if (unresolved.length) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: ${code} retained and explicitly unsupported for melody selection.`, 'warning', [...locations.bars], unresolved));
  }
  if (events.some((e) => e.kind === 'note' && e.effects.some((effect) => effect.code.startsWith('articulation-')))) diagnostics.push(diagnostic('unsupported-construct', `Part ${raw.partId}: expressive articulations (including legato/hammer-pull and staccato when present) retained as effects, not reproduced in draft engraving/audio. Nominal pitches and metrical durations are preserved; this is not expressive source-performance playback.`));
  return { part, events, diagnostics };
}

export async function sameStructure(a: ReturnType<typeof normalizeStructure>, b: ReturnType<typeof normalizeStructure>): Promise<boolean> {
  return await contentDigest(a) === await contentDigest(b);
}

export type DeclaredKeySignature = { accidentals: number; symbol: '#' | 'b'; mode: 'major' | 'minor' };

/**
 * Songsterr `keySignature` draws |accidentalCount| accidentals of the `transposeAs` symbol
 * in the declared mode. Only one opening declaration, repeated identically, is interpreted.
 * Changes, cancellations (null), sign/symbol conflicts and unknown fields fail closed.
 * Parts without any declaration return null (no key is invented for them).
 */
export function declaredKeySignature(raw: RawPart): DeclaredKeySignature | null {
  let declared: DeclaredKeySignature | null = null;
  raw.measures.forEach((measure, i) => {
    const id = `bar-${i + 1}`;
    if (!('keySignature' in measure)) return;
    const value = (measure as { keySignature?: unknown }).keySignature;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(`Part ${raw.partId} bar ${i + 1}: key signature cancellation/non-object is unsupported; not interpreted.`, 'unsupported', 'unsupported-construct', [id]);
    unknownKeys(value as Record<string, unknown>, new Set(['accidentalCount', 'mode', 'transposeAs']), `Part ${raw.partId} bar ${i + 1} keySignature`, [id]);
    const { accidentalCount, mode, transposeAs } = value as { accidentalCount?: unknown; mode?: unknown; transposeAs?: unknown };
    if (!Number.isInteger(accidentalCount) || Math.abs(accidentalCount as number) > 7 || (mode !== 'major' && mode !== 'minor') || (transposeAs !== '#' && transposeAs !== 'b')) return fail(`Part ${raw.partId} bar ${i + 1}: malformed key signature; not interpreted.`, 'unsupported', 'unsupported-construct', [id]);
    if ((accidentalCount as number) < 0 && transposeAs === '#') return fail(`Part ${raw.partId} bar ${i + 1}: key signature has a negative accidental count with a sharp symbol; not interpreted.`, 'unsupported', 'unsupported-construct', [id]);
    const next: DeclaredKeySignature = { accidentals: Math.abs(accidentalCount as number), symbol: transposeAs, mode };
    if (declared === null) {
      if (i !== 0) return fail(`Part ${raw.partId}: key signature first declared after bar 1; mid-song key changes are unsupported.`, 'unsupported', 'unsupported-construct', [id]);
      declared = next;
    } else if (declared.accidentals !== next.accidentals || declared.mode !== next.mode || (declared.accidentals !== 0 && declared.symbol !== next.symbol)) {
      return fail(`Part ${raw.partId} bar ${i + 1}: key signature change is unsupported; not flattened.`, 'unsupported', 'unsupported-construct', [id]);
    }
  });
  return declared;
}

/** Every declaring part must agree. Undeclaring parts add no key evidence. */
export function sourceKey(declarations: Array<{ partId: number; key: DeclaredKeySignature | null }>, events: SourceEvent[]): SourceScoreV1['key'] {
  const declaring = declarations.filter((d): d is { partId: number; key: DeclaredKeySignature } => d.key !== null);
  if (!declaring.length) return deriveUncertainKey(events);
  const first = declaring[0]!.key;
  if (declaring.some(({ key }) => key.accidentals !== first.accidentals || key.mode !== first.mode || (key.accidentals !== 0 && key.symbol !== first.symbol))) {
    return fail(`Source parts declare conflicting key signatures (${declaring.map(({ partId, key }) => `part ${partId}: ${key.accidentals}${key.symbol} ${key.mode}`).join('; ')}); not reconciled.`, 'unsupported', 'unsupported-construct');
  }
  const step = first.symbol === '#' ? 7 : 5;
  const major = (first.accidentals * step) % 12;
  const tonicPitchClass = first.mode === 'major' ? major : (major + 9) % 12;
  const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const silent = declarations.filter((d) => d.key === null).map((d) => d.partId);
  return {
    status: 'identified', tonicPitchClass, mode: first.mode, certainty: 'source-declared',
    evidence: `Songsterr key signature ${first.accidentals === 0 ? 'with no accidentals' : `of ${first.accidentals} ${first.symbol === '#' ? 'sharp' : 'flat'}${first.accidentals === 1 ? '' : 's'}`} (${first.mode}) declared from bar 1 without changes in part${declaring.length === 1 ? '' : 's'} ${declaring.map((d) => d.partId).join(', ')}${silent.length ? `; part${silent.length === 1 ? '' : 's'} ${silent.join(', ')} declare none` : ''}. Interpreted as ${names[tonicPitchClass]} ${first.mode}. This is the transcriber's notation declaration, not harmonic analysis; modulation and modal colour are not asserted.`,
  };
}

export function deriveUncertainKey(events: SourceEvent[]): SourceScoreV1['key'] {
  const pitchClasses = [...new Set(events.flatMap((event) => event.kind === 'note' && !event.effects.some((e) => e.affectsMelody) ? [event.soundingMidi % 12] : []))].sort((a, b) => a - b);
  return { status: 'unknown', reason: `Fret-based source supplies no declared key/spelling. Observed pitched classes: ${pitchClasses.join(',')}; these do not distinguish tonic/mode or modulation. Any proposed key (including a user hypothesis) requires review. Sharp spellings are a display convention, not key evidence.` };
}

/** Utility used only for source facts/proposals, not a form/performance expansion. */
export function writtenEnd(source: SourceScoreV1) { const last = source.bars.at(-1)!; return add(last.start, last.length); }

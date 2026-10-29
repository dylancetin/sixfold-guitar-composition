import * as at from '@coderline/alphatab';
import { AdapterProjectionSchema, add, compare, exactTicks, q, subtract } from '../domain';
import type { AdapterProjection, NotationSegment, Q, ScoreV1 } from '../domain';
import { checkAbort, requireAdapter } from './errors';
import { compileTimeline, PPQ, ROLES } from './timeline';
import type { CompiledTimeline, PerformedSegment } from './timeline';
import { createNotationSchedule } from './notation-schedule';
import type { NotationMode, NotationSchedule } from './notation-schedule';

type Rhythm = Pick<NotationSegment, 'baseDenominator' | 'dots' | 'tuplet' | 'duration'>;
type Beat = InstanceType<typeof at.model.Beat>;
type Note = InstanceType<typeof at.model.Note>;
type Bounds = { x: number; y: number; w: number; h: number };
export type SvgFragment = { x: number; y: number; width: number; height: number; first: number; last: number; system: number | null; svg: string };
export type NotationLayout = {
  width: number; height: number; fragments: SvgFragment[];
  systems: { index: number; bars: number[]; visual: Bounds; real: Bounds }[];
  beats: { nativeBeatId: string; occurrenceId: string; bounds: Bounds; cursorX: number }[];
};
export type NotationOptions = { title?: string; barsPerRow?: number; fretMode?: 'relative' | 'absolute'; spacing?: 'normal' | 'compact' | 'tight'; showFingerNumbers?: boolean; showMeasureLabels?: boolean; hideTitle?: boolean; notationMode?: NotationMode };

function rhythmCandidates(): Rhythm[] {
  const result: Rhythm[] = [];
  for (const actual of [1, 3, 5, 7, 9, 11, 13, 15]) for (const normal of actual === 1 ? [1] : [2, 4, 8]) {
    // alphaTab 1.8.4 ignores dots===3. Only generate rhythms its duration calculation supports.
    for (const baseDenominator of [1, 2, 4, 8, 16, 32, 64] as const) for (const dots of [0, 1, 2]) {
      const duration = q(4 * (2 ** (dots + 1) - 1) * normal, baseDenominator * 2 ** dots * actual);
      try { exactTicks(duration, PPQ); } catch { continue; }
      result.push({ baseDenominator, dots, tuplet: actual === 1 ? null : { groupId: 'adapter-gap', actual, normal, index: 0 }, duration });
    }
  }
  // Prefer ordinary rests before introducing tuplets: e.g. 5/2 = half + eighth,
  // not an exotic single tuplet/dotted value. Every candidate is exact at native PPQ.
  return result.sort((a, b) => Number(!!a.tuplet) - Number(!!b.tuplet) || compare(b.duration, a.duration) || a.dots - b.dots);
}
const gapRhythms = rhythmCandidates();
function gap(duration: Q): Rhythm[] {
  const result: Rhythm[] = [];
  let remaining = duration;
  while (remaining.n > 0) {
    const rhythm = gapRhythms.find(r => compare(r.duration, remaining) <= 0);
    requireAdapter(rhythm, `Cannot engrave silent gap ${remaining.n}/${remaining.d} exactly`);
    result.push(rhythm); remaining = subtract(remaining, rhythm.duration);
    requireAdapter(result.length < 4096, 'Excessive notation subdivision');
  }
  return result;
}

function assignLanes(timeline: CompiledTimeline): Map<string, number> {
  const assignment = new Map<string, number>();
  let count = 0;
  // Each independent duration gets a lane; equal intervals in one canonical voice become a chord.
  for (const role of ROLES) {
    const voices = [...new Set([...timeline.score.sounds, ...timeline.score.rests].filter(e => e.role === role).map(e => e.voiceId))].sort();
    for (const voice of voices) {
      const events = [...timeline.score.sounds, ...timeline.score.rests].filter(e => e.role === role && e.voiceId === voice).sort((a, b) => compare(a.start, b.start) || compare(b.duration, a.duration) || a.id.localeCompare(b.id));
      const lanes: { index: number; start: Q; duration: Q; end: Q; note: boolean }[] = [];
      for (const event of events) {
        const note = timeline.sounds.has(event.id);
        let lane = lanes.find(l => note && l.note && compare(l.start, event.start) === 0 && compare(l.duration, event.duration) === 0);
        lane ??= lanes.find(l => compare(l.end, event.start) <= 0);
        if (!lane) { lane = { index: count++, start: event.start, duration: event.duration, end: add(event.start, event.duration), note }; lanes.push(lane); }
        else Object.assign(lane, { start: event.start, duration: event.duration, end: add(event.start, event.duration), note });
        assignment.set(event.id, lane.index);
      }
    }
  }
  return assignment;
}

/** Native models are deliberately confined to this adapter module. */
function buildNative(timeline: CompiledTimeline, schedule: NotationSchedule, options: NotationOptions) {
  const settings = new at.Settings();
  settings.core.engine = 'svg'; settings.core.enableLazyLoading = false; settings.core.includeNoteBounds = true;
  settings.display.barsPerRow = options.barsPerRow ?? 2;
  settings.display.barCountPerPartial = 1;
  settings.display.justifyLastSystem = true;
  // Opt-in display options; keep the immutable published PDF defaults unchanged.
  if (options.spacing === 'compact' || options.spacing === 'tight') {
    const tight = options.spacing === 'tight';
    settings.display.padding = tight ? [12, 8] : [20, 16];
    settings.display.systemPaddingTop = tight ? 0 : 4;
    settings.display.systemPaddingBottom = tight ? 0 : 4;
    settings.display.lastSystemPaddingBottom = tight ? 0 : 4;
  }
  settings.display.resources.secondaryGlyphColor = settings.display.resources.mainGlyphColor;
  // One explicit caption in subtitle/header; hide alphaTab's duplicate caption on staff + TAB.
  settings.notation.elements.set(at.NotationElement.EffectCapo, false);
  if (options.hideTitle) settings.notation.elements.set(at.NotationElement.ScoreTitle, false);
  const score = new at.model.Score();
  const canonical = timeline.score;
  score.title = options.title ?? 'Solo guitar arrangement';
  const absoluteFrets = options.fretMode === 'absolute';
  const formCaption = schedule.folded ? 'folded repeats' : schedule.unfoldedReason ? `unfolded, ${schedule.unfoldedReason}` : 'unfolded performance';
  score.subTitle = `Capo ${canonical.instrument.capo} | ${absoluteFrets ? 'absolute neck frets' : 'frets relative to capo'} | ${formCaption}`;
  const track = new at.model.Track(); track.name = 'Guitar'; track.shortName = 'Gtr.';
  track.playbackInfo.program = 24;
  score.addTrack(track);
  const staff = new at.model.Staff();
  staff.stringTuning = new at.model.Tuning('Standard EADGBE', [...canonical.instrument.tuning].reverse(), true);
  staff.capo = absoluteFrets ? 0 : canonical.instrument.capo; staff.transpositionPitch = 0; staff.displayTranspositionPitch = -12;
  staff.showStandardNotation = true; staff.showTablature = true; track.addStaff(staff);
  const laneFor = assignLanes(timeline);
  const laneCount = Math.max(...laneFor.values()) + 1;
  const mappings: AdapterProjection['mapping'] = [];
  const nativeBeats: { beat: Beat; occurrenceIds: string[]; at: Q; duration: Q }[] = [];
  const nativeNotes: { note: Note; segment: PerformedSegment }[] = [];
  let beatId = 0, noteId = 0;
  let previousBpm: number | undefined;
  for (const [index, display] of schedule.bars.entries()) {
    const { written, representative: occurrence } = display;
    const master = new at.model.MasterBar();
    master.timeSignatureNumerator = occurrence.meter.beats; master.timeSignatureDenominator = occurrence.meter.beatUnit;
    master.isAnacrusis = written.kind !== 'full';
    const repeat = schedule.folded ? canonical.form.repeats.find(r => r.fromBarId === written.id) : undefined;
    const repeatEnd = repeat && schedule.bars.find(b => b.written.id === repeat.toBarId)!;
    const repeatEndBpm = repeatEnd && canonical.performedTempos.filter(t => t.occurrenceId === repeatEnd.representative.id).at(-1)!.quarterBpm;
    for (const tempo of canonical.performedTempos.filter(t => t.occurrenceId === occurrence.id)) {
      const offset = subtract(tempo.start, occurrence.start);
      // Preserve all effective tempos, but engrave only the opening tempo and
      // actual changes, including tempo restoration at a repeat jump.
      const restoresRepeat = offset.n === 0 && repeatEndBpm !== undefined && repeatEndBpm !== tempo.quarterBpm;
      master.tempoAutomations.push(at.model.Automation.buildTempoAutomation(false, (offset.n / offset.d) / (occurrence.length.n / occurrence.length.d), tempo.quarterBpm, 2, tempo.quarterBpm !== previousBpm || restoresRepeat));
      previousBpm = tempo.quarterBpm;
    }
    if (schedule.folded) {
      master.isRepeatStart = !!repeat;
      master.repeatCount = canonical.form.repeats.find(r => r.toBarId === written.id)?.totalPasses ?? 0;
    }
    score.addMasterBar(master);
    const bar = new at.model.Bar(); staff.addBar(bar);
    for (let lane = 0; lane < laneCount; lane++) {
      const voice = new at.model.Voice(); bar.addVoice(voice);
      let position = occurrence.start;
      const makeBeat = (rhythm: Rhythm, atTime: Q) => {
        const beat = new at.model.Beat(); beat.id = beatId++;
        beat.duration = rhythm.baseDenominator; beat.dots = rhythm.dots;
        if (rhythm.tuplet) { beat.tupletNumerator = rhythm.tuplet.actual; beat.tupletDenominator = rhythm.tuplet.normal; }
        voice.addBeat(beat); nativeBeats.push({ beat, occurrenceIds: display.occurrences.map(o => o.id), at: add(display.start, subtract(atTime, occurrence.start)), duration: rhythm.duration });
        return beat;
      };
      const addGap = (until: Q) => {
        requireAdapter(compare(position, until) <= 0, 'Overlapping durations in a native voice');
        for (const rhythm of gap(subtract(until, position))) { makeBeat(rhythm, position); position = add(position, rhythm.duration); }
      };
      const segments = timeline.segments.filter(s => s.occurrence.id === occurrence.id && laneFor.get(s.segment.eventId) === lane).sort((a, b) => compare(a.at, b.at) || a.segment.id.localeCompare(b.segment.id));
      for (let i = 0; i < segments.length;) {
        const first = segments[i]!;
        addGap(first.at);
        const beat = makeBeat(first.segment, first.at);
        const members = [first]; i++;
        while (i < segments.length && compare(segments[i]!.at, first.at) === 0 && compare(segments[i]!.segment.duration, first.segment.duration) === 0) members.push(segments[i++]!);
        for (const member of members) {
          const { segment, performed } = member;
          let nativeNoteId: string | null = null;
          if (performed) {
            const note = new at.model.Note(); note.id = noteId++; note.string = performed.placement.stringIndex + 1; note.fret = performed.placement.fret + (absoluteFrets ? canonical.instrument.capo : 0);
            // Guitar fingering uses 0 for an open string; alphaTab's 0 means thumb.
            if (options.showFingerNumbers) note.leftHandFinger = performed.placement.finger === 0 ? at.model.Fingers.NoOrDead : performed.placement.finger;
            note.isTieDestination = compare(member.at, performed.start) > 0;
            const sound = timeline.sounds.get(segment.eventId)!;
            note.accidentalMode = sound.spelling.alter === -2 ? at.model.NoteAccidentalMode.ForceDoubleFlat : sound.spelling.alter === -1 ? at.model.NoteAccidentalMode.ForceFlat : sound.spelling.alter === 1 ? at.model.NoteAccidentalMode.ForceSharp : sound.spelling.alter === 2 ? at.model.NoteAccidentalMode.ForceDoubleSharp : at.model.NoteAccidentalMode.Default;
            beat.addNote(note); nativeNoteId = String(note.id); nativeNotes.push({ note, segment: member });
          }
          for (const alias of display.occurrences) mappings.push({ eventId: segment.eventId, segmentId: segment.id, occurrenceId: alias.id, nativeBeatId: String(beat.id), nativeNoteId });
        }
        position = add(first.at, first.segment.duration);
      }
      addGap(add(occurrence.start, occurrence.length));
      if (lane === 0 && options.showMeasureLabels) voice.beats[0]!.text = `${display.label}${!schedule.folded && index === schedule.bars.length - 1 ? ' FINAL' : ''}`;
    }
  }
  score.finish(settings);
  for (const { beat, at: atTime, duration } of nativeBeats) {
    const absolute = beat.voice.bar.masterBar.start + beat.playbackStart;
    requireAdapter(absolute === exactTicks(atTime, PPQ) && beat.playbackDuration === exactTicks(duration, PPQ), `alphaTab cannot represent exact timing at beat ${beat.id}`);
  }
  for (const { note, segment } of nativeNotes) {
    requireAdapter(note.realValue === segment.performed!.soundingMidi && note.displayValue === segment.performed!.soundingMidi + 12, `alphaTab pitch/capo/octave mismatch at ${segment.segment.id}`);
    if (note.isTieDestination) requireAdapter(note.tieOrigin !== null, 'Native orphan tie destination');
  }
  for (const [index, master] of score.masterBars.entries()) {
    const barId = schedule.bars[index]!.written.id;
    const start = schedule.folded && canonical.form.repeats.some(r => r.fromBarId === barId);
    const passes = schedule.folded ? canonical.form.repeats.find(r => r.toBarId === barId)?.totalPasses ?? 0 : 0;
    requireAdapter(master.isRepeatStart === start && master.repeatCount === passes && master.isRepeatEnd === (passes > 0), 'Native repeat boundaries/count differ from display schedule');
  }
  requireAdapter(mappings.length === timeline.segments.length && timeline.segments.every(s => mappings.filter(m => m.segmentId === s.segment.id && m.occurrenceId === s.occurrence.id).length === 1), 'Missing/duplicate performed notation mapping');
  return { score, settings, mappings, nativeBeats, nativeNotes };
}

/** Browser-safe, non-audio notation facade. It never exposes native classes or plays the combined part. */
export function createAlphaTabScore(input: ScoreV1, options: NotationOptions = {}) {
  const timeline = compileTimeline(input);
  const schedule = createNotationSchedule(timeline, options.notationMode);
  const native = buildNative(timeline, schedule, options);
  const projection = AdapterProjectionSchema.parse({
    scoreRevision: { id: timeline.score.revision.id, digest: timeline.score.revision.digest },
    ...(schedule.folded ? {
      schemaVersion: 2, form: 'folded-linear-repeats',
      engraving: { partCount: 1, staffAndTab: true, writtenOctaveOffset: 12, bars: schedule.bars.map(b => ({ nativeBarId: b.nativeBarId, writtenBarId: b.written.id, representativeOccurrenceId: b.representative.id, occurrenceIds: b.occurrences.map(o => o.id), displayStart: b.start, label: b.label })), repeats: timeline.score.form.repeats },
    } : {
      schemaVersion: 1, form: 'unfolded-no-repeat-commands', ...(schedule.unfoldedReason ? { unfoldedReason: schedule.unfoldedReason } : {}),
      engraving: { partCount: 1, staffAndTab: true, writtenOctaveOffset: 12, bars: schedule.bars.map(b => ({ occurrenceId: b.representative.id, writtenBarId: b.written.id, pass: b.representative.pass, label: b.label })) },
    }),
    mapping: native.mappings,
    playback: { activeProjection: 'role-separated-only', tracks: ROLES.map((role, channel) => ({ role, channel, program: 24 })), events: timeline.notes.map(({ placement: _placement, occurrenceIds: _occurrences, ...event }) => event) },
  });
  return {
    projection,
    // JSON evidence is useful to inspect native pitch/timing, without leaking renderer classes.
    placements: native.nativeNotes.map(({ note, segment }) => ({ segmentId: segment.segment.id, performedSoundId: segment.performed!.performedSoundId, occurrenceId: segment.occurrence.id, stringIndex: segment.performed!.placement.stringIndex, relativeFret: segment.performed!.placement.fret, displayedFret: note.fret, soundingMidi: note.realValue, writtenMidi: note.displayValue, tieDestination: note.isTieDestination })),
    async renderSvg(width = 750, signal?: AbortSignal): Promise<NotationLayout> {
      checkAbort(signal); requireAdapter(Number.isFinite(width) && width >= 300 && width <= 4000, 'Notation width outside 300–4000');
      const renderer = new at.rendering.ScoreRenderer(native.settings); renderer.width = width;
      const chunks: at.rendering.RenderFinishedEventArgs[] = [];
      renderer.partialRenderFinished.on(r => chunks.push(r));
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => finish(new Error('Notation render timeout')), 15000);
          const abort = () => finish(signal?.reason instanceof Error ? signal.reason : new Error('Aborted'));
          signal?.addEventListener('abort', abort, { once: true });
          const finish = (error?: Error) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
          renderer.postRenderFinished.on(() => finish());
          renderer.error.on(error => finish(error));
          try { renderer.renderScore(native.score, [0]); } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
        });
        checkAbort(signal);
        const bounds = renderer.boundsLookup;
        requireAdapter(bounds?.isFinished, 'Missing finished notation bounds');
        const systems = bounds.staffSystems.map(s => ({ index: s.index, bars: s.bars.map(b => b.index), visual: { ...s.visualBounds }, real: { ...s.realBounds } }));
        requireAdapter(JSON.stringify(systems.flatMap(s => s.bars)) === JSON.stringify(schedule.bars.map((_, i) => i)), 'Renderer omitted or duplicated display bar');
        const fragments = chunks.map(c => {
          requireAdapter(typeof c.renderResult === 'string', 'Expected SVG renderer output');
          const contained = systems.filter(s => s.bars[0]! >= c.firstMasterBarIndex && s.bars.at(-1)! <= c.lastMasterBarIndex);
          if (c.firstMasterBarIndex >= 0) {
            requireAdapter(contained.length === 1, 'Partial must contain one complete system');
            const system = contained[0]!;
            requireAdapter(system.bars[0] === c.firstMasterBarIndex && system.bars.at(-1) === c.lastMasterBarIndex, 'Partial clips system bars');
            requireAdapter(system.visual.y >= c.y - 1 && system.visual.y + system.visual.h <= c.y + c.height + 1 && system.visual.x >= c.x - 1 && system.visual.x + system.visual.w <= c.x + c.width + 1, 'Partial clips system bounds');
          }
          return { x: c.x, y: c.y, width: c.width, height: c.height, first: c.firstMasterBarIndex, last: c.lastMasterBarIndex, system: c.firstMasterBarIndex < 0 ? null : contained[0]!.index, svg: c.renderResult.replaceAll('class="at"', 'class="at" font-family="alphaTab" font-size="34"') };
        });
        requireAdapter(fragments.filter(f => f.system !== null).length === systems.length, 'Missing system SVG');
        const beats = native.nativeBeats.flatMap(({ beat, occurrenceIds }) => {
          const b = bounds.findBeat(beat);
          return b ? occurrenceIds.map(occurrenceId => ({ nativeBeatId: String(beat.id), occurrenceId, bounds: { ...b.realBounds }, cursorX: b.onNotesX })) : [];
        });
        requireAdapter(projection.mapping.every(m => beats.some(b => b.nativeBeatId === m.nativeBeatId && b.occurrenceId === m.occurrenceId)), 'Rendered geometry omitted a performed notation mapping');
        return { width, height: Math.max(...fragments.map(f => f.y + f.height)), fragments, systems, beats };
      } finally { renderer.destroy(); }
    },
  };
}

export type CanonicalNotation = ReturnType<typeof createAlphaTabScore>;

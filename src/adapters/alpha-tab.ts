import * as at from '@coderline/alphatab';
import { AdapterProjectionSchema, add, compare, exactTicks, q, subtract } from '../domain';
import type { AdapterProjection, NotationSegment, Q, ScoreV1 } from '../domain';
import { checkAbort, requireAdapter } from './errors';
import { compileTimeline, PPQ, ROLES } from './timeline';
import type { CompiledTimeline, PerformedSegment } from './timeline';

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
export type NotationOptions = { title?: string; barsPerRow?: number };

function rhythmCandidates(): Rhythm[] {
  const result: Rhythm[] = [];
  for (const actual of [1, 3, 5, 7, 9, 11, 13, 15]) for (const normal of actual === 1 ? [1] : [2, 4, 8]) {
    for (const baseDenominator of [1, 2, 4, 8, 16, 32, 64] as const) for (const dots of [0, 1, 2, 3]) {
      const duration = q(4 * (2 ** (dots + 1) - 1) * normal, baseDenominator * 2 ** dots * actual);
      try { exactTicks(duration, PPQ); } catch { continue; }
      result.push({ baseDenominator, dots, tuplet: actual === 1 ? null : { groupId: 'adapter-gap', actual, normal, index: 0 }, duration });
    }
  }
  return result.sort((a, b) => compare(b.duration, a.duration) || Number(!!a.tuplet) - Number(!!b.tuplet) || a.dots - b.dots);
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
function buildNative(timeline: CompiledTimeline, options: NotationOptions) {
  const settings = new at.Settings();
  settings.core.engine = 'svg'; settings.core.enableLazyLoading = false; settings.core.includeNoteBounds = true;
  settings.display.barsPerRow = options.barsPerRow ?? 2;
  settings.display.barCountPerPartial = 1;
  settings.display.justifyLastSystem = true;
  settings.display.resources.secondaryGlyphColor = settings.display.resources.mainGlyphColor;
  // One explicit caption in subtitle/header; hide alphaTab's duplicate caption on staff + TAB.
  settings.notation.elements.set(at.NotationElement.EffectCapo, false);
  const score = new at.model.Score();
  const canonical = timeline.score;
  score.title = options.title ?? 'Solo guitar arrangement';
  score.subTitle = `Capo ${canonical.instrument.capo} | frets relative to capo | unfolded performance`;
  const track = new at.model.Track(); track.name = 'Guitar'; track.shortName = 'Gtr.';
  track.playbackInfo.program = 24;
  score.addTrack(track);
  const staff = new at.model.Staff();
  staff.stringTuning = new at.model.Tuning('Standard EADGBE', [...canonical.instrument.tuning].reverse(), true);
  staff.capo = canonical.instrument.capo; staff.transpositionPitch = 0; staff.displayTranspositionPitch = -12;
  staff.showStandardNotation = true; staff.showTablature = true; track.addStaff(staff);
  const laneFor = assignLanes(timeline);
  const laneCount = Math.max(...laneFor.values()) + 1;
  const mappings: AdapterProjection['mapping'] = [];
  const nativeBeats: { beat: Beat; occurrenceId: string; at: Q; duration: Q }[] = [];
  const nativeNotes: { note: Note; segment: PerformedSegment }[] = [];
  let beatId = 0, noteId = 0;
  for (const [index, occurrence] of canonical.occurrences.entries()) {
    const written = timeline.bars.get(occurrence.writtenBarId)!;
    const master = new at.model.MasterBar();
    master.timeSignatureNumerator = occurrence.meter.beats; master.timeSignatureDenominator = occurrence.meter.beatUnit;
    master.isAnacrusis = written.kind !== 'full';
    for (const tempo of canonical.performedTempos.filter(t => t.occurrenceId === occurrence.id)) {
      const offset = subtract(tempo.start, occurrence.start);
      master.tempoAutomations.push(at.model.Automation.buildTempoAutomation(false, (offset.n / offset.d) / (occurrence.length.n / occurrence.length.d), tempo.quarterBpm, 2, true));
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
        voice.addBeat(beat); nativeBeats.push({ beat, occurrenceId: occurrence.id, at: atTime, duration: rhythm.duration });
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
            const note = new at.model.Note(); note.id = noteId++; note.string = performed.placement.stringIndex + 1; note.fret = performed.placement.fret;
            note.isTieDestination = compare(member.at, performed.start) > 0;
            const sound = timeline.sounds.get(segment.eventId)!;
            note.accidentalMode = sound.spelling.alter === -2 ? at.model.NoteAccidentalMode.ForceDoubleFlat : sound.spelling.alter === -1 ? at.model.NoteAccidentalMode.ForceFlat : sound.spelling.alter === 1 ? at.model.NoteAccidentalMode.ForceSharp : sound.spelling.alter === 2 ? at.model.NoteAccidentalMode.ForceDoubleSharp : at.model.NoteAccidentalMode.Default;
            beat.addNote(note); nativeNoteId = String(note.id); nativeNotes.push({ note, segment: member });
          }
          mappings.push({ eventId: segment.eventId, segmentId: segment.id, occurrenceId: occurrence.id, nativeBeatId: String(beat.id), nativeNoteId });
        }
        position = add(first.at, first.segment.duration);
      }
      addGap(add(occurrence.start, occurrence.length));
      if (lane === 0) voice.beats[0]!.text = `${occurrence.id}/S${written.number}/P${occurrence.pass}${index === canonical.occurrences.length - 1 ? ' FINAL' : ''}`;
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
  requireAdapter(score.masterBars.every(b => !b.isRepeatStart && !b.isRepeatEnd), 'Native repeats would double playback');
  return { score, settings, mappings, nativeBeats, nativeNotes };
}

/** Browser-safe, non-audio notation facade. It never exposes native classes or plays the combined part. */
export function createAlphaTabScore(input: ScoreV1, options: NotationOptions = {}) {
  const timeline = compileTimeline(input);
  const native = buildNative(timeline, options);
  const projection = AdapterProjectionSchema.parse({
    schemaVersion: 1, scoreRevision: { id: timeline.score.revision.id, digest: timeline.score.revision.digest }, form: 'unfolded-no-repeat-commands',
    engraving: { partCount: 1, staffAndTab: true, writtenOctaveOffset: 12, bars: timeline.score.occurrences.map(o => ({ occurrenceId: o.id, writtenBarId: o.writtenBarId, pass: o.pass, label: `${o.id}/S${timeline.bars.get(o.writtenBarId)!.number}/P${o.pass}` })) },
    mapping: native.mappings,
    playback: { activeProjection: 'role-separated-only', tracks: ROLES.map((role, channel) => ({ role, channel, program: 24 })), events: timeline.notes.map(({ placement: _placement, occurrenceIds: _occurrences, ...event }) => event) },
  });
  return {
    projection,
    // JSON evidence is useful to inspect native pitch/timing, without leaking renderer classes.
    placements: native.nativeNotes.map(({ note, segment }) => ({ segmentId: segment.segment.id, performedSoundId: segment.performed!.performedSoundId, occurrenceId: segment.occurrence.id, stringIndex: segment.performed!.placement.stringIndex, relativeFret: note.fret, soundingMidi: note.realValue, writtenMidi: note.displayValue, tieDestination: note.isTieDestination })),
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
        requireAdapter(JSON.stringify(systems.flatMap(s => s.bars)) === JSON.stringify(timeline.score.occurrences.map((_, i) => i)), 'Renderer omitted or duplicated occurrence');
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
        const beats = native.nativeBeats.flatMap(({ beat, occurrenceId }) => {
          const b = bounds.findBeat(beat);
          return b ? [{ nativeBeatId: String(beat.id), occurrenceId, bounds: { ...b.realBounds }, cursorX: b.onNotesX }] : [];
        });
        return { width, height: Math.max(...fragments.map(f => f.y + f.height)), fragments, systems, beats };
      } finally { renderer.destroy(); }
    },
  };
}

export type CanonicalNotation = ReturnType<typeof createAlphaTabScore>;

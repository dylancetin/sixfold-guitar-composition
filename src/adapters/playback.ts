import type { ScoreV1 } from '../domain';
import { requireAdapter } from './errors';
import { compileTimeline, createTempoClock, ROLES } from './timeline';
import type { Role } from './timeline';
import { createPluckedVoice } from './plucked';

export type PlaybackState = 'idle' | 'ready' | 'playing' | 'paused' | 'ended' | 'error' | 'disposed';
export type PlaybackLoop = { startQuarter: number; endQuarter: number };
export type PlaybackSnapshot = {
  state: PlaybackState; readiness: 'needs-gesture' | 'ready' | 'unavailable'; audioState: string;
  tone: 'sampled-acoustic-guitar'; positionQuarter: number; positionSeconds: number; durationSeconds: number;
  tempoScale: number; loop: PlaybackLoop | null; occurrenceId: string | null;
  activePerformedSoundIds: string[]; audiblePerformedSoundIds: string[];
  activeSegments: { eventId: string; segmentId: string; occurrenceId: string; performedSoundId: string | null }[];
  mutedRoles: Role[]; soloRoles: Role[]; error: string | null;
};
export type ScheduleRecord = { performedSoundId: string; cycle: number; expectedAudioTime: number; audioTime: number; offAudioTime: number; elapsedSeconds: number };
export type PlaybackOptions = {
  audioContextFactory?: () => AudioContext;
  /** Injectable timer for deterministic audio-clock tests. Never use timer ticks as musical time. */
  scheduler?: (tick: () => void, intervalMs: number) => () => void;
  lookAheadSeconds?: number;
};

/** Canonical performed sounds only. The combined notation track is NEVER an audio source. */
export function createPlaybackController(input: ScoreV1, options: PlaybackOptions = {}) {
  const timeline = compileTimeline(input);
  let scale = timeline.score.preferences.tempoScale, clock = createTempoClock(timeline, scale);
  const endQuarter = timeline.end.n / timeline.end.d;
  let context: AudioContext | null = null;
  const roleGains = new Map<Role, GainNode>();
  const muted = new Set<Role>(), solo = new Set<Role>();
  const listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  const sources = new Map<string, { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode }>();
  const scheduled = new Map<string, number>();
  const log: ScheduleRecord[] = [];
  let scheduledCount = 0, cancelledCount = 0, missedCount = 0, maxScheduleLatenessMs = 0;
  let state: PlaybackState = 'idle', error: string | null = null, loop: PlaybackLoop | null = null;
  let anchorAudio = 0, anchorPosition = 0, position = 0, loopCount = 0;
  let stopTimer: (() => void) | null = null, generation = 0;
  const lookAhead = options.lookAheadSeconds ?? 0.2;
  requireAdapter(lookAhead >= 0.05 && lookAhead <= 1, 'Playback look-ahead must be 0.05–1 seconds');
  const number = (q: { n: number; d: number }) => q.n / q.d;
  const enabled = (role: Role) => !muted.has(role) && (solo.size === 0 || solo.has(role));
  const loopSeconds = () => loop ? { start: clock.toSeconds(loop.startQuarter), end: clock.toSeconds(loop.endQuarter) } : null;
  const livePosition = () => {
    if (state !== 'playing' || !context) return position;
    const elapsed = Math.max(0, context.currentTime - anchorAudio);
    const bounds = loopSeconds();
    if (bounds) {
      const length = bounds.end - bounds.start;
      return bounds.start + ((anchorPosition - bounds.start + elapsed) % length + length) % length;
    }
    return Math.min(clock.durationSeconds, anchorPosition + elapsed);
  };
  const snapshot = (): PlaybackSnapshot => {
    const seconds = livePosition(), quarter = clock.toQuarter(seconds);
    const occurrence = timeline.score.occurrences.find(o => number(o.start) <= quarter + 1e-9 && quarter < number(o.start) + number(o.length) - 1e-9);
    const active = timeline.notes.filter(n => number(n.start) <= quarter + 1e-9 && quarter < number(n.start) + number(n.duration) - 1e-9);
    return {
      state, readiness: state === 'error' || state === 'disposed' ? 'unavailable' : context?.state === 'running' ? 'ready' : 'needs-gesture', audioState: context?.state ?? 'not-created', tone: 'sampled-acoustic-guitar',
      positionQuarter: quarter, positionSeconds: seconds, durationSeconds: clock.durationSeconds, tempoScale: scale, loop: loop ? { ...loop } : null,
      occurrenceId: occurrence?.id ?? null, activePerformedSoundIds: active.map(n => n.performedSoundId), audiblePerformedSoundIds: state === 'playing' ? active.filter(n => enabled(n.role)).map(n => n.performedSoundId) : [],
      activeSegments: timeline.segments.filter(s => number(s.at) <= quarter + 1e-9 && quarter < number(s.at) + number(s.segment.duration) - 1e-9).map(s => ({ eventId: s.segment.eventId, segmentId: s.segment.id, occurrenceId: s.occurrence.id, performedSoundId: s.performed?.performedSoundId ?? null })),
      mutedRoles: [...muted], soloRoles: [...solo], error,
    };
  };
  const emit = () => { const value = snapshot(); for (const listener of listeners) listener(value); };
  const assertAlive = () => requireAdapter(state !== 'disposed', 'Playback controller has been disposed');
  const cancel = () => {
    generation++; stopTimer?.(); stopTimer = null;
    for (const source of sources.values()) {
      source.gain.gain.cancelScheduledValues(context!.currentTime);
      source.gain.gain.setValueAtTime(0, context!.currentTime);
      try { source.source.stop(context!.currentTime); } catch { /* already ended */ }
      source.source.disconnect(); source.gain.disconnect(); source.filter.disconnect(); cancelledCount++;
    }
    sources.clear(); scheduled.clear();
  };
  const applyRoles = () => {
    if (!context) return;
    for (const role of ROLES) {
      const gain = roleGains.get(role)!.gain;
      gain.cancelScheduledValues(context.currentTime); gain.setValueAtTime(enabled(role) ? 0.65 : 0, context.currentTime);
    }
  };
  const synthesize = (id: string, record: ScheduleRecord, midi: number, role: Role) => {
    const ctx = context!;
    const { source, filter, gain, offset } = createPluckedVoice(ctx, roleGains.get(role)!, midi, record.audioTime, record.offAudioTime, record.elapsedSeconds);
    sources.set(id, { source, filter, gain });
    source.onended = () => {
      if (sources.get(id)?.source !== source) return;
      sources.delete(id); source.disconnect(); filter.disconnect(); gain.disconnect();
    };
    source.start(record.audioTime, offset); source.stop(record.offAudioTime);
  };
  const tick = () => {
    if (state !== 'playing' || !context) return;
    const now = context.currentTime;
    if (context.state !== 'running') { position = livePosition(); cancel(); state = 'paused'; emit(); return; }
    const bounds = loopSeconds();
    const loopLength = bounds ? bounds.end - bounds.start : 0;
    const base = bounds ? anchorAudio - (anchorPosition - bounds.start) : anchorAudio - anchorPosition;
    const firstCycle = bounds ? Math.max(0, Math.floor((now - base) / loopLength)) : 0;
    const lastCycle = bounds ? Math.max(firstCycle, Math.floor((now + lookAhead - base) / loopLength)) : 0;
    loopCount = Math.max(loopCount, firstCycle);
    for (const [key, cycle] of scheduled) if (cycle < firstCycle - 1) scheduled.delete(key);
    for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
      for (const note of timeline.notes) {
        const noteStart = clock.toSeconds(number(note.start)), noteEnd = clock.toSeconds(number(note.start) + number(note.duration));
        const clippedStart = bounds ? Math.max(noteStart, bounds.start) : noteStart, clippedEnd = bounds ? Math.min(noteEnd, bounds.end) : noteEnd;
        if (clippedEnd <= clippedStart) continue;
        const when = bounds ? base + cycle * loopLength + clippedStart - bounds.start : base + clippedStart;
        const until = bounds ? base + cycle * loopLength + clippedEnd - bounds.start : base + clippedEnd;
        const key = `${generation}/${cycle}/${note.performedSoundId}`;
        if (scheduled.has(key) || when > now + lookAhead) continue;
        scheduled.set(key, cycle);
        if (until <= now) { if (until > anchorAudio) missedCount++; continue; }
        const audioTime = Math.max(now, when);
        // A note already held at play/seek is resumed, not counted as scheduler lateness.
        if (when >= anchorAudio) maxScheduleLatenessMs = Math.max(maxScheduleLatenessMs, (audioTime - when) * 1000);
        const record = { performedSoundId: note.performedSoundId, cycle, expectedAudioTime: when, audioTime, offAudioTime: until, elapsedSeconds: clippedStart - noteStart + audioTime - when };
        log.push(record); if (log.length > 512) log.shift(); scheduledCount++;
        synthesize(key, record, note.soundingMidi, note.role);
      }
    }
    if (!bounds && now >= base + clock.durationSeconds) { position = clock.durationSeconds; cancel(); state = 'ended'; }
    emit();
  };
  const start = () => {
    const bounds = loopSeconds();
    if (bounds && (position < bounds.start || position >= bounds.end)) position = bounds.start;
    if (!bounds && position >= clock.durationSeconds) position = 0;
    anchorPosition = position; anchorAudio = context!.currentTime; loopCount = 0; state = 'playing';
    tick();
    const scheduler = options.scheduler ?? ((fn: () => void, ms: number) => { const timer = setInterval(fn, ms); return () => clearInterval(timer); });
    stopTimer = scheduler(tick, 25);
  };
  const reanchor = (quarter: number) => {
    const playing = state === 'playing'; cancel(); position = clock.toSeconds(quarter);
    if (playing && !loop && position >= clock.durationSeconds) { state = 'ended'; emit(); return; }
    if (playing && context?.state === 'running') start(); else emit();
  };
  const prepareFromGesture = async () => {
    assertAlive();
    try {
      if (!context) {
        const factory = options.audioContextFactory ?? (() => new AudioContext());
        context = factory();
        for (const role of ROLES) { const gain = context.createGain(); gain.connect(context.destination); roleGains.set(role, gain); }
        applyRoles();
        context.onstatechange = () => {
          if (state === 'disposed') return;
          if (state === 'playing' && context!.state !== 'running') { position = livePosition(); cancel(); state = 'paused'; }
          emit();
        };
      }
      // Called directly in the gesture stack, before awaiting anything else.
      await context.resume();
      requireAdapter(context.state === 'running', 'Audio is suspended; press Play in a user gesture');
      if (state === 'disposed') return snapshot();
      error = null;
      if (state === 'idle' || state === 'error') state = 'ready';
      emit(); return snapshot();
    } catch (cause) { if (state !== 'disposed') { error = cause instanceof Error ? cause.message : String(cause); state = 'error'; emit(); } throw cause; }
  };
  return {
    prepareFromGesture,
    async play() {
      assertAlive(); const request = generation;
      await prepareFromGesture();
      if (generation !== request || state === 'disposed' || state === 'playing') return;
      start();
    },
    pause() { assertAlive(); position = livePosition(); cancel(); state = 'paused'; emit(); },
    stop() { assertAlive(); cancel(); position = 0; loopCount = 0; state = context ? 'ready' : 'idle'; emit(); },
    seek(quarter: number) { assertAlive(); requireAdapter(Number.isFinite(quarter) && quarter >= 0 && quarter <= endQuarter, 'Seek outside performance'); reanchor(quarter); },
    setTempoScale(value: number) {
      assertAlive(); requireAdapter(Number.isFinite(value) && value >= 0.5 && value <= 1.25, 'Tempo scale outside 0.5–1.25');
      const quarter = clock.toQuarter(livePosition()); scale = value; clock = createTempoClock(timeline, scale); reanchor(quarter);
    },
    setMuted(role: Role, value: boolean) { assertAlive(); requireAdapter(ROLES.includes(role), 'Unknown role'); value ? muted.add(role) : muted.delete(role); applyRoles(); emit(); },
    setSolo(role: Role, value: boolean) { assertAlive(); requireAdapter(ROLES.includes(role), 'Unknown role'); value ? solo.add(role) : solo.delete(role); applyRoles(); emit(); },
    setLoop(value: PlaybackLoop | null) {
      assertAlive(); if (value) requireAdapter(Number.isFinite(value.startQuarter) && Number.isFinite(value.endQuarter) && value.startQuarter >= 0 && value.endQuarter <= endQuarter && value.endQuarter > value.startQuarter && clock.toSeconds(value.endQuarter) - clock.toSeconds(value.startQuarter) >= 0.1, 'Invalid/too-short loop (minimum 100ms)');
      const quarter = clock.toQuarter(livePosition()); loop = value ? { ...value } : null; loopCount = 0; reanchor(quarter);
    },
    getSnapshot: snapshot,
    subscribe(listener: (value: PlaybackSnapshot) => void) { listeners.add(listener); listener(snapshot()); return () => { listeners.delete(listener); }; },
    getMetrics() { return { scheduledCount, cancelledCount, missedCount, maxScheduleLatenessMs, loopCount, activeSourceCount: sources.size, scheduledKeyCount: scheduled.size, audioClockSeconds: context?.currentTime ?? 0, scheduleLog: log.map(r => ({ ...r })) }; },
    async dispose() { if (state === 'disposed') return; cancel(); state = 'disposed'; if (context) { context.onstatechange = null; await context.close(); } emit(); listeners.clear(); },
  };
}

export type PlaybackController = ReturnType<typeof createPlaybackController>;

// Browser entry: no PDFKit, streams, filesystem, Node builtins or server validation authority.
export { createAlphaTabScore } from './alpha-tab';
export type { CanonicalNotation, NotationLayout, NotationOptions, SvgFragment } from './alpha-tab';
export { createPlaybackController } from './playback';
export type { PlaybackController, PlaybackLoop, PlaybackOptions, PlaybackSnapshot, PlaybackState, ScheduleRecord } from './playback';
export { AdapterError } from './errors';
export { createTempoClock, compileTimeline } from './timeline';
export type { CompiledTimeline, PerformedNote, Role } from './timeline';

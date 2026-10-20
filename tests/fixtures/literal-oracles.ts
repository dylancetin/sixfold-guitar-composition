import type { Q } from '../../src/domain';

export const originalMelody = [
  { id: 'm0', pitch: 64, start: { n: 0, d: 1 }, end: { n: 1, d: 1 } },
  { id: 'm1', pitch: 67, start: { n: 1, d: 1 }, end: { n: 5, d: 3 } },
  { id: 'm2', pitch: 66, start: { n: 5, d: 3 }, end: { n: 7, d: 3 } },
  { id: 'm3', pitch: 64, start: { n: 7, d: 3 }, end: { n: 3, d: 1 } },
  { id: 'm4', pitch: 65, start: { n: 3, d: 1 }, end: { n: 5, d: 1 } },
];

export const requestedSongFacts = {
  url: 'https://www.songsterr.com/a/wsa/beach-boys-you-still-believe-in-me-tab-s692866',
  songId: 692866, initialReferenceRevision: 847990, writtenBars: 46,
  occurrenceCount: 64, quarters: 256,
  occurrenceWrittenBars: [
    1, 2, 3, 4, 5, 6, 7, 5, 6, 7,
    8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 17, 18, 19,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46,
    43, 44, 45, 46, 43, 44, 45, 46, 43, 44, 45, 46,
  ],
  writtenTempoPoints: [{ bar: 1, bpm: 80 }, { bar: 5, bpm: 90 }, { bar: 40, bpm: 87 }, { bar: 41, bpm: 85 }, { bar: 43, bpm: 90 }],
  part0Opening: { bar: 5, pitches: [54, 59, 61, 63, 64, 63], attackOffsets: ['0', '1', '2', '5/2', '3', '7/2'] },
  caveat: 'Technical assertions for a future optional live runner; no fetched score, live import or approved full-song melody selection in this suite. The last opening attack ties into the next bar.',
};

export const restoreTempoExample = {
  writtenBars: [1, 2, 3, 2, 3],
  correctEntryBpm: [80, 80, 120, 80, 120],
  incorrectCarriedBpm: [80, 80, 120, 120, 120],
  restoredSeconds: 13, incorrectSeconds: 12,
  jumpQuarter: 12, jumpTickAt960: 11520,
};

export type ContactOracle = {
  id: string; pitch: number; start: Q; end: Q; string: number; fret: number; finger: number;
};
export const sustainCollision: ContactOracle[] = [
  { id: 'protected', pitch: 64, start: { n: 0, d: 1 }, end: { n: 4, d: 1 }, string: 5, fret: 0, finger: 0 },
  { id: 'intruder', pitch: 65, start: { n: 1, d: 1 }, end: { n: 2, d: 1 }, string: 5, fret: 1, finger: 1 },
];
export const heldFingerCollision: ContactOracle[] = [
  { id: 'held', pitch: 65, start: { n: 0, d: 1 }, end: { n: 4, d: 1 }, string: 5, fret: 1, finger: 1 },
  { id: 'moved', pitch: 61, start: { n: 1, d: 1 }, end: { n: 2, d: 1 }, string: 4, fret: 2, finger: 1 },
];
export const fiveStoppedContacts: ContactOracle[] = [
  { id: 'five-0', pitch: 41, start: { n: 0, d: 1 }, end: { n: 1, d: 1 }, string: 0, fret: 1, finger: 1 },
  { id: 'five-1', pitch: 47, start: { n: 0, d: 1 }, end: { n: 1, d: 1 }, string: 1, fret: 2, finger: 2 },
  { id: 'five-2', pitch: 53, start: { n: 0, d: 1 }, end: { n: 1, d: 1 }, string: 2, fret: 3, finger: 3 },
  { id: 'five-3', pitch: 59, start: { n: 0, d: 1 }, end: { n: 1, d: 1 }, string: 3, fret: 4, finger: 4 },
  { id: 'five-4', pitch: 60, start: { n: 0, d: 1 }, end: { n: 1, d: 1 }, string: 4, fret: 1, finger: 1 },
];

export const capoCases = [
  { capo: 2, string: 0, fret: 0, physical: 2, pitch: 42, fitsPhysical12: true },
  { capo: 0, string: 0, fret: 2, physical: 2, pitch: 42, fitsPhysical12: true },
  { capo: 2, string: 0, fret: 10, physical: 12, pitch: 52, fitsPhysical12: true },
  { capo: 2, string: 0, fret: 11, physical: 13, pitch: 53, fitsPhysical12: false },
  { capo: 2, string: 5, fret: 0, physical: 2, pitch: 66, fitsPhysical12: true },
];

export const pendingGates = [
  'U04/F4: bounded importer, restrictions, unsupported effects, exact source identity and revision drift',
  'U05: actual 46->64 expansion, repeat-jump tie rejection and meter/tempo restoration',
  'U06/G2: auditioned full-song monophonic intro/vocal/outro event selectors and approvals',
  'U08/F3: independent production sustain/finger/transition validator and search outcomes',
  'U10/F7: real provider call, invalid IDs/output, timeout/refusal and fallback integration',
  'U11/F5: 60-second audio-clock/cursor fixture and twenty-loop drift measurement',
  'U12/F2: canonical adapter integration of the separate U02 original 16-written/24-occurrence export fixture and artifact audit',
  'U12/G9: persistence/CAS, dependency invalidation and stale-export endpoint behavior',
  'U13/F1: original 8-bar integration fixture with shorter triplets and adapter display-octave proof',
  'U13/F6/F8: fresh requested-song live runner, complete melody at capo 0/2 and no double MIDI transposition',
  'G5: guitarist transition and complete-song musical review',
];

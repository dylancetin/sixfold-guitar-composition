import { ScoreV1Schema, SourceScoreV1Schema } from '../../src/domain';

const sourceDigest = '6d55f7987b730cb2aafbd8f00dfd2da607fcd122aa5254cd965027ae8cf155c3';
const scoreDigest = '416ac8501f01cb56dc3cc02326e1c2e9571badf6d94ea88e2139638386cac2f2';
const sourceRevision = { id: 'original-source-r1', parentId: null, digest: sourceDigest };
const manifest = {
  identity: { kind: 'original-fixture', name: 'Two-bar held-voice study', author: 'Guitar composition project' },
  retrievedAt: '2026-10-20T00:00:00Z', parser: { name: 'literal-fixture', version: '1' },
  artifacts: [{ id: 'original-study-v1', sha256: 'a0d288bc06bafd081bede759fa30f8bb30c65a69217b9cbb7cad08cb2064b044', byteLength: 752, mediaType: 'application/json' }],
};
const bars = [
  { id: 'b1', number: 1, start: { n: 0, d: 1 }, length: { n: 4, d: 1 }, meter: { beats: 4, beatUnit: 4 }, kind: 'full' },
  { id: 'b2', number: 2, start: { n: 4, d: 1 }, length: { n: 4, d: 1 }, meter: { beats: 4, beatUnit: 4 }, kind: 'full' },
];
const tempos = [{ id: 't80', barId: 'b1', offset: { n: 0, d: 1 }, quarterBpm: 80 }];
const form = { kind: 'linear-repeats', repeats: [], tempoPolicy: 'restore-written-position', jumpTiePolicy: 'reject-cross-jump' };
const key = { status: 'unknown', reason: 'Original technical study, no asserted tonal center' };

export const source = SourceScoreV1Schema.parse({
  schemaVersion: 1, revision: sourceRevision, manifest, key, bars, tempos, form,
  parts: [
    { id: 0, name: 'Selected melody', program: 24, voices: ['melody'], sourceTuning: null },
    { id: 1, name: 'Bass evidence', program: 24, voices: ['bass'], sourceTuning: null },
    { id: 2, name: 'Harmony evidence', program: 24, voices: ['harmony'], sourceTuning: null },
  ],
  events: [
    { kind: 'note', id: 'src-m0', partId: 0, voiceId: 'melody', start: { n: 0, d: 1 }, duration: { n: 1, d: 1 }, soundingMidi: 64, spelling: { step: 'E', alter: 0, octave: 4 }, tieChainId: null, effects: [],
      refs: [{ sourceNoteId: 'raw-m0', partId: 0, barId: 'b1', voiceId: 'melody', beatId: 'beat-0', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 4 }, sourcePosition: null }] },
    { kind: 'note', id: 'src-m1', partId: 0, voiceId: 'melody', start: { n: 1, d: 1 }, duration: { n: 2, d: 3 }, soundingMidi: 67, spelling: { step: 'G', alter: 0, octave: 4 }, tieChainId: null, effects: [],
      refs: [{ sourceNoteId: 'raw-m1', partId: 0, barId: 'b1', voiceId: 'melody', beatId: 'beat-1', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 6 }, sourcePosition: null }] },
    { kind: 'note', id: 'src-m2', partId: 0, voiceId: 'melody', start: { n: 5, d: 3 }, duration: { n: 2, d: 3 }, soundingMidi: 66, spelling: { step: 'F', alter: 1, octave: 4 }, tieChainId: null, effects: [],
      refs: [{ sourceNoteId: 'raw-m2', partId: 0, barId: 'b1', voiceId: 'melody', beatId: 'beat-2', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 6 }, sourcePosition: null }] },
    { kind: 'note', id: 'src-m3', partId: 0, voiceId: 'melody', start: { n: 7, d: 3 }, duration: { n: 2, d: 3 }, soundingMidi: 64, spelling: { step: 'E', alter: 0, octave: 4 }, tieChainId: null, effects: [],
      refs: [{ sourceNoteId: 'raw-m3', partId: 0, barId: 'b1', voiceId: 'melody', beatId: 'beat-3', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 6 }, sourcePosition: null }] },
    { kind: 'note', id: 'src-m4', partId: 0, voiceId: 'melody', start: { n: 3, d: 1 }, duration: { n: 2, d: 1 }, soundingMidi: 65, spelling: { step: 'F', alter: 0, octave: 4 }, tieChainId: 'source-tie-1', effects: [],
      refs: [
        { sourceNoteId: 'raw-m4a', partId: 0, barId: 'b1', voiceId: 'melody', beatId: 'beat-4', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 4 }, sourcePosition: null },
        { sourceNoteId: 'raw-m4b', partId: 0, barId: 'b2', voiceId: 'melody', beatId: 'beat-5', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 4 }, sourcePosition: null },
      ] },
    { kind: 'rest', id: 'src-rest', partId: 0, voiceId: 'melody', start: { n: 5, d: 1 }, duration: { n: 3, d: 1 },
      refs: [{ sourceNoteId: 'raw-rest', partId: 0, barId: 'b2', voiceId: 'melody', beatId: 'beat-6', noteIndex: 0, rawWholeNoteDuration: { n: 3, d: 4 }, sourcePosition: null }] },
    { kind: 'note', id: 'src-b0', partId: 1, voiceId: 'bass', start: { n: 0, d: 1 }, duration: { n: 4, d: 1 }, soundingMidi: 40, spelling: { step: 'E', alter: 0, octave: 2 }, tieChainId: null, effects: [],
      refs: [{ sourceNoteId: 'raw-b0', partId: 1, barId: 'b1', voiceId: 'bass', beatId: 'bass-0', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 1 }, sourcePosition: null }] },
    { kind: 'note', id: 'src-b1', partId: 1, voiceId: 'bass', start: { n: 4, d: 1 }, duration: { n: 4, d: 1 }, soundingMidi: 43, spelling: { step: 'G', alter: 0, octave: 2 }, tieChainId: null, effects: [],
      refs: [{ sourceNoteId: 'raw-b1', partId: 1, barId: 'b2', voiceId: 'bass', beatId: 'bass-1', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 1 }, sourcePosition: null }] },
    { kind: 'note', id: 'src-h0', partId: 2, voiceId: 'harmony', start: { n: 0, d: 1 }, duration: { n: 2, d: 1 }, soundingMidi: 59, spelling: { step: 'B', alter: 0, octave: 3 }, tieChainId: null, effects: [],
      refs: [{ sourceNoteId: 'raw-h0', partId: 2, barId: 'b1', voiceId: 'harmony', beatId: 'harmony-0', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 2 }, sourcePosition: null }] },
    { kind: 'note', id: 'src-h1', partId: 2, voiceId: 'harmony', start: { n: 6, d: 1 }, duration: { n: 1, d: 1 }, soundingMidi: 57, spelling: { step: 'A', alter: 0, octave: 3 }, tieChainId: null, effects: [],
      refs: [{ sourceNoteId: 'raw-h1', partId: 2, barId: 'b2', voiceId: 'harmony', beatId: 'harmony-1', noteIndex: 0, rawWholeNoteDuration: { n: 1, d: 4 }, sourcePosition: null }] },
  ],
});

export const score = ScoreV1Schema.parse({
  schemaVersion: 1, projectId: 'original-study', revision: { id: 'study-r1', parentId: null, digest: scoreDigest },
  source: { revision: { id: sourceRevision.id, digest: sourceRevision.digest }, manifest },
  key, bars, tempos, form,
  selection: { id: 'selection-1', sourceRevision: { id: sourceRevision.id, digest: sourceRevision.digest }, sections: [
    { id: 'section-all', label: 'Complete original melody', start: { n: 0, d: 1 }, end: { n: 8, d: 1 },
      selectors: [{ partId: 0, voiceId: 'melody', eventIds: ['src-m0', 'src-m1', 'src-m2', 'src-m3', 'src-m4', 'src-rest'] }], intentionalRests: [] },
  ] },
  preferences: {
    difficulty: 'intermediate', ability: { id: 'synthetic-no-barre', version: '1' }, capo: { mode: 'chosen', value: 0 },
    transposition: { mode: 'preserve', semitones: 0 }, tempoScale: 1, bassDensity: 'sparse', harmonyDensity: 'sparse',
  },
  instrument: { id: 'standard-six-string-guitar-v1', tuning: [40, 45, 50, 55, 59, 64], stringOrder: 'low-to-high', capo: 0, maxPhysicalFret: 12, writtenOctaveOffset: 12 },
  ability: { id: 'synthetic-no-barre', version: '1', difficulty: 'intermediate', calibration: 'synthetic-only', maxPhysicalFret: 12, maxStoppedFretSpan: 4, maxSoundingNotes: 4, maxFrettedContacts: 4, barre: 'unsupported', transition: { status: 'uncalibrated', reason: 'Not a human playability claim' } },
  capoComparison: { selected: 0, reason: 'Original study uses low E', alternatives: [
    { capo: 0, outcome: 'candidate', reason: 'Literal original fixture' },
    { capo: 2, outcome: 'not-evaluated', reason: 'Would need bass register proposal; no engine exists' },
  ] },
  occurrences: [
    { id: 'o1', writtenBarId: 'b1', pass: 1, start: { n: 0, d: 1 }, length: { n: 4, d: 1 }, entryQuarterBpm: 80, meter: { beats: 4, beatUnit: 4 }, entry: 'start' },
    { id: 'o2', writtenBarId: 'b2', pass: 1, start: { n: 4, d: 1 }, length: { n: 4, d: 1 }, entryQuarterBpm: 80, meter: { beats: 4, beatUnit: 4 }, entry: 'contiguous' },
  ],
  performedTempos: [
    { occurrenceId: 'o1', start: { n: 0, d: 1 }, quarterBpm: 80, origin: 'entry-restore', sourceTempoId: 't80' },
    { occurrenceId: 'o2', start: { n: 4, d: 1 }, quarterBpm: 80, origin: 'entry-restore', sourceTempoId: 't80' },
  ],
  sounds: [
    { id: 'm0', role: 'melody', voiceId: 'melody', start: { n: 0, d: 1 }, duration: { n: 1, d: 1 }, soundingMidi: 64, spelling: { step: 'E', alter: 0, octave: 4 }, provenance: { kind: 'source', eventIds: ['src-m0'] } },
    { id: 'm1', role: 'melody', voiceId: 'melody', start: { n: 1, d: 1 }, duration: { n: 2, d: 3 }, soundingMidi: 67, spelling: { step: 'G', alter: 0, octave: 4 }, provenance: { kind: 'source', eventIds: ['src-m1'] } },
    { id: 'm2', role: 'melody', voiceId: 'melody', start: { n: 5, d: 3 }, duration: { n: 2, d: 3 }, soundingMidi: 66, spelling: { step: 'F', alter: 1, octave: 4 }, provenance: { kind: 'source', eventIds: ['src-m2'] } },
    { id: 'm3', role: 'melody', voiceId: 'melody', start: { n: 7, d: 3 }, duration: { n: 2, d: 3 }, soundingMidi: 64, spelling: { step: 'E', alter: 0, octave: 4 }, provenance: { kind: 'source', eventIds: ['src-m3'] } },
    { id: 'm4', role: 'melody', voiceId: 'melody', start: { n: 3, d: 1 }, duration: { n: 2, d: 1 }, soundingMidi: 65, spelling: { step: 'F', alter: 0, octave: 4 }, provenance: { kind: 'source', eventIds: ['src-m4'] } },
    { id: 'bass0', role: 'bass', voiceId: 'bass', start: { n: 0, d: 1 }, duration: { n: 4, d: 1 }, soundingMidi: 40, spelling: { step: 'E', alter: 0, octave: 2 }, provenance: { kind: 'source', eventIds: ['src-b0'] } },
    { id: 'bass1', role: 'bass', voiceId: 'bass', start: { n: 4, d: 1 }, duration: { n: 4, d: 1 }, soundingMidi: 43, spelling: { step: 'G', alter: 0, octave: 2 }, provenance: { kind: 'source', eventIds: ['src-b1'] } },
    { id: 'h0', role: 'harmony', voiceId: 'harmony', start: { n: 0, d: 1 }, duration: { n: 2, d: 1 }, soundingMidi: 59, spelling: { step: 'B', alter: 0, octave: 3 }, provenance: { kind: 'source', eventIds: ['src-h0'] } },
    { id: 'h1', role: 'harmony', voiceId: 'harmony', start: { n: 6, d: 1 }, duration: { n: 1, d: 1 }, soundingMidi: 57, spelling: { step: 'A', alter: 0, octave: 3 }, provenance: { kind: 'source', eventIds: ['src-h1'] } },
  ],
  rests: [{ id: 'rest1', role: 'melody', voiceId: 'melody', start: { n: 5, d: 1 }, duration: { n: 3, d: 1 }, provenance: { kind: 'source', eventIds: ['src-rest'] } }],
  notation: [
    { id: 'n0', eventId: 'm0', kind: 'note', barId: 'b1', voiceId: 'melody', start: { n: 0, d: 1 }, duration: { n: 1, d: 1 }, baseDenominator: 4, dots: 0, tuplet: null, tie: 'none' },
    { id: 'n1', eventId: 'm1', kind: 'note', barId: 'b1', voiceId: 'melody', start: { n: 1, d: 1 }, duration: { n: 2, d: 3 }, baseDenominator: 4, dots: 0, tuplet: { groupId: 'triplet-1', actual: 3, normal: 2, index: 0 }, tie: 'none' },
    { id: 'n2', eventId: 'm2', kind: 'note', barId: 'b1', voiceId: 'melody', start: { n: 5, d: 3 }, duration: { n: 2, d: 3 }, baseDenominator: 4, dots: 0, tuplet: { groupId: 'triplet-1', actual: 3, normal: 2, index: 1 }, tie: 'none' },
    { id: 'n3', eventId: 'm3', kind: 'note', barId: 'b1', voiceId: 'melody', start: { n: 7, d: 3 }, duration: { n: 2, d: 3 }, baseDenominator: 4, dots: 0, tuplet: { groupId: 'triplet-1', actual: 3, normal: 2, index: 2 }, tie: 'none' },
    { id: 'n4a', eventId: 'm4', kind: 'note', barId: 'b1', voiceId: 'melody', start: { n: 3, d: 1 }, duration: { n: 1, d: 1 }, baseDenominator: 4, dots: 0, tuplet: null, tie: 'start' },
    { id: 'n4b', eventId: 'm4', kind: 'note', barId: 'b2', voiceId: 'melody', start: { n: 4, d: 1 }, duration: { n: 1, d: 1 }, baseDenominator: 4, dots: 0, tuplet: null, tie: 'end' },
    { id: 'nr', eventId: 'rest1', kind: 'rest', barId: 'b2', voiceId: 'melody', start: { n: 5, d: 1 }, duration: { n: 3, d: 1 }, baseDenominator: 2, dots: 1, tuplet: null, tie: 'none' },
    { id: 'nb0', eventId: 'bass0', kind: 'note', barId: 'b1', voiceId: 'bass', start: { n: 0, d: 1 }, duration: { n: 4, d: 1 }, baseDenominator: 1, dots: 0, tuplet: null, tie: 'none' },
    { id: 'nb1', eventId: 'bass1', kind: 'note', barId: 'b2', voiceId: 'bass', start: { n: 4, d: 1 }, duration: { n: 4, d: 1 }, baseDenominator: 1, dots: 0, tuplet: null, tie: 'none' },
    { id: 'nh0', eventId: 'h0', kind: 'note', barId: 'b1', voiceId: 'harmony', start: { n: 0, d: 1 }, duration: { n: 2, d: 1 }, baseDenominator: 2, dots: 0, tuplet: null, tie: 'none' },
    { id: 'nh1', eventId: 'h1', kind: 'note', barId: 'b2', voiceId: 'harmony', start: { n: 6, d: 1 }, duration: { n: 1, d: 1 }, baseDenominator: 4, dots: 0, tuplet: null, tie: 'none' },
  ],
  placements: [
    { id: 'p0', soundId: 'm0', stringIndex: 5, fret: 0, finger: 0 },
    { id: 'p1', soundId: 'm1', stringIndex: 5, fret: 3, finger: 3 },
    { id: 'p2', soundId: 'm2', stringIndex: 5, fret: 2, finger: 2 },
    { id: 'p3', soundId: 'm3', stringIndex: 5, fret: 0, finger: 0 },
    { id: 'p4', soundId: 'm4', stringIndex: 5, fret: 1, finger: 1 },
    { id: 'pb0', soundId: 'bass0', stringIndex: 0, fret: 0, finger: 0 },
    { id: 'pb1', soundId: 'bass1', stringIndex: 0, fret: 3, finger: 3 },
    { id: 'ph0', soundId: 'h0', stringIndex: 4, fret: 0, finger: 0 },
    { id: 'ph1', soundId: 'h1', stringIndex: 3, fret: 2, finger: 2 },
  ],
  performedSounds: [
    { id: 'm0@o1', soundId: 'm0', attackOccurrenceId: 'o1', occurrenceIds: ['o1'], start: { n: 0, d: 1 }, duration: { n: 1, d: 1 }, placementId: 'p0' },
    { id: 'm1@o1', soundId: 'm1', attackOccurrenceId: 'o1', occurrenceIds: ['o1'], start: { n: 1, d: 1 }, duration: { n: 2, d: 3 }, placementId: 'p1' },
    { id: 'm2@o1', soundId: 'm2', attackOccurrenceId: 'o1', occurrenceIds: ['o1'], start: { n: 5, d: 3 }, duration: { n: 2, d: 3 }, placementId: 'p2' },
    { id: 'm3@o1', soundId: 'm3', attackOccurrenceId: 'o1', occurrenceIds: ['o1'], start: { n: 7, d: 3 }, duration: { n: 2, d: 3 }, placementId: 'p3' },
    { id: 'm4@o1', soundId: 'm4', attackOccurrenceId: 'o1', occurrenceIds: ['o1', 'o2'], start: { n: 3, d: 1 }, duration: { n: 2, d: 1 }, placementId: 'p4' },
    { id: 'bass0@o1', soundId: 'bass0', attackOccurrenceId: 'o1', occurrenceIds: ['o1'], start: { n: 0, d: 1 }, duration: { n: 4, d: 1 }, placementId: 'pb0' },
    { id: 'bass1@o2', soundId: 'bass1', attackOccurrenceId: 'o2', occurrenceIds: ['o2'], start: { n: 4, d: 1 }, duration: { n: 4, d: 1 }, placementId: 'pb1' },
    { id: 'h0@o1', soundId: 'h0', attackOccurrenceId: 'o1', occurrenceIds: ['o1'], start: { n: 0, d: 1 }, duration: { n: 2, d: 1 }, placementId: 'ph0' },
    { id: 'h1@o2', soundId: 'h1', attackOccurrenceId: 'o2', occurrenceIds: ['o2'], start: { n: 6, d: 1 }, duration: { n: 1, d: 1 }, placementId: 'ph1' },
  ],
  contacts: [
    { id: 'c0', performedSoundId: 'm0@o1', soundId: 'm0', placementId: 'p0', start: { n: 0, d: 1 }, release: { n: 1, d: 1 } },
    { id: 'c1', performedSoundId: 'm1@o1', soundId: 'm1', placementId: 'p1', start: { n: 1, d: 1 }, release: { n: 5, d: 3 } },
    { id: 'c2', performedSoundId: 'm2@o1', soundId: 'm2', placementId: 'p2', start: { n: 5, d: 3 }, release: { n: 7, d: 3 } },
    { id: 'c3', performedSoundId: 'm3@o1', soundId: 'm3', placementId: 'p3', start: { n: 7, d: 3 }, release: { n: 3, d: 1 } },
    { id: 'c4', performedSoundId: 'm4@o1', soundId: 'm4', placementId: 'p4', start: { n: 3, d: 1 }, release: { n: 5, d: 1 } },
    { id: 'cb0', performedSoundId: 'bass0@o1', soundId: 'bass0', placementId: 'pb0', start: { n: 0, d: 1 }, release: { n: 4, d: 1 } },
    { id: 'cb1', performedSoundId: 'bass1@o2', soundId: 'bass1', placementId: 'pb1', start: { n: 4, d: 1 }, release: { n: 8, d: 1 } },
    { id: 'ch0', performedSoundId: 'h0@o1', soundId: 'h0', placementId: 'ph0', start: { n: 0, d: 1 }, release: { n: 2, d: 1 } },
    { id: 'ch1', performedSoundId: 'h1@o2', soundId: 'h1', placementId: 'ph1', start: { n: 6, d: 1 }, release: { n: 7, d: 1 } },
  ],
  handStates: [
    { at: { n: 0, d: 1 }, activeContactIds: ['c0', 'cb0', 'ch0'], position: { kind: 'released' } },
    { at: { n: 1, d: 1 }, activeContactIds: ['c1', 'cb0', 'ch0'], position: { kind: 'fretting', anchorPhysicalFret: 3 } },
    { at: { n: 5, d: 3 }, activeContactIds: ['c2', 'cb0', 'ch0'], position: { kind: 'fretting', anchorPhysicalFret: 2 } },
    { at: { n: 2, d: 1 }, activeContactIds: ['c2', 'cb0'], position: { kind: 'fretting', anchorPhysicalFret: 2 } },
    { at: { n: 7, d: 3 }, activeContactIds: ['c3', 'cb0'], position: { kind: 'released' } },
    { at: { n: 3, d: 1 }, activeContactIds: ['c4', 'cb0'], position: { kind: 'fretting', anchorPhysicalFret: 1 } },
    { at: { n: 4, d: 1 }, activeContactIds: ['c4', 'cb1'], position: { kind: 'fretting', anchorPhysicalFret: 1 } },
    { at: { n: 5, d: 1 }, activeContactIds: ['cb1'], position: { kind: 'fretting', anchorPhysicalFret: 3 } },
    { at: { n: 6, d: 1 }, activeContactIds: ['cb1', 'ch1'], position: { kind: 'fretting', anchorPhysicalFret: 2 } },
    { at: { n: 7, d: 1 }, activeContactIds: ['cb1'], position: { kind: 'fretting', anchorPhysicalFret: 3 } },
    { at: { n: 8, d: 1 }, activeContactIds: [], position: { kind: 'released' } },
  ],
  chords: [{ id: 'chord-unknown', start: { n: 0, d: 1 }, duration: { n: 8, d: 1 }, chord: { status: 'unknown', reason: 'No harmonic claim in a technical study' }, evidenceEventIds: [], basis: 'unresolved' }],
  changes: [], plan: { version: '1', candidates: [] },
  planner: { mode: 'deterministic-fallback', label: 'deterministic fallback', plannerVersion: 'fixture-1', reason: 'disabled', detail: 'Literal fixture, no planner call or engine execution' },
  locks: [], approvals: { stage: 'sourceReady' }, musicalReview: { status: 'pending', reason: 'No guitarist review' },
});

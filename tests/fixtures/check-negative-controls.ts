import { exactTicks, q, verifyRevisionDigest } from '../../src/domain';
import { heldFingerCollision, requestedSongFacts, restoreTempoExample, sustainCollision } from './literal-oracles';
import { contactOracleErrors, matchesLiteralMelody, secondsForFourQuarterEntries } from './negative-oracles';
import { score } from './original';

const wrongPitch = structuredClone(score.sounds);
wrongPitch[2]!.soundingMidi++;
const boundary = structuredClone(sustainCollision);
boundary[0]!.end = q(1);
const controls = [
  { id: 'original-melody', expected: true, actual: matchesLiteralMelody(score.sounds) },
  { id: 'wrong-melody-pitch', expected: false, actual: matchesLiteralMelody(wrongPitch) },
  { id: 'missing-middle-melody', expected: false, actual: matchesLiteralMelody(score.sounds.filter((s) => s.id !== 'm2')) },
  { id: 'missing-final-melody', expected: false, actual: matchesLiteralMelody(score.sounds.filter((s) => s.id !== 'm4')) },
  { id: 'melody-octave-shift', expected: false, actual: matchesLiteralMelody(score.sounds.map((s) => ({ ...s, soundingMidi: s.soundingMidi + 12 }))) },
  { id: 'held-string-re-fret', expected: 'string-collision', actual: contactOracleErrors(sustainCollision).join(',') },
  { id: 'exact-boundary-release', expected: '', actual: contactOracleErrors(boundary).join(',') },
  { id: 'held-finger-move', expected: 'finger-collision', actual: contactOracleErrors(heldFingerCollision).join(',') },
  { id: 'repeat-entry-restored-seconds', expected: 13, actual: secondsForFourQuarterEntries(restoreTempoExample.correctEntryBpm) },
  { id: 'repeat-entry-carried-seconds-negative', expected: 12, actual: secondsForFourQuarterEntries(restoreTempoExample.incorrectCarriedBpm) },
  { id: 'requested-form-occurrences-literal-only', expected: 64, actual: requestedSongFacts.occurrenceWrittenBars.length },
  { id: 'capo2-high-E-open-already-sounding', expected: 66, actual: 64 + 2 + 0 },
  { id: 'capo2-double-offset-rejected', expected: false, actual: 64 + 2 + 2 === 66 },
  { id: 'repeat-restore-tick', expected: 11520, actual: exactTicks(q(12), 960) },
  { id: 'full-original-revision', expected: true, actual: await verifyRevisionDigest(score) },
  { id: 'capo-mutated-old-revision', expected: false, actual: await verifyRevisionDigest({ ...score, instrument: { ...score.instrument, capo: 2 } }) },
];

console.log(JSON.stringify({
  scope: 'Test-only literal oracle/mutation examples, NOT production validator or live-song acceptance',
  controls: controls.map((c) => ({ ...c, matched: c.expected === c.actual })),
}, null, 2));
if (controls.some((c) => c.expected !== c.actual)) process.exitCode = 1;

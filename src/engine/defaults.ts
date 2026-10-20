import type { AbilityProfile, ArrangementRequest, MelodySelection, Preferences, SourceScoreV1 } from '../domain';

export function createDefaultAbilityProfile(difficulty: Preferences['difficulty'] = 'intermediate'): AbilityProfile {
  const limits = { beginner: [7,3,3], intermediate: [12,4,4], advanced: [19,5,5] } as const;
  const [maxPhysicalFret,maxStoppedFretSpan,maxSoundingNotes] = limits[difficulty];
  return { id: `conservative-${difficulty}-no-barre`, version: '1', difficulty, calibration: 'provisional', maxPhysicalFret, maxStoppedFretSpan, maxSoundingNotes, maxFrettedContacts: 4, barre: 'unsupported', transition: { status: 'uncalibrated', reason: 'Conservative product defaults, not calibrated to an individual guitarist; audition movement before a playable-release claim' } };
}

export function createDefaultPreferences(ability = createDefaultAbilityProfile(), capo: Preferences['capo'] = { mode: 'recommend', compare: [0,2] }): Preferences {
  return { difficulty: ability.difficulty, ability: { id:ability.id,version:ability.version }, capo, transposition: { mode:'preserve',semitones:0 }, tempoScale:1, bassDensity:'sparse',harmonyDensity:'sparse' };
}

export function createDefaultRequest(source: SourceScoreV1, selection: MelodySelection, difficulty: Preferences['difficulty'] = 'intermediate'): ArrangementRequest {
  const ability=createDefaultAbilityProfile(difficulty);
  return { sourceRevision: { id:source.revision.id,digest:source.revision.digest },selection,ability,preferences:createDefaultPreferences(ability),maxPhysicalFret:ability.maxPhysicalFret,locks:[],budget:{maxStates:10000,maxElapsedMs:5000} };
}

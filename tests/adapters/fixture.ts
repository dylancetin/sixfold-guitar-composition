// Original authored fixture and a repeat stress test. No production adapter imports.
import { add, contentDigest, q, revisionDigest, ScoreV1Schema, SourceScoreV1Schema, ValidationReportSchema } from '../../src/domain';
import type { ScoreV1, SourceScoreV1, ValidatedScoreV1, Validator } from '../../src/domain';
import { score as originalScore, source as originalSource } from '../fixtures/original';

export async function stamp<T extends ScoreV1 | SourceScoreV1>(document: T): Promise<T> {
  document.revision.digest = await revisionDigest(document);
  return document;
}
export const literalAttacks = [
  ['melody', 64, 0, 960], ['melody', 67, 960, 1600], ['melody', 66, 1600, 2240], ['melody', 64, 2240, 2880], ['melody', 65, 2880, 4800],
  ['bass', 40, 0, 3840], ['bass', 43, 3840, 7680], ['harmony', 59, 0, 1920], ['harmony', 57, 5760, 6720],
] as const;
const spelling = (midi: number): ScoreV1['sounds'][number]['spelling'] => {
  const names = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]] as const;
  const [step, alter] = names[midi % 12]!;
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
};

export async function study(passes = 1, capo: 0 | 2 = 0, pitchShift: 0 | 2 = 0) {
  if (capo > pitchShift) throw new Error('Fixture capo cannot cover low source E');
  const source = structuredClone(originalSource), score = structuredClone(originalScore);
  source.revision.id = `adapter-source-p${passes}-shift${pitchShift}`;
  source.form.repeats = passes > 1 ? [{ id: 'repeat-study', fromBarId: 'b1', toBarId: 'b2', totalPasses: passes }] : [];
  for (const event of source.events) if (event.kind === 'note') { event.soundingMidi += pitchShift; event.spelling = spelling(event.soundingMidi); }
  // This is a newly authored original source variant, not a claim that the old raw blob had new pitches.
  source.manifest.identity = { kind: 'original-fixture', name: `Held-voice adapter study, source +${pitchShift}, ${passes} passes`, author: 'Guitar composition project' };
  source.manifest.parser = { name: 'original-adapter-fixture', version: '1' };
  const rawArtifact = new TextEncoder().encode(JSON.stringify({ parts: source.parts, bars: source.bars, tempos: source.tempos, form: source.form, events: source.events }));
  const rawDigest = await crypto.subtle.digest('SHA-256', rawArtifact);
  source.manifest.artifacts = [{ id: 'authored-adapter-raw', sha256: [...new Uint8Array(rawDigest)].map(b => b.toString(16).padStart(2, '0')).join(''), byteLength: rawArtifact.byteLength, mediaType: 'application/json' }];
  await stamp(source);
  score.revision.id = `adapter-study-p${passes}-c${capo}-shift${pitchShift}`;
  score.source.revision = { id: source.revision.id, digest: source.revision.digest };
  score.source.manifest = structuredClone(source.manifest);
  score.selection.sourceRevision = { ...score.source.revision };
  score.form = structuredClone(source.form);
  score.instrument.capo = capo; score.preferences.capo = { mode: 'chosen', value: capo };
  score.capoComparison.selected = capo;
  score.capoComparison.reason = 'Manually authored original fixture placement, not an engine recommendation';
  score.capoComparison.alternatives = [{ capo: 0, outcome: 'candidate', reason: 'Manually authored fixture fingering' }, { capo: 2, outcome: pitchShift === 2 ? 'candidate' : 'not-evaluated', reason: pitchShift === 2 ? 'Same authored source pitches fit capo 2 with relative frets two lower' : 'Low source E cannot fit capo 2 without an explicit bass proposal' }];
  for (const sound of score.sounds) { sound.soundingMidi += pitchShift; sound.spelling = spelling(sound.soundingMidi); }
  for (const placement of score.placements) {
    placement.fret += pitchShift - capo;
    const role = score.sounds.find(s => s.id === placement.soundId)!.role;
    placement.finger = placement.fret === 0 ? 0 : role === 'melody' ? 3 : role === 'bass' ? 1 : 2;
  }
  score.occurrences = []; score.performedSounds = []; score.performedTempos = []; score.contacts = []; score.handStates = [];
  for (let pass = 1; pass <= passes; pass++) {
    const offset = (pass - 1) * 8;
    const id = (original: string) => `${original}-p${pass}`;
    for (const occurrence of originalScore.occurrences) score.occurrences.push({ ...structuredClone(occurrence), id: id(occurrence.id), pass, start: add(occurrence.start, q(offset)), entry: occurrence.id === 'o1' ? pass === 1 ? 'start' : 'repeat-jump' : 'contiguous' });
    for (const tempo of originalScore.performedTempos) score.performedTempos.push({ ...structuredClone(tempo), occurrenceId: id(tempo.occurrenceId), start: add(tempo.start, q(offset)) });
    for (const performed of originalScore.performedSounds) score.performedSounds.push({ ...structuredClone(performed), id: id(performed.id), attackOccurrenceId: id(performed.attackOccurrenceId), occurrenceIds: performed.occurrenceIds.map(id), start: add(performed.start, q(offset)) });
    for (const contact of originalScore.contacts) score.contacts.push({ ...structuredClone(contact), id: id(contact.id), performedSoundId: id(contact.performedSoundId), start: add(contact.start, q(offset)), release: add(contact.release, q(offset)) });
  }
  const times = [...new Set(score.contacts.flatMap(c => [c.start.n / c.start.d, c.release.n / c.release.d]))].sort((a, b) => a - b);
  for (const time of times) {
    const active = score.contacts.filter(c => c.start.n / c.start.d <= time && time < c.release.n / c.release.d);
    const frets = active.map(c => score.placements.find(p => p.id === c.placementId)!).filter(p => p.fret > 0).map(p => p.fret + capo);
    score.handStates.push({ at: q(Math.round(time * 3), 3), activeContactIds: active.map(c => c.id), position: frets.length ? { kind: 'fretting', anchorPhysicalFret: Math.min(...frets) } : { kind: 'released' } });
  }
  await stamp(score);
  return { source: SourceScoreV1Schema.parse(source), score: ScoreV1Schema.parse(score), rawArtifact, passes, pitchShift };
}

/** Independent literal fixture-only validator. Deliberately NOT exported in production. */
export function oracleValidator(passes: number, pitchShift: number): Validator & { calls: number } {
  return {
    calls: 0,
    validate(source, score, context) {
      this.calls++;
      const errors: string[] = [];
      const expected = Array.from({ length: passes }, (_, i) => literalAttacks.map(([role, pitch, start, end]) => [role, pitch + pitchShift, start + i * 7680, end + i * 7680])).flat().map(a => a.join('/')).sort();
      const actual = score.performedSounds.map(p => {
        const sound = score.sounds.find(s => s.id === p.soundId);
        return [sound?.role, sound?.soundingMidi, p.start.n * 960 / p.start.d, (p.start.n * p.duration.d + p.duration.n * p.start.d) * 960 / (p.start.d * p.duration.d)].join('/');
      }).sort();
      // Integer numerator arithmetic against literal tick intervals, not adapter-generated expectations.
      if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push('Literal performed role/pitch/interval union differs');
      if (score.occurrences.length !== passes * 2 || source.form.repeats.length !== (passes > 1 ? 1 : 0)) errors.push('Form differs');
      if (source.revision.digest !== score.source.revision.digest || context.approvedRevisions.length !== 0) errors.push('Source/context differs');
      for (const p of score.placements) if (score.instrument.tuning[p.stringIndex]! + score.instrument.capo + p.fret !== score.sounds.find(s => s.id === p.soundId)?.soundingMidi) errors.push('Wrong capo/placement');
      for (const point of score.performedTempos) if (point.quarterBpm !== 80) errors.push('Unexpected fixture tempo');
      const refs = { sourceRevision: { id: source.revision.id, digest: source.revision.digest }, scoreRevision: { id: score.revision.id, digest: score.revision.digest }, validatorVersion: 'independent-literal-fixture-1' };
      return ValidationReportSchema.parse(errors.length ? { ...refs, status: 'failed', diagnostics: errors.map(message => ({ code: 'artifact-mismatch', severity: 'error', message, barIds: [], eventIds: [], occurrenceIds: [] })) } : { ...refs, status: 'passed', checks: ['source-identity', 'melody', 'form-tempo', 'physical', 'approval-locks'], transitions: 'uncalibrated', diagnostics: [] });
    },
  };
}
export function envelope(source: SourceScoreV1, score: ScoreV1, validator: Validator): ValidatedScoreV1 {
  const validation = validator.validate(source, score, { approvedRevisions: [] });
  if (validation.status !== 'passed') throw new Error(JSON.stringify(validation));
  return { status: 'validatedDraft', score, validation };
}

export async function fixtureFingerprint() { return contentDigest(literalAttacks.map(a => [...a])); }

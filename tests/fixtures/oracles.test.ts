import { describe, expect, test } from 'bun:test';
import { add, compare, exactTicks, q } from '../../src/domain';
import { capoCases, fiveStoppedContacts, heldFingerCollision, originalMelody, pendingGates, requestedSongFacts, restoreTempoExample, sustainCollision } from './literal-oracles';
import { contactOracleErrors, matchesLiteralMelody, rationalLabel, secondsForFourQuarterEntries } from './negative-oracles';
import { score } from './original';

describe('literal negative oracle examples — not engine/validator acceptance', () => {
  test('unchanged original intervals match; wrong pitch, octave shift and missing middle/final do not', () => {
    expect(matchesLiteralMelody(score.sounds)).toBe(true);
    const wrongPitch = structuredClone(score.sounds);
    wrongPitch[2]!.soundingMidi++;
    expect(matchesLiteralMelody(wrongPitch)).toBe(false);
    expect(matchesLiteralMelody(score.sounds.filter((s) => s.id !== 'm2'))).toBe(false);
    expect(matchesLiteralMelody(score.sounds.filter((s) => s.id !== 'm4'))).toBe(false);
    expect(matchesLiteralMelody(score.sounds.map((s) => ({ ...s, soundingMidi: s.soundingMidi + 12 })))).toBe(false);
  });
  test('interval oracle detects dropped triplet/retriggered tie; literal rest fixture sanity', () => {
    expect(matchesLiteralMelody(score.sounds.filter((s) => s.id !== 'm1'))).toBe(false);
    const retriggered = structuredClone(score.sounds);
    const held = retriggered.find((s) => s.id === 'm4')!;
    held.duration = q(1);
    retriggered.push({ ...held, id: 'm4-retrigger', start: q(4), duration: q(1) });
    expect(matchesLiteralMelody(retriggered)).toBe(false);
    expect(score.rests.map((r) => [r.id, rationalLabel(r.start), rationalLabel(add(r.start, r.duration))])).toEqual([['rest1', '5', '8']]);
    expect(score.rests.filter((r) => r.id !== 'rest1').map((r) => r.id)).not.toEqual(['rest1']);
    expect(originalMelody.at(-1)?.end).toEqual({ n: 5, d: 1 });
  });
  test('protected high E [0,4) rejects re-fret [1,2); [0,1)/[1,2) releases first', () => {
    expect(contactOracleErrors(sustainCollision)).toEqual(['string-collision']);
    const boundary = structuredClone(sustainCollision);
    boundary[0]!.end = q(1);
    expect(contactOracleErrors(boundary)).toEqual([]);
  });
  test('held finger cannot move string/fret; five stopped contacts are not a no-barre chord', () => {
    expect(contactOracleErrors(heldFingerCollision)).toEqual(['finger-collision']);
    expect(contactOracleErrors(fiveStoppedContacts)).toEqual(['finger-collision', 'too-many-stopped-contacts']);
    const wide = structuredClone(heldFingerCollision);
    wide[1]!.finger = 4;
    wide[1]!.fret = 7;
    expect(contactOracleErrors(wide)).toEqual(['stopped-span']);
  });
  test('original held contacts agree with literal placements and release-before-attack states', () => {
    const contacts = score.contacts.map((contact) => {
      const placement = score.placements.find((p) => p.id === contact.placementId)!;
      const sound = score.sounds.find((s) => s.id === contact.soundId)!;
      return { id: contact.id, pitch: sound.soundingMidi, start: contact.start, end: contact.release, string: placement.stringIndex, fret: placement.fret, finger: placement.finger };
    });
    expect(contactOracleErrors(contacts)).toEqual([]);
    for (const contact of score.contacts) {
      const performed = score.performedSounds.find((s) => s.id === contact.performedSoundId)!;
      expect(contact.start).toEqual(performed.start);
      expect(contact.release).toEqual(add(performed.start, performed.duration));
      expect(contact.placementId).toBe(performed.placementId);
    }
    for (const placement of score.placements) {
      const sound = score.sounds.find((s) => s.id === placement.soundId)!;
      expect(score.instrument.tuning[placement.stringIndex]! + score.instrument.capo + placement.fret).toBe(sound.soundingMidi);
    }
    for (const state of score.handStates) {
      const active = score.contacts.filter((c) => compare(c.start, state.at) <= 0 && compare(state.at, c.release) < 0).map((c) => c.id).sort();
      expect([...state.activeContactIds].sort()).toEqual(active);
    }
  });
  test('literal notation exactly tiles all original sounds and the selected rest', () => {
    for (const event of [...score.sounds, ...score.rests]) {
      const segments = score.notation.filter((n) => n.eventId === event.id).sort((a, b) => compare(a.start, b.start));
      expect(segments.length).toBeGreaterThan(0);
      let cursor = event.start;
      for (const segment of segments) {
        expect(segment.start).toEqual(cursor);
        cursor = add(cursor, segment.duration);
      }
      expect(cursor).toEqual(add(event.start, event.duration));
    }
  });
  test('literal capo arithmetic sanity: relative zero, physical limits and sounding MIDI', () => {
    const tuning = [40, 45, 50, 55, 59, 64];
    for (const row of capoCases) {
      expect(tuning[row.string]! + row.capo + row.fret).toBe(row.pitch);
      expect(row.capo + row.fret).toBe(row.physical);
      expect(row.physical <= 12).toBe(row.fitsPhysical12);
    }
    expect(tuning.every((pitch) => pitch + 2 > 41)).toBe(true);
    expect(capoCases.at(-1)?.pitch).toBe(66);
    expect(capoCases.at(-1)!.pitch + 2).not.toBe(66);
    // Same concert melody 66 at capo 0/fret 2 and capo 2/fret 0. No explicit transposition.
    expect(64 + 0 + 2).toBe(66);
    expect(64 + 2 + 0).toBe(66);
  });
  test('80->120 repeat needs inherited-80 entry restore (13s), not carried 120 (12s)', () => {
    expect(secondsForFourQuarterEntries(restoreTempoExample.correctEntryBpm)).toBe(13);
    expect(secondsForFourQuarterEntries(restoreTempoExample.incorrectCarriedBpm)).toBe(12);
    expect(secondsForFourQuarterEntries(restoreTempoExample.incorrectCarriedBpm)).not.toBe(restoreTempoExample.restoredSeconds);
    expect(exactTicks(q(12), 960)).toBe(11520);
  });
  test('literal full-form fixture sanity: 64 visits differs from flattened/truncated lists', () => {
    const literal = requestedSongFacts.occurrenceWrittenBars;
    expect(literal).toHaveLength(64);
    expect(literal.length * 4).toBe(256);
    expect(literal.filter((b) => b === 43)).toHaveLength(4);
    expect(Array.from({ length: 46 }, (_, i) => i + 1)).not.toEqual(literal);
    expect(literal.slice(0, -8)).not.toEqual(literal);
    expect(requestedSongFacts.part0Opening.pitches).toEqual([54, 59, 61, 63, 64, 63]);
  });
});

describe('named product gates remain pending — never relabeled foundation passes', () => {
  for (const gate of pendingGates) test.todo(gate, () => { throw new Error('Pending implementation and evidence'); });
});

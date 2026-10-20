import { add, compare, eventEnd, MelodySelectionSchema, q, SourceScoreV1Schema, subtract } from '../domain';
import type { Diagnostic, MelodySelection, Q, SourceEvent, SourceScoreV1 } from '../domain';
import { diagnostic } from './common';
import { writtenEnd } from './normalize';

export type DefaultMelodyProposal = {
  status: 'proposed'; selection: MelodySelection; diagnostics: Diagnostic[];
  provenance: {
    strategy: 'source-voice-proposal-v1'; approval: 'unapproved';
    primary: { partId: number; voiceId: string };
    candidates: { partId: number; voiceId: string; attacks: number; monophonic: boolean; score: number }[];
    choices: { sectionId: string; reason: string; selectedEventIds: string[]; omittedOverlappingEventIds: string[]; intentionalSilenceSourceEventIds: string[] }[];
  };
} | { status: 'selection-needed'; diagnostics: Diagnostic[] };

type Voice = { partId: number; voiceId: string; notes: Extract<SourceEvent, { kind: 'note' }>[]; rests: Extract<SourceEvent, { kind: 'rest' }>[]; monophonic: boolean; score: number };
const number = (time: Q) => time.n / time.d; // Ranking only; never used for musical time.
function voiceCandidates(source: SourceScoreV1): Voice[] {
  return source.parts.flatMap((part) => part.voices.map((voiceId): Voice => {
    const events = source.events.filter((e) => e.partId === part.id && e.voiceId === voiceId);
    const notes = events.filter((e): e is Extract<SourceEvent, { kind: 'note' }> => e.kind === 'note' && !e.effects.some((effect) => effect.code === 'unpitched-percussion')).sort((a, b) => compare(a.start, b.start) || b.soundingMidi - a.soundingMidi || a.id.localeCompare(b.id));
    let end = q(0);
    let monophonic = true;
    for (const note of notes) { if (compare(note.start, end) < 0) monophonic = false; if (compare(eventEnd(note), end) > 0) end = eventEnd(note); }
    const melodicRegister = notes.filter((e) => e.soundingMidi >= 48 && e.soundingMidi <= 84).length / Math.max(notes.length, 1);
    // Public source timbre/name and attack activity are evidence for a proposal, NOT musical role truth.
    const vocalWind = part.program !== null && part.program >= 52 && part.program <= 85;
    const named = /\b(lead|melody|vocal)\b/i.test(part.name);
    const score = melodicRegister < 0.8 ? 0 : notes.length * (vocalWind ? 2 : 1) * (named ? 1.5 : 1);
    return { partId: part.id, voiceId, notes, rests: events.filter((e): e is Extract<SourceEvent, { kind: 'rest' }> => e.kind === 'rest'), monophonic, score };
  })).sort((a, b) => b.score - a.score || a.partId - b.partId || a.voiceId.localeCompare(b.voiceId));
}

/** Complete, explicitly event-selected, monophonic *proposal*. Does not approve melody or infer key. */
export function createDefaultMelodySelection(input: SourceScoreV1): DefaultMelodyProposal {
  const parsed = SourceScoreV1Schema.safeParse(input);
  if (!parsed.success) return { status: 'selection-needed', diagnostics: [diagnostic('invalid-input', 'Cannot propose a melody for a malformed SourceScoreV1.', 'error')] };
  const source = parsed.data;
  const candidates = voiceCandidates(source);
  const primary = candidates.find((v) => v.monophonic && v.score > 0 && v.notes.length > 0);
  if (!primary) return { status: 'selection-needed', diagnostics: [diagnostic('selection-needed', 'No supported monophonic melodic-register voice found. Choose explicit source events.', 'error')] };
  const diagnostics: Diagnostic[] = [diagnostic('selection-needed', 'Complete source-grounded default is an UNAPPROVED proposal. Audition primary-role ranking, fallback line, intentional silence and outro before musical approval.')];
  const hasNotes = (voice: Voice, start: Q, end: Q) => voice.notes.some((n) => compare(n.start, end) < 0 && compare(eventEnd(n), start) > 0);
  const barAssignments: { voice: Voice; silent: boolean; reason: string }[] = source.bars.map((bar) => ({ voice: primary, silent: !hasNotes(primary, bar.start, add(bar.start, bar.length)), reason: 'Primary candidate: supported monophonic voice with strongest disclosed melodic-register/timbre/attack ranking; website default ignored.' }));
  // Fill only leading or >=2 whole-bar primary-silent runs. Keep ordinary one-bar phrase rests.
  for (let i = 0; i < source.bars.length;) {
    if (!barAssignments[i]!.silent) { i++; continue; }
    let j = i + 1;
    while (j < source.bars.length && barAssignments[j]!.silent) j++;
    if (i === 0 || j - i >= 2) {
      const start = source.bars[i]!.start;
      const end = j === source.bars.length ? writtenEnd(source) : source.bars[j]!.start;
      const localMonophonic = (v: Voice) => {
        let until = start;
        for (const note of v.notes.filter((n) => compare(n.start, end) < 0 && compare(eventEnd(n), start) > 0)) {
          if (compare(note.start, until) < 0) return false;
          until = eventEnd(note);
        }
        return true;
      };
      // Prefer a locally monophonic line over a busy accompaniment with more total notes.
      const fallback = candidates.filter((v) => v !== primary && v.score > 0 && hasNotes(v, start, end)).sort((a, b) => Number(localMonophonic(b)) - Number(localMonophonic(a)) || b.score - a.score)[0];
      if (fallback) for (let b = i; b < j; b++) barAssignments[b] = { voice: fallback, silent: !hasNotes(fallback, source.bars[b]!.start, add(source.bars[b]!.start, source.bars[b]!.length)), reason: `Fallback during a whole-bar primary-silent run. Explicit highest-onset whole-event line from part ${fallback.partId}/${fallback.voiceId}; lower overlapping notes are disclosed omissions from the proposal, not removed source data.` };
    }
    i = j;
  }
  const sections: MelodySelection['sections'] = [];
  const choices: Extract<DefaultMelodyProposal, { status: 'proposed' }>['provenance']['choices'] = [];
  for (let i = 0; i < source.bars.length;) {
    const assignment = barAssignments[i]!;
    let j = i + 1;
    while (j < source.bars.length && barAssignments[j]!.voice === assignment.voice && barAssignments[j]!.silent === assignment.silent && !source.form.repeats.some((r) => r.fromBarId === source.bars[j]!.id)) j++;
    // Don't split a merged event merely for a repeat marker or silence label.
    while (j < source.bars.length && assignment.voice.notes.some((n) => compare(n.start, source.bars[j]!.start) < 0 && compare(eventEnd(n), source.bars[j]!.start) > 0) && barAssignments[j]!.voice === assignment.voice) j++;
    const start = source.bars[i]!.start;
    const end = j === source.bars.length ? writtenEnd(source) : source.bars[j]!.start;
    const voice = assignment.voice;
    const intersecting = voice.notes.filter((n) => compare(n.start, end) < 0 && compare(eventEnd(n), start) > 0);
    if (intersecting.some((n) => compare(n.start, start) < 0 || compare(eventEnd(n), end) > 0)) return { status: 'selection-needed', diagnostics: [diagnostic('selection-needed', 'A fallback/primary boundary crosses a merged source event. Explicit whole-event selection is required; no clipping performed.', 'error', source.bars.slice(i, j).map((b) => b.id))] };
    let cursor = start;
    const selected: SourceEvent[] = [];
    const omitted: string[] = [];
    // Whole merged events only. At simultaneous onsets choose highest pitch; held selection wins over later overlap.
    for (const note of intersecting) {
      if (compare(note.start, cursor) < 0) { omitted.push(note.id); continue; }
      if (note.effects.some((effect) => effect.affectsMelody)) return { status: 'selection-needed', diagnostics: [diagnostic('unsupported-construct', 'The proposed source line contains an unsupported melody-affecting effect. Resolve it explicitly; no note omitted, substituted, or converted to silence.', 'error', note.refs.map((r) => r.barId), [note.id])] };
      selected.push(note); cursor = eventEnd(note);
    }
    for (const rest of voice.rests) {
      if (compare(rest.start, start) >= 0 && compare(eventEnd(rest), end) <= 0 && !selected.some((n) => compare(n.start, eventEnd(rest)) < 0 && compare(eventEnd(n), rest.start) > 0)) selected.push(rest);
    }
    selected.sort((a, b) => compare(a.start, b.start) || a.id.localeCompare(b.id));
    const silenceEvidence = assignment.silent ? selected.filter((e) => e.kind === 'rest').map((e) => e.id) : [];
    if (silenceEvidence.length) selected.splice(0, selected.length); // Explicit intentional whole-section source silence, with supporting IDs in provenance.
    const intentionalRests: MelodySelection['sections'][number]['intentionalRests'] = [];
    cursor = start;
    for (const event of selected) {
      if (compare(event.start, cursor) < 0) return { status: 'selection-needed', diagnostics: [diagnostic('selection-needed', 'Conflicting source rests/polyphony require explicit selection.', 'error', [], [event.id])] };
      if (compare(cursor, event.start) < 0) intentionalRests.push({ id: `proposal-s${sections.length + 1}-rest-${intentionalRests.length + 1}`, start: cursor, duration: subtract(event.start, cursor), reason: 'Disclosed proposal silence between selected whole source events; no pitch fabricated or held event clipped.' });
      cursor = eventEnd(event);
    }
    if (compare(cursor, end) < 0) intentionalRests.push({ id: `proposal-s${sections.length + 1}-rest-${intentionalRests.length + 1}`, start: cursor, duration: subtract(end, cursor), reason: silenceEvidence.length ? `Intentionally preserve source silence evidenced by ${silenceEvidence.join(', ')}; do not fill this phrase rest with invented melody.` : 'Disclosed proposal silence after selected source material; review against source audition.' });
    const sectionId = `melody-section-${sections.length + 1}`;
    sections.push({ id: sectionId, label: `Written bars ${i + 1}–${j}: ${assignment.silent ? 'source silence' : voice === primary ? 'primary candidate' : 'fallback line'} (unapproved)`, start, end, selectors: selected.length ? [{ partId: voice.partId, voiceId: voice.voiceId, eventIds: selected.map((e) => e.id) }] : [], intentionalRests });
    choices.push({ sectionId, reason: assignment.reason, selectedEventIds: selected.map((e) => e.id), omittedOverlappingEventIds: omitted, intentionalSilenceSourceEventIds: silenceEvidence });
    if (omitted.length) diagnostics.push(diagnostic('selection-needed', `Section ${sectionId}: explicit whole-event upper-line choice omitted ${omitted.length} overlapping alternatives from the proposal; source retains all of them.`, 'warning', source.bars.slice(i, j).map((b) => b.id), omitted));
    i = j;
  }
  // Exact completeness is checked here independently of the rank heuristic.
  let cursor = q(0);
  for (const section of sections) {
    if (compare(section.start, cursor)) return { status: 'selection-needed', diagnostics: [diagnostic('selection-needed', 'Proposed sections do not cover written time.', 'error')] };
    cursor = section.end;
  }
  if (compare(cursor, writtenEnd(source))) return { status: 'selection-needed', diagnostics: [diagnostic('selection-needed', 'Incomplete proposal final interval.', 'error')] };
  const selection = MelodySelectionSchema.parse({ id: 'source-default-melody-v1', sourceRevision: { id: source.revision.id, digest: source.revision.digest }, sections });
  diagnostics.push(diagnostic('selection-needed', `Primary ranking: part ${primary.partId}/${primary.voiceId}, ${primary.notes.length} attacks. No key, transposition, octave change, or musical approval inferred. Proposal covers ${number(writtenEnd(source))} written quarters including rests.`, 'info'));
  return { status: 'proposed', selection, diagnostics, provenance: { strategy: 'source-voice-proposal-v1', approval: 'unapproved', primary: { partId: primary.partId, voiceId: primary.voiceId }, candidates: candidates.map((v) => ({ partId: v.partId, voiceId: v.voiceId, attacks: v.notes.length, monophonic: v.monophonic, score: v.score })), choices } };
}

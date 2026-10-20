import { add, compare, eventEnd, overlaps, q, subtract, ScoreV1Schema, SourceScoreV1Schema, ValidationContextSchema } from '../domain';
import type { Diagnostic, Occurrence, PerformedTempo, Q, ScoreV1, Sound, SourceEvent, SourceScoreV1, ValidationContext, ValidationReport, Validator } from '../domain';
import { documentDigest, same } from './identity';
import { ordered, scopeDigest } from './scopes';

const version = 'independent-guitar-validator-2-role-order-v1';
const zero = q(0);
const inside = (time: Q, start: Q, end: Q) => compare(time, start) >= 0 && compare(time, end) < 0;
const spellingPitch = (s: Sound['spelling']) => (s.octave + 1) * 12 + ({ C:0,D:2,E:4,F:5,G:7,A:9,B:11 }[s.step]) + s.alter;

/** Reconstructs facts from source and intervals, never calls the solver or expandForm. */
export const guitarValidator: Validator = {
  validate(source, score, context) {
    const diagnostics: Diagnostic[] = [];
    const error = (code: Diagnostic['code'], message: string, eventIds: string[] = [], barIds: string[] = [], occurrenceIds: string[] = []) => {
      diagnostics.push({ code, severity: 'error', message, eventIds, barIds, occurrenceIds });
    };
    const report = (): ValidationReport => {
      const ref=(document:ScoreV1|SourceScoreV1,label:string)=>({id:typeof document?.revision?.id==='string'&&document.revision.id?document.revision.id:`invalid-${label}`,digest:typeof document?.revision?.digest==='string'&&/^[a-f0-9]{64}$/.test(document.revision.digest)?document.revision.digest:'0'.repeat(64)});
      const base = { scoreRevision:ref(score,'score'), sourceRevision:ref(source,'source'), validatorVersion: version, diagnostics };
      return diagnostics.some((d) => d.severity === 'error') ? { status: 'failed', ...base } : {
        status: 'passed', ...base, checks: ['source-identity','melody','form-tempo','physical','approval-locks'],
        transitions: score.ability.transition.status === 'uncalibrated' ? 'uncalibrated' : 'specified-limits-passed',
      };
    };
    try {
      for (const [name, schema, value] of [
        ['source', SourceScoreV1Schema, source], ['score', ScoreV1Schema, score], ['context', ValidationContextSchema, context],
      ] as const) {
        const parsed = schema.safeParse(value);
        if (!parsed.success) error('invalid-input', `${name}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      }
      if (diagnostics.length) return report();
      if (documentDigest(source) !== source.revision.digest || documentDigest(score) !== score.revision.digest) error('revision-stale', 'Document digest does not match its immutable content');
      const sourceRef = { id: source.revision.id, digest: source.revision.digest };
      if (!same(sourceRef, score.source.revision) || !same(source.manifest, score.source.manifest) || !same(sourceRef, score.selection.sourceRevision)) error('source-mismatch', 'Source ID/digest, manifest and selection must refer to the exact supplied source');
      if (!same(source.key, score.key)) error('source-mismatch', 'Source key uncertainty or identity was changed');
      const unique = (values: string[], name: string) => { if (new Set(values).size !== values.length) error('invalid-input', `Duplicate ${name} IDs`); };
      for (const [name, list] of Object.entries({ sourceEvents: source.events, bars: source.bars, tempos: source.tempos, sounds: score.sounds, rests: score.rests, notation: score.notation, placements: score.placements, performedSounds: score.performedSounds, contacts: score.contacts, occurrences: score.occurrences, changes: score.changes, candidates: score.plan.candidates })) unique(list.map((e) => e.id), name);
      unique(source.form.repeats.map((r)=>r.id),'repeat');
      unique([...score.sounds, ...score.rests].map((e) => e.id), 'combined event');
      unique(source.parts.map((p) => String(p.id)), 'part');
      const writtenEnd = eventEnd({ start: source.bars.at(-1)!.start, duration: source.bars.at(-1)!.length });
      const events = new Map(source.events.map((e) => [e.id, e]));
      for (const e of source.events) {
        const part = source.parts.find((p) => p.id === e.partId);
        if (!part || !part.voices.includes(e.voiceId) || compare(eventEnd(e), writtenEnd) > 0) error('source-mismatch', 'Invalid source event part, voice, or extent', [e.id]);
        for (const ref of e.refs) if (ref.partId !== e.partId || ref.voiceId !== e.voiceId || !source.bars.some((b) => b.id === ref.barId && overlaps(b.start, add(b.start,b.length),e.start,eventEnd(e)))) error('source-mismatch', 'Source raw reference is not in its event/part/voice/bar', [e.id], [ref.barId]);
        if (e.kind === 'note' && spellingPitch(e.spelling) !== e.soundingMidi) error('source-mismatch', 'Source spelling is not its sounding pitch', [e.id]);
      }
      validateSelection(source, score, events, writtenEnd, error);
      const expected = recomputeForm(source, score, error);
      if (expected) validatePerformed(score, expected.occurrences, error);
      validateNotation(score, error);
      validatePhysical(score, expected?.tempos ?? [], error);
      validateEvidence(source, score, events, error);
      validateApprovals(score, context, error);
      if (score.ability.transition.status === 'uncalibrated') diagnostics.push({ code: 'transition-unverified', severity: 'warning', message: `Static occupancy checks only; movement limits uncalibrated: ${score.ability.transition.reason}. Not a human-playability claim.`, eventIds: [], barIds: [], occurrenceIds: [] });
      return report();
    } catch (cause) {
      error('invalid-input', `Cannot validate malformed or unsupported data: ${cause instanceof Error ? cause.message : String(cause)}`);
      return report();
    }
  },
};

type ErrorSink = (code: Diagnostic['code'], message: string, eventIds?: string[], barIds?: string[], occurrenceIds?: string[]) => void;

function validateSelection(source: SourceScoreV1, score: ScoreV1, events: Map<string, SourceEvent>, writtenEnd: Q, error: ErrorSink) {
  let cursor = zero;
  const selected = new Map<string, SourceEvent>();
  const intentional = new Map<string, { id: string; start: Q; duration: Q; reason: string }>();
  for (const section of score.selection.sections) {
    if (compare(section.start, cursor) !== 0 || compare(section.end, writtenEnd) > 0) error('selection-needed', 'Selection sections must tile the complete written form in order', [], []);
    cursor = section.end;
    const intervals: { start: Q; end: Q; id: string }[] = [];
    const local = new Set<string>();
    for (const selector of section.selectors) for (const id of selector.eventIds) {
      const e = events.get(id);
      if (!e || e.partId !== selector.partId || e.voiceId !== selector.voiceId || local.has(id) || !overlaps(e.start, eventEnd(e), section.start, section.end)) { error('selection-needed', 'Selection ID is missing, duplicated, outside section, or has wrong part/voice', [id]); continue; }
      local.add(id); selected.set(id,e);
      intervals.push({ id, start: compare(e.start,section.start) < 0 ? section.start : e.start, end: compare(eventEnd(e),section.end) > 0 ? section.end : eventEnd(e) });
      if (e.kind === 'note' && e.effects.some((fx) => fx.affectsMelody)) error('unsupported-construct', 'Selected melody has an unsupported melody-affecting effect', [e.id]);
    }
    for (const rest of section.intentionalRests) {
      if (intentional.has(rest.id) || compare(rest.start,section.start) < 0 || compare(eventEnd(rest),section.end) > 0) error('selection-needed', 'Intentional silence must be unique and inside its section', [rest.id]);
      intentional.set(rest.id,rest); intervals.push({ id: rest.id, start: rest.start, end: eventEnd(rest) });
    }
    intervals.sort((a,b) => compare(a.start,b.start));
    let at = section.start;
    for (const i of intervals) { if (compare(i.start,at) !== 0) error('selection-needed', 'Selected notes/rests have a gap or unresolved polyphony', [i.id]); at=i.end; }
    if (compare(at,section.end) !== 0) error('selection-needed', 'Selection leaves an uncovered interval');
  }
  if (compare(cursor,writtenEnd) !== 0) error('selection-needed','Selection does not reach the final source event/bar');
  // Whole merged events must remain selected across every section they overlap.
  for (const e of selected.values()) for (const section of score.selection.sections) if (overlaps(e.start,eventEnd(e),section.start,section.end) && !section.selectors.some((s) => s.eventIds.includes(e.id))) error('selection-needed','A merged event crosses a section boundary without consistent whole-event selection',[e.id]);
  const actual = [...score.sounds, ...score.rests].filter((e) => e.role === 'melody');
  for (const e of selected.values()) {
    const matches = actual.filter((a) => a.provenance.kind === 'source' && same(a.provenance.eventIds,[e.id]));
    if (matches.length !== 1) { error('melody-mismatch','Every selected source event requires exactly one complete melody event',[e.id]); continue; }
    const a = matches[0]!;
    if (!same(a.start,e.start) || !same(a.duration,e.duration) || (e.kind === 'note') !== ('soundingMidi' in a)) error('melody-mismatch','Melody attack, sustain, or rest changed',[e.id]);
    if (e.kind === 'note' && 'soundingMidi' in a && a.soundingMidi !== e.soundingMidi + score.preferences.transposition.semitones) error('melody-mismatch','Melody sounding pitch changed without the exact explicit transposition',[e.id]);
    if (e.kind === 'note' && 'soundingMidi' in a && score.preferences.transposition.semitones===0 && !same(a.spelling,e.spelling)) error('melody-mismatch','Melody source spelling was silently changed',[e.id]);
  }
  for (const a of actual) {
    if (a.provenance.kind === 'source') {
      if (a.provenance.eventIds.length !== 1 || !selected.has(a.provenance.eventIds[0]!)) error('melody-mismatch','Extra/unselected melody event',[a.id]);
    } else if (a.provenance.kind === 'intentional') {
      const rest = intentional.get(a.provenance.selectionRestId);
      if (!rest || !same(rest.start,a.start) || !same(rest.duration,a.duration)) error('melody-mismatch','Invented or modified intentional rest',[a.id]);
    } else error('melody-mismatch','Generated melody is prohibited',[a.id]);
  }
  for (const r of intentional.values()) if (actual.filter((a) => a.provenance.kind === 'intentional' && a.provenance.selectionRestId === r.id).length !== 1) error('melody-mismatch','Intentional rest missing or duplicated',[r.id]);
  void source;
}

function recomputeForm(source: SourceScoreV1, score: ScoreV1, error: ErrorSink): { occurrences: Occurrence[]; tempos: PerformedTempo[] } | null {
  if (!same(source.bars,score.bars) || !same(source.tempos,score.tempos) || !same(source.form,score.form)) error('form-mismatch','Written bars/tempos/form differ from source');
  let cursor = zero;
  const barIndex = new Map<string,number>();
  for (const [i,b] of source.bars.entries()) { if (!same(cursor,b.start)) error('form-mismatch','Source bars are not contiguous from zero'); cursor=add(b.start,b.length); barIndex.set(b.id,i); }
  const repeats = source.form.repeats.map((r) => ({ from: barIndex.get(r.fromBarId), to: barIndex.get(r.toBarId), passes: r.totalPasses })).sort((a,b) => (a.from ?? -1)-(b.from ?? -1));
  let previous = -1;
  for (const r of repeats) {
    if (r.from === undefined || r.to === undefined || r.from > r.to || r.from <= previous) { error('unsupported-construct','Unsupported overlapping/nested/invalid form'); return null; }
    previous = r.to;
  }
  const positions: number[] = [];
  for (let i=0;i<source.bars.length;i++) {
    const r = repeats.find((r) => r.from === i);
    if (!r) positions.push(i);
    else { for (let p=0;p<r.passes;p++) for (let j=r.from!;j<=r.to!;j++) positions.push(j); i=r.to!; }
  }
  const writtenTempos = source.tempos.map((t) => {
    const b=source.bars.find((b) => b.id===t.barId);
    if (!b || compare(t.offset,b.length)>=0) { error('tempo-mismatch','Invalid source tempo position'); return null; }
    return { ...t, at:add(b.start,t.offset) };
  }).filter((t) => t!==null).sort((a,b) => compare(a.at,b.at));
  if (!writtenTempos.length || !same(writtenTempos[0]!.at,zero)) { error('tempo-mismatch','Missing initial source tempo'); return null; }
  for (let i=1;i<writtenTempos.length;i++) if (same(writtenTempos[i-1]!.at,writtenTempos[i]!.at)) error('tempo-mismatch','Duplicate source tempo position');
  const occurrences: Occurrence[] = [], tempos: PerformedTempo[] = [];
  const visits = new Map<number,number>();
  cursor=zero;
  for (const [i,index] of positions.entries()) {
    const bar=source.bars[index]!;
    const written=writtenTempos.filter((t) => compare(t.at,bar.start)<=0).at(-1)!;
    const o: Occurrence = { id:score.occurrences[i]?.id ?? `missing-${i}`, writtenBarId:bar.id, pass:(visits.get(index)??0)+1, start:cursor, length:bar.length, meter:bar.meter, entryQuarterBpm:written.quarterBpm*score.preferences.tempoScale, entry:i===0?'start':positions[i-1]===index-1?'contiguous':'repeat-jump' };
    visits.set(index,o.pass); occurrences.push(o);
    tempos.push({ occurrenceId:o.id,start:cursor,quarterBpm:o.entryQuarterBpm,origin:'entry-restore',sourceTempoId:written.id });
    for (const t of writtenTempos) if (compare(t.at,bar.start)>0 && compare(t.at,add(bar.start,bar.length))<0) tempos.push({occurrenceId:o.id,start:add(cursor,subtract(t.at,bar.start)),quarterBpm:t.quarterBpm*score.preferences.tempoScale,origin:'written-point',sourceTempoId:t.id});
    if (i>0 && o.entry==='repeat-jump') {
      const outgoing = source.bars[positions[i-1]!]!;
      const edge = add(outgoing.start,outgoing.length);
      for (const e of score.sounds) if ((compare(e.start,edge)<0&&compare(eventEnd(e),edge)>0)||(compare(e.start,bar.start)<0&&compare(eventEnd(e),bar.start)>0)) error('unsupported-construct','Jump-crossing sound or orphan continuation',[e.id]);
    }
    cursor=add(cursor,bar.length);
  }
  if (!same(occurrences,score.occurrences)) error('form-mismatch','Performed occurrence schedule, passes, meter or entry tempo differs from literal source expansion');
  if (!same(tempos,score.performedTempos)) error('tempo-mismatch','Performed tempo map must restore written entry BPM on every occurrence');
  return { occurrences,tempos };
}

function validatePerformed(score: ScoreV1, occurrences: Occurrence[], error: ErrorSink) {
  const expectedIds = new Set<string>();
  for (const s of score.sounds) {
    const bar = score.bars.find((b) => inside(s.start,b.start,add(b.start,b.length)));
    if (!bar) { error('form-mismatch','Sound attack is outside written bars',[s.id]); continue; }
    for (const [i,o] of occurrences.entries()) if (o.writtenBarId===bar.id) {
      const id=`${s.id}@${o.id}`; expectedIds.add(id);
      const covered=[o.id]; let available=subtract(add(bar.start,bar.length),s.start); let j=i;
      while (compare(available,s.duration)<0) {
        const next=occurrences[++j];
        if (!next || next.entry!=='contiguous') { error('unsupported-construct','Sustain crosses jump or performance end',[s.id]); break; }
        available=add(available,next.length); covered.push(next.id);
      }
      const p=score.performedSounds.find((p)=>p.id===id);
      const start=add(o.start,subtract(s.start,bar.start));
      if (!p || p.soundId!==s.id || p.attackOccurrenceId!==o.id || !same(p.occurrenceIds,covered) || !same(p.start,start) || !same(p.duration,s.duration)) error('form-mismatch','Missing/extra/retriggered or altered performed sound',[s.id],[],[o.id]);
    }
  }
  for (const p of score.performedSounds) if (!expectedIds.has(p.id)) error('form-mismatch','Unexpected performed sound',[p.soundId],[],[p.attackOccurrenceId]);
}

function validateNotation(score: ScoreV1,error: ErrorSink) {
  const events=[...score.sounds,...score.rests];
  for (const s of events) {
    const segments=score.notation.filter((n)=>n.eventId===s.id).sort((a,b)=>compare(a.start,b.start));
    let at=s.start;
    for (const [i,n] of segments.entries()) {
      const bar=score.bars.find((b)=>b.id===n.barId);
      const isNote='soundingMidi' in s;
      const tie=!isNote||segments.length===1?'none':i===0?'start':i===segments.length-1?'end':'continue';
      if (!same(n.start,at)||n.voiceId!==s.voiceId||n.kind!==(isNote?'note':'rest')||n.tie!==tie||!bar||compare(n.start,bar.start)<0||compare(eventEnd(n),add(bar.start,bar.length))>0) error('melody-mismatch','Notation must exactly tile sound/rest inside bars with correct voice/tie',[s.id]);
      at=eventEnd(n);
    }
    if (!segments.length||!same(at,eventEnd(s))) error('melody-mismatch','Notation leaves a gap, overlaps, or truncates an event',[s.id]);
    if ('soundingMidi' in s && spellingPitch(s.spelling)!==s.soundingMidi) error('melody-mismatch','Sound spelling is not its sounding pitch',[s.id]);
  }
  for (const n of score.notation) if (!events.some((s)=>s.id===n.eventId)) error('melody-mismatch','Notation refers to absent event',[n.eventId]);
  const groups=new Map<string,typeof score.notation>();
  for (const n of score.notation) if (n.tuplet) groups.set(n.tuplet.groupId,[...(groups.get(n.tuplet.groupId)??[]),n]);
  for (const group of groups.values()) {
    const first=group[0]!.tuplet!;
    if (new Set(group.map((n)=>n.tuplet!.index)).size!==group.length || group.some((n)=>n.tuplet!.actual!==first.actual||n.tuplet!.normal!==first.normal)) error('melody-mismatch','Tuplet group has conflicting ratios or duplicate indices',group.map((n)=>n.eventId));
  }
}

function validatePhysical(score: ScoreV1, tempos: PerformedTempo[],error: ErrorSink) {
  const { ability:a,instrument:g,preferences:p }=score;
  if (p.difficulty!==a.difficulty||p.ability.id!==a.id||p.ability.version!==a.version||score.capoComparison.selected!==g.capo||(p.capo.mode==='chosen'&&p.capo.value!==g.capo)||(p.capo.mode==='recommend'&&!p.capo.compare.includes(g.capo as 0|2))) error('profile-limit','Difficulty, resolved profile and selected capo disagree');
  const placements=new Map(score.placements.map((p)=>[p.id,p]));
  const contactsBySound=new Map<string,typeof score.contacts>();
  for (const c of score.contacts) contactsBySound.set(c.performedSoundId,[...(contactsBySound.get(c.performedSoundId)??[]),c]);
  for (const ps of score.performedSounds) {
    const s=score.sounds.find((s)=>s.id===ps.soundId), pl=placements.get(ps.placementId), cs=contactsBySound.get(ps.id)??[];
    if (!s||!pl||pl.soundId!==s.id) { error('pitch-placement','Missing or mismatched placement',[ps.soundId]); continue; }
    if (s.soundingMidi!==g.tuning[pl.stringIndex]!+g.capo+pl.fret) error('pitch-placement','Pitch must equal sounding tuning + capo + relative fret',[s.id]);
    if (g.capo+pl.fret>Math.min(g.maxPhysicalFret,a.maxPhysicalFret)) error('profile-limit','Physical fret exceeds instrument or ability limit',[s.id]);
    if (cs.length!==1||cs[0]!.soundId!==s.id||cs[0]!.placementId!==pl.id||!same(cs[0]!.start,ps.start)||!same(cs[0]!.release,eventEnd(ps))) error('finger-collision','Every performed sound requires one whole, unaltered held contact',[s.id]);
  }
  for (const pl of score.placements) if (!score.performedSounds.some((ps)=>ps.placementId===pl.id)) error('pitch-placement','Orphan/unused placement',[pl.soundId]);
  for (const c of score.contacts) if (!score.performedSounds.some((ps)=>ps.id===c.performedSoundId)) error('finger-collision','Orphan held contact',[c.soundId]);
  const boundaries=[...new Map(score.performedSounds.flatMap((ps)=>[ps.start,eventEnd(ps)]).map((t)=>[`${t.n}/${t.d}`,t])).values()].sort(compare);
  if (boundaries.length!==score.handStates.length) error('finger-collision','Hand states must include every attack and release boundary exactly once');
  const lastFinger=new Map<number,{ stringIndex:number;fret:number;release:Q }>();
  let lastAnchor:{at:Q;physical:number}|null=null;
  for (const [i,at] of boundaries.entries()) {
    const active=score.performedSounds.filter((ps)=>inside(at,ps.start,eventEnd(ps)));
    const contacts=active.flatMap((ps)=>contactsBySound.get(ps.id)??[]);
    const ids=contacts.map((c)=>c.id).sort();
    const state=score.handStates[i];
    if (!state||!same(state.at,at)||!same([...state.activeContactIds].sort(),ids)) error('finger-collision','Post-release-then-attack hand state differs from independent half-open sweep');
    const ps=active.flatMap((s)=>{const p=placements.get(s.placementId);return p?[p]:[];});
    const stopped=ps.filter((p)=>p.fret>0);
    if (new Set(ps.map((p)=>p.stringIndex)).size!==ps.length) error('string-collision','Two held sounds occupy one string',active.map((s)=>s.soundId));
    if (new Set(stopped.map((p)=>p.finger)).size!==stopped.length) error('finger-collision','Held finger reused on another contact; barre unsupported',active.map((s)=>s.soundId));
    const frets=stopped.map((p)=>p.fret);
    if (ps.length>a.maxSoundingNotes||stopped.length>a.maxFrettedContacts||(frets.length&&Math.max(...frets)-Math.min(...frets)>a.maxStoppedFretSpan)) error('profile-limit','Sounding/fretted contact count or stopped-fret span exceeds profile',active.map((s)=>s.soundId));
    if (state && (frets.length ? state.position.kind!=='fretting'||state.position.anchorPhysicalFret!==Math.min(...frets)+g.capo : state.position.kind!=='released')) error('finger-collision','Hand anchor must describe the active stopped contacts');
    const newStopped=active.some((sound)=>same(sound.start,at)&&(placements.get(sound.placementId)?.fret??0)>0);
    if (newStopped&&frets.length) {
      const physical=Math.min(...frets)+g.capo;
      if (lastAnchor&&a.transition.status==='specified'&&Math.abs(physical-lastAnchor.physical)>elapsedSeconds(lastAnchor.at,at,tempos)*a.transition.maxPhysicalFretsPerSecond+1e-9) error('profile-limit','Hand-position movement exceeds specified speed at effective tempo',active.map((s)=>s.soundId));
      lastAnchor={at,physical};
    }
    for (const sound of active.filter((s)=>same(s.start,at))) {
      const pl=placements.get(sound.placementId); if (!pl||pl.finger===0) continue;
      const last=lastFinger.get(pl.finger);
      if (last&&compare(last.release,at)<=0&&a.transition.status==='specified'&&(last.stringIndex!==pl.stringIndex||last.fret!==pl.fret)) {
        const elapsed=elapsedSeconds(last.release,at,tempos);
        if (elapsed*1000+1e-7<a.transition.minFingerReassignmentMs||Math.abs(last.fret-pl.fret)>elapsed*a.transition.maxPhysicalFretsPerSecond+1e-9) error('profile-limit','Finger reassignment/movement exceeds specified limits at effective tempo',[sound.soundId]);
      }
      lastFinger.set(pl.finger,{stringIndex:pl.stringIndex,fret:pl.fret,release:eventEnd(sound)});
    }
  }
}

// Separate tempo integration from generation's playback helper.
function elapsedSeconds(from: Q,to: Q,tempos: PerformedTempo[]): number {
  let seconds=0;
  for (let i=0;i<tempos.length;i++) {
    const t=tempos[i]!,next=tempos[i+1]?.start??to;
    const left=compare(from,t.start)>0?from:t.start,right=compare(to,next)<0?to:next;
    if (compare(right,left)>0) { const d=subtract(right,left);seconds+=d.n/d.d*60/t.quarterBpm; }
  }
  return seconds;
}

function validateEvidence(source: SourceScoreV1,score: ScoreV1,events: Map<string,SourceEvent>,error: ErrorSink) {
  // Independent interval oracle, deliberately not the generator's role predicate.
  // Full performed expansion is checked separately, so every written overlap
  // here also covers all its sounding occurrences (including held transitions).
  for(const lower of score.sounds) for(const upper of score.sounds) {
    const ordered=lower.role==='bass'&&(upper.role==='harmony'||upper.role==='melody')||lower.role==='harmony'&&upper.role==='melody';
    if(!ordered||lower.soundingMidi<upper.soundingMidi||!overlaps(lower.start,eventEnd(lower),upper.start,eventEnd(upper))) continue;
    const barIds=score.bars.filter((b)=>overlaps(b.start,add(b.start,b.length),lower.start,eventEnd(lower))&&overlaps(b.start,add(b.start,b.length),upper.start,eventEnd(upper))).map((b)=>b.id);
    error('unsatisfied',`[role-order-v1] Sounding ${lower.role} must be strictly below ${upper.role} throughout their overlap; explicit reapproval/revoicing is required, not an implicit inversion`,[lower.id,upper.id],barIds);
  }
  for (const c of score.plan.candidates) for (const id of c.sourceEventIds) if (events.get(id)?.kind!=='note') error('source-mismatch','Plan references a nonexistent/non-note source event',[id]);
  const bass=score.sounds.filter((s)=>s.role==='bass').sort((a,b)=>compare(a.start,b.start));
  for (let i=1;i<bass.length;i++) if (overlaps(bass[i-1]!.start,eventEnd(bass[i-1]!),bass[i]!.start,eventEnd(bass[i]!))) error('profile-limit','Bass is monophonic, even on different strings',[bass[i-1]!.id,bass[i]!.id]);
  if (score.planner.mode==='configured-llm'&&score.planner.acceptedCandidateIds.some((id)=>!score.plan.candidates.some((c)=>c.id===id))) error('source-mismatch','Planner acceptance references absent candidate');
  for (const s of score.sounds.filter((s)=>s.role!=='melody')) {
    const ids=s.provenance.kind==='source'?s.provenance.eventIds:s.provenance.evidenceEventIds;
    const evidence=ids.map((id)=>events.get(id));
    if (evidence.some((e)=>!e||e.kind!=='note'||e.effects.some((fx)=>fx.affectsMelody))) error('source-mismatch','Accompaniment has missing or unsupported source evidence',[s.id]);
    const exact=evidence.find((e)=>e?.kind==='note'&&same(e.start,s.start)&&((s.soundingMidi-e.soundingMidi-score.preferences.transposition.semitones)%12===0)&&compare(s.duration,e.duration)<=0);
    if (!exact||exact.kind!=='note') { error('source-mismatch','Accompaniment must preserve source attack, pitch class and no longer than source duration',[s.id]);continue; }
    const shifted=s.soundingMidi!==exact.soundingMidi+score.preferences.transposition.semitones;
    const shortened=!same(s.duration,exact.duration);
    if ((shifted||shortened)&&s.provenance.kind!=='generated') error('source-mismatch','Adapted accompaniment must disclose generated strategy/evidence provenance',[s.id]);
    for (const [needed,kind] of [[shifted,'bass-register'],[shortened,'shortened-sustain']] as const) if (needed&&!score.changes.some((c)=>c.kind===kind&&c.role===s.role&&c.sourceEventIds.includes(exact.id)&&c.soundIds.includes(s.id)&&c.before.soundingMidi===exact.soundingMidi&&same(c.before.duration,exact.duration)&&c.after?.soundingMidi===s.soundingMidi&&same(c.after.duration,s.duration))) error('source-mismatch',`Undisclosed accompaniment ${kind}`,[s.id]);
  }
  for (const c of score.changes) {
    if (c.sourceEventIds.some((id)=>!events.has(id))||c.soundIds.some((id)=>!score.sounds.some((s)=>s.id===id))) error('source-mismatch','Change references absent source/sound',c.sourceEventIds);
    if (c.kind==='omission'&&(c.after!==null||c.soundIds.length)) error('source-mismatch','Omission must have no after/sounds',c.sourceEventIds);
    const e=events.get(c.sourceEventIds[0]!);
    if (!e||e.kind!=='note'||c.before.soundingMidi!==e.soundingMidi||!same(c.before.duration,e.duration)) error('source-mismatch','Change before-state differs from source',c.sourceEventIds);
    if (c.role==='melody'&&c.kind!=='explicit-transposition') error('melody-mismatch','Melody cannot be omitted, register-edited or shortened by a change record',c.sourceEventIds);
    for (const id of c.soundIds) {
      const s=score.sounds.find((s)=>s.id===id);
      if (s&&(s.role!==c.role||!c.after||c.after.soundingMidi!==s.soundingMidi||!same(c.after.duration,s.duration))) error('source-mismatch','Change after-state differs from arranged sound',[id]);
    }
  }
  for (const c of score.plan.candidates) for (const id of c.sourceEventIds) {
    const kept=score.sounds.some((s)=>s.role===c.role&&(s.provenance.kind==='source'?s.provenance.eventIds:s.provenance.evidenceEventIds).includes(id));
    const omitted=score.changes.some((change)=>change.kind==='omission'&&change.role===c.role&&change.sourceEventIds.includes(id));
    if (kept===omitted) error('source-mismatch','Each source accompaniment proposal must be retained or visibly omitted, not both',[id]);
  }
  void source;
}

function validateApprovals(score: ScoreV1,context: ValidationContext,error: ErrorSink) {
  const roles=['melody','bass','harmony'] as const;
  const stage=score.approvals;
  const records=stage.stage==='sourceReady'?[]:stage.stage==='melodyApproved'?[['melody',stage.melody] as const]:stage.stage==='bassApproved'?[['melody',stage.melody] as const,['bass',stage.bass] as const]:[['melody',stage.melody] as const,['bass',stage.bass] as const,['harmony',stage.harmony] as const];
  for (const role of roles) if (score.locks.filter((l)=>l.role===role).length>1) error('approval-stale','Duplicate role locks');
  const verify=(role: Sound['role'],ref: ScoreV1['source']['revision'],hash: string) => {
    const approved=context.approvedRevisions.find((r)=>r.revision.id===ref.id&&r.revision.digest===ref.digest);
    if (!approved||documentDigest(approved)!==ref.digest||scopeDigest(approved,role)!==hash||scopeDigest(score,role)!==hash||!same(approved.source,score.source)) {error('approval-stale','Approval not backed by the supplied immutable revision or changed scope');return null;}
    return approved;
  };
  for (const [role,record] of records) {
    verify(role,record.approvedFrom,record.scopeDigest);
    if (!score.locks.some((l)=>l.role===role&&same(l.approvedFrom,record.approvedFrom)&&l.scopeDigest===record.scopeDigest)) error('approval-stale','Stage approval missing its full approved lock');
  }
  for (const lock of score.locks) {
    const approved=verify(lock.role,lock.approvedFrom,lock.scopeDigest);
    if (!approved) continue;
    const sounds=ordered(approved.sounds.filter((s)=>s.role===lock.role)),rests=ordered(approved.rests.filter((s)=>s.role===lock.role));
    if (!same(ordered(lock.sounds),sounds)||!same(ordered(lock.rests),rests)||!same(ordered(score.sounds.filter((s)=>s.role===lock.role)),sounds)||!same(ordered(score.rests.filter((s)=>s.role===lock.role)),rests)) error('approval-stale','Full lock events differ from approved revision/candidate');
  }
}

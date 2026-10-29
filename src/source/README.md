# Songsterr source boundary (U04)

Public entry point: `src/source/index.ts`. Runtime: Bun (the adapted reference
uses `HTMLRewriter` for the one `script#state` element, not a generic scraper).
No new dependencies.

```ts
import { songsterrSourceAdapter, createDefaultMelodySelection } from './source';

const imported = await songsterrSourceAdapter.import({ kind: 'songsterr-url', url }, signal);
if (imported.status !== 'source-ready') return imported;
// API NOW allocates project/source revision identity and parent, schema-parses
// and recomputes revisionDigest. Never save the provisional import header.
const stampedSource = await apiOwnedStampAndPersist(imported.source);
const proposal = createDefaultMelodySelection(stampedSource);
// proposal.status === 'proposed' is complete, source-grounded and UNAPPROVED.
// proposal.status === 'selection-needed' means a real unsupported/conflicting choice.
```

**Identity clarification confirmed by parent, 2026-10-20:** frozen `ImportInput`
has `{kind,url}` only; no identity fields were added or silently accepted.
The adapter returns an internally schema/digest-valid **provisional import document**,
not a corrupted/stale saved score. API owns project and source revision identity,
parent allocation and recomputed digest **before saving or calling the helper**.
Recreate/rebind the selection after stamping; preserve all musical event IDs.
The info diagnostic uses the existing `selection-needed` code because the
frozen diagnostic enum has no dedicated import-provenance code; it is not an
error, and a complete unapproved proposal is not an incomplete melody.

`createSongsterrSourceAdapter({saveArtifact})` lets the API persist immutable raw
bytes by the supplied SHA-256 descriptor, before committing a source document.
Without a sink, `songsterrRawArtifacts.get(sha256)` retrieves copied bytes from
a bounded, ephemeral 64 MiB store. That store can evict old data; it is **not**
durable revision storage. There is no hidden file write in production import.

Limits: 32 parts, 1,000 bars per part, 8 MiB per response, 32 MiB per import,
15 seconds per resource including at most 3 redirects, 60 seconds overall,
and at most 100,000 processed beats per part. Public HTTPS Songsterr pages and
one fixed player CDN only; no auth, alternate CDN retries, premium downloads,
CAPTCHA workaround or fallback demo. Denials/restrictions stop all remaining
requests. Queries/fragments are never forwarded or saved in manifest identity.
Unknown versions, absent access flags, rhythm contradictions, malformed ties,
unsupported form and inconsistent parts fail explicitly without a partial pitched score.

Parser 1.4.0 also accepts a structurally complete part that omits `version`,
without defaulting or assigning that part a version. At least one acquired part
must explicitly declare a supported version, and declared versions must agree.
The additive Songsterr identity field `unversionedPartIds` lists the exceptions:
`formatVersion` applies only to the other, versioned parts. Existing identities
without exceptions remain unchanged. Raw bytes, diagnostics, musician briefs
and publication notes retain/disclose the exception. Null, unknown, inconsistent
or entirely absent versions still fail closed, as do all musical/security checks.

All source fractions are reduced exact rationals in quarters; raw bytes retain
the original whole-fraction syntax and every original field. Merged ties/unison
members retain every ref. Parser 1.3.1 interprets a single undotted whole-rest
symbol in an explicitly silent measure/voice as a full-measure rest of the current
meter. Its raw whole-note fraction remains unchanged in references. Pitched,
partial, dotted, tuplet, grace and ambiguous beats are never resized to fit.
Source frets are relative to the source capo:
sounding pitch is original tuning[string] + source capo + relative fret.
Parser 1.3.0 materializes that offset once in `sourceTuning.soundingMidi` and
canonical notes; original tuning/capo and relative positions remain in raw
artifacts/refs, with a `source-capo` interpretation effect on notes. The final
arrangement capo is independent and never transposes canonical source pitches.
Missing/null/zero source capo means zero. Invalid/overflowing pitches and
unknown partial-capo constructs still fail closed. Boolean `tuningFlat` is
a display preference only, not a semitone offset or a declared key.
`source-notation` non-melody effects retain per-beat
base/dots/tuplet hints on notes; rest notation is recoverable from raw artifacts
and exact fractions. No parallel canonical model was introduced. Sharp spelling
is disclosed display convention; key remains unknown without sufficient evidence.

Eighth/sixteenth triplet feel (`8th`/`16th`) is inherited by written position;
`off`/`none` resets straight time. The importer materializes exact 2:1 timing
by mapping both event boundaries, including dotted notes, rests and tied
continuations. Explicit tuplets/finer subdivisions disable swing in their pair
across the measure's voices; an incomplete final pair stays straight. Raw refs
retain nominal whole-note fractions, and `source-triplet-feel` effects disclose
the interpretation. Canonical notation/playback/MIDI use these exact times,
without applying a second renderer swing. Parts must agree on effective feel.
Unknown feels and tempo changes inside swung pairs still fail explicitly.

Parser 1.2.0 materializes within-bar `beforeBeat`/`onBeat` grace groups using
the public player's bounded time-borrowing convention. Grace pitches remain
separate attacks with every raw reference; nominal grace values do not add to
the meter or enter swing grouping. A group borrows from the preceding/following
metrical beat, capped by its mean nominal grace duration and the donor's retained
half (quarter/eighth for dotted/double-dotted grace notation). Oversized groups
share that budget equally. Score-zero before-beat grace falls back to on-beat
time rather than a negative onset. Unknown, mixed, orphan/cross-bar, rest/tied
grace cases and exhausted donors still fail explicitly. `source-grace` and
`source-grace-donor` effects disclose the interpretation; exports engrave exact
realized values rather than small-note ornamental glyphs.

Unsupported note effects are retained and diagnosed. A chosen line with a
melody-affecting effect returns `selection-needed`, not invented silence or an
automatic accompaniment substitution. Percussion identifiers have an explicit
`unpitched-percussion`/`affectsMelody` marker and are not pitched melody candidates;
unrepresentable percussion is retained raw-only with its part identity and warning.
V1 has no native percussion-event variant. Expressive playback is not implemented.
Known `hp` legato and `staccato` flags are retained as expressive articulation,
not pitch changes. Nominal metrical note durations are preserved, but expressive
gating/legato and their glyphs are not reproduced. Publication notes disclose
this limitation for selected notes; do not claim expressive-performance fidelity.
Closed `legato`/`shift` slides have a bounded nominal-endpoint interpretation in
parser 1.4.0: the immediately following source beat must provide one explicit,
untied note on the same source string, contiguous with the origin's release.
Both original pitches and onsets/releases remain unchanged. The retained
`articulation-closed-slide` effect records both source refs/pitches and the policy.
Continuous glides and slide glyphs are not reproduced, as the published notes
explicitly state. Open-ended, unknown, rest-target, orphan and ambiguous slides
remain unsupported; this is not a blanket exemption for pitch-changing effects.
Descriptive `title` and numeric `grandStaffGroup` metadata are validated and kept
in raw artifacts; they do not change canonical rhythm or pitch.

For an explicitly requested **simplified melody draft**, preparation accepts
`--simplify-bends` (adapter option `simplifyBends: true`). This is opt-in, never
the default or an automatic retry. A strict, bounded known bend curve may then
be rendered at its **notated starting pitch and original metrical duration**;
the continuous bend/scoop is intentionally omitted, not decoded or reproduced.
The raw curve and source-note identity remain in `source-bend-simplified`, so
the source digest binds the interpretation. Diagnostics, the musician brief
and published notes disclose selected simplified bends. Unknown/malformed
curves still fail closed. Such output is not an exact expressive transcription;
no other pitch, octave, timing or source-selection edit is authorized by this flag.

The default helper ranks actual source voices by activity, register and
public timbre/name evidence, ignores website-default track identity, and fills
leading/multi-bar silent runs from a disclosed fallback line. It selects whole
event IDs (highest simultaneous onset, held selection wins over overlap), never
clips a tie. Source rests plus reasoned intentional rests cover all written time;
provenance records selected, overlapping omitted and intentional-silence evidence
IDs. Among locally monophonic fallback alternatives, prefer a fully supported
existing source line, then MIDI 40–76 (the fixed standard-guitar physical range); do not
transpose a high flute line to manufacture a replacement. This choice is
explicitly unapproved and published by source part/section. Role/intro/outro
judgments remain pending musician review.
Unsupported effects remain intact on unselected alternatives. The primary voice
and any actually selected unsupported note still block the proposal; no effect
is stripped or reclassified to manufacture a successful import.

Parser 1.4.1 validates beat `chord` as a strict descriptive `{text,width?}` label.
Its text/layout is retained in raw artifacts and `source-chord-label` note effects;
it never changes explicit notes, timing, selection approval or key uncertainty.
Unknown chord properties and malformed labels fail closed. Strum/arpeggio timing
instructions remain separate unsupported musical effects, not label metadata.
Fallback candidates must also fit the primary-silent interval as whole events;
when none fits, the actual primary source rests remain disclosed silence rather
than clipping or retriggering an already-held instrumental alternative.

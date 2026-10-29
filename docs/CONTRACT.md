# Canonical guitar contract V1 — U03

Authoritative runtime schemas/types: [`src/domain/index.ts`](../src/domain/index.ts).
Status: **implementation boundary frozen for parent review**, not an accepted arrangement,
renderer choice, or independent product validator. JSON documents have `schemaVersion: 1`;
breaking changes require a version bump and explicit migration. No renderer dependency is installed.

## Scope and ownership

| Owner | Inputs → outputs | Required behavior, not implemented here |
|---|---|---|
| Source/U04 | `SourceAdapter.import(ImportInput, signal?) → Promise<ImportResult>` | Adapt the read-only reference importer; bounded fetch/parse; stop on restrictions/403; preserve raw artifacts, exact fractions, metadata and unsupported effects. No default-track melody assumption. |
| Form/U05 | written bars/tempos/form → occurrences, performed tempos/sounds | One exact expansion; entry restoration; reject unsupported directions and jump-crossing ties. |
| Planner/U10 | `OptionalPlanner.plan(source, request, signal?) → {plan, provenance, diagnostics}` | Network outside engine; verify candidate source IDs. Actual calls only get configured-LLM provenance. |
| Engine/U07–09 | `Engine.arrange(source, request, plan, planner) → ArrangeResult` | Pure deterministic candidate generation, no I/O, no hidden melody edits; bounded state search. |
| Validator/U08 | `Validator.validate(source, score, context) → ValidationReport` | Independently recompute identity, melody/rest selection, form/time, locks and physical constraints. Context contains API-loaded approved revisions, not candidate claims. |
| Export/U02,U12 | `ScoreAdapter.project(validated)`, `exportArtifact(source, validated, format, signal?)` | Native objects remain private; staff + TAB, actual PDF/MIDI bytes, runtime revalidation, exact adapter representability checks. U02 still gates production renderer adoption. |
| API/UI/U06,U11,U12 | `Api`, `RevisionStore`, wire schemas in `ports.ts` | External runtime parsing, immutable storage, CAS/head checks, dependency invalidation, approval UI, draft labels and worker cancellation. No API server exists yet. |

U03 owns schemas, rational/identity helpers, original fixtures and negative-oracle examples only.
Structural parsing does **not** prove referential completeness, full-song identity, feasibility,
review, or correct artifacts. It rejects malformed fields, missing critical state, invalid
rationals, incompatible notation duration and stale validation-envelope references. Graph and
musical invariants below belong to the independent validator. No `unknown` music-field placeholders.
External untrusted JSON may of course enter `.parse()` as `unknown`.

## Time, identity and source

- `Q = {n,d}` uses reduced safe integers, positive `d`, quarters, zero `0/1`. Time is
  nonnegative; duration is positive. Helpers use BigInt intermediates, never float arithmetic.
  Overflow and nonintegral `exactTicks(time, ppq)` fail; adapters must report unsupported
  denominator/tuplet constructs instead of quantizing. Tempo in `quarterBpm` is finite positive
  BPM, not beat-unit-dependent BPM. Seconds and integer-microsecond MIDI tempo rounding exist
  only at playback/export boundaries. `tempoScale` multiplies BPM once, not note times.
- Written `start` is absolute from written-score origin. Performed `start` is absolute from
  unfolded-performance origin. Every interval is half-open `[start,end)`; `overlaps` returns
  false for empty or reversed intervals. Schema-valid sounds/contacts still require positive duration.
  A bar's `length`
  equals its meter unless explicitly marked pickup/partial. Meter is materialized per occurrence.
- IDs are nonempty stable strings scoped by their containing immutable document. Part IDs are
  source integers; never confuse part 0 with the website default 2. Source event IDs identify
  merged attacks/rests; `refs[]` retain every raw chord member/continuation with part, bar,
  voice, beat, note index, original whole-note fraction and optional original string/fret.
  Source string orientation is explicit and is **not** final guitar fingering.
- `SourceScoreV1` keeps all parsed parts, notes/rests, bars, meter, key uncertainty, tempo and
  repeat sections. Melody-affecting `effects[]` must be understood or explicitly rejected.
  Raw artifacts are separate immutable blobs identified by SHA-256, byte length and media type;
  no huge JSON blob or copyrighted score needs to be embedded in each arrangement.
- Manifest identity distinguishes Songsterr song/upstream revision/format version, upload,
  and original fixture. Record parser version/retrieval time. Export no credentials, signed
  URLs, access tokens or opaque query secrets. Do not silently erase restricted flags in the
  importer: return `restricted` before producing `source-ready`.
  Additive Songsterr identity extension `unversionedPartIds` records structurally validated
  parts with missing upstream version metadata. `formatVersion` is the agreed, explicitly
  declared version of the remaining parts, never a default assigned to those exceptions.
  Existing versioned identities remain unchanged; all-unversioned imports still fail rather
  than inventing a required version. This metadata extension changes no musical schema.

### Manageable immutable revisions, not an event-sourcing framework

Persist one full JSON document per source/arrangement revision, one current-head reference per
project, and raw blobs separately. Retain earlier documents; no patch log, database framework,
or renderer serialization is required. `{id,digest}` binds identity, not merely content similarity.
An arrangement stores the exact source reference **and manifest**, complete selection, settings,
musical content, form, fingering, locks and review/provenance. Retrieval by ID returns the full
document; a hash or URL is never a substitute for musical identity.

`revisionDigest(document)` hashes canonical UTF-8 JSON with sorted object keys, array order
preserved and **only that document's `revision.digest` omitted**. Includes its ID, parent ID,
all source references and every other field. `contentDigest()` hashes a scope or raw JSON value.
Undefined, NaN, Infinity, negative zero, sparse arrays and nonplain objects are rejected.
Use strict schema parsing before hashing/persistence. Hashes are corruption/staleness checks,
not authorization or proof of music correctness.

**API orchestration owns authoritative project/revision identity allocation and stamping**, for
both source imports and arrangement candidates. It allocates a fresh project ID for a first
save, retains the trusted project ID for later revisions, allocates every new revision ID,
sets the parent from the trusted head (or null for first create), then computes the digest.
The pure engine performs no random ID allocation, head lookup or persistence: its required
score header may use deterministic provisional candidate identities. API replaces that header
before validation, approval or persistence; provisional identities/digests are never authoritative.
It must not rewrite musical event IDs or existing approval/source references while stamping.
Canonical source revision IDs are API-owned; provider song/upstream revision identities remain unchanged.

First save uses `RevisionStore.commit(projectId, {kind:'create', expectedHead:null, replacement})`.
Create requires `replacement.revision.parentId:null` and an **absent** project head, checked
atomically with insertion. Create on an existing project returns `conflict` with its current
reference and does not overwrite it. A schema alone cannot check storage absence.

Every later edit **and approval** creates a new ID/parentId and recomputed digest, including
unapproved drafts. Existing mutation kinds retain their nonnull `expectedHead`; commit compares
**both** head ID and digest atomically. An edit of an absent project returns
`{status:'conflict', currentHead:null}` rather than implicitly creating it.
Reject duplicate ID, wrong parent, changed project identity,
or a changed source outside the explicit `source-edit` mutation,
bad digest or stale head; do not overwrite either revision. Errors/cancellation preserve the old head.
Load recomputes source and arrangement digests; an export request must match the current head.
Caches key on full revision reference + adapter/version + format, never just project/song URL.

Approval records refer to the prior immutable revision approved by the musician plus a scoped
digest. This avoids hashing a revision into itself. Scope payloads:

| Scope | Exact canonical payload for `contentDigest` |
|---|---|
| melody | `{sourceRevision, selection, transposition, sounds, rests}` with melody-only ordered events |
| bass | `{melodyScopeDigest, sounds, rests, changes}` with bass-only ordered events/changes |
| harmony | `{bassScopeDigest, sounds, rests, changes}` with harmony-only ordered events/changes |

Order each scoped event list by exact start then ID before hashing; never use display order.
`ApprovedLock` stores the full approved sounds/rests as well as the digest/reference; validator
recomputes the scope from the referenced revision and compares exact events, not hashes alone.
`ValidationContext.approvedRevisions` supplies at most the three referenced full stage revisions,
loaded and digest-verified by the API from its store (empty for an unapproved draft). This keeps
validation pure without trusting a candidate's invented approval/lock snapshots. Client-supplied
contexts are not authoritative. An absent referenced approval is an error, not an unlocked pass.
Copying a lock onto a changed candidate does not preserve validity.

## Explicit melody, pitch, capo and ability

`MelodySelection` binds the exact source revision. Sections are ordered nonoverlapping written-time
ranges covering the complete form; selectors specify **part + voice + event IDs**, including rests.
An intentional silent interval is explicit with reason, not a missing event. `source-ready`
means acquired source, not musician-approved melody. A **complete source-grounded proposed
default map** (for example intro from part 1/main vocal from part 0, with disclosed remaining
choices) can produce an auditionable, unapproved draft without manually resolving subjective
intro/outro judgments first. Show the actual selected events and pending review; do not claim
musical approval. Return `selection-needed` for an actually incomplete/conflicting map (gaps,
overlaps or unresolved polyphony), not merely because a complete disclosed default is unapproved.
Track selection alone is insufficient. Events crossing a section boundary require consistent
selection of the whole merged event (no implicit clipping). Melody and bass are each monophonic;
harmony can have multiple independent voices. Equal pitches in different roles remain distinct.

Validator derives every selected `(source identity, sounding pitch, start, end)` and rest interval,
then compares every performed occurrence. Preserve pitches, merged ties, triplets, silence and
the final event. Only `preferences.transposition = {mode:'explicit', semitones, authorizationId,
reason}` authorizes a semitone change. `preserve` is exactly zero. No independent octave editing
escape hatch. Source/key uncertainty remains visible; do not assert B major from a capo suggestion.

Standard tuning is **`[40,45,50,55,59,64]` low-to-high**; internal string 0 is low E, TAB string
number is `6-stringIndex`. Physical/MIDI pitches are already sounding. Spellings are in sounding
octave; guitar engraving displays `writtenOctaveOffset:12`. The projection must account for the
octave-transposing instrument exactly once, never modify the canonical sounding pitch.

For relative fret `r`, capo `c`, string `s`:

```
soundingMidi = tuning[s] + c + r
physicalNeckFret = c + r
```

Check physical fret against **both** instrument and ability maxima. Relative stopped-fret span
ignores opens; it is separate from physical neck limit. Capo 2/open low E is MIDI 42 and physical
fret 2; high E is 66, not 68. MIDI 40/41 cannot be placed at capo 2. Capo 2/relative fret 10 fits
a physical maximum 12; relative 11 does not. Export MIDI adds **no** further capo/transpose offset.

Preferences always specify difficulty and a versioned resolved ability. The later React prompt
offers intermediate/standard tuning as the demo, but synthetic limits do not establish what
intermediate means for a human. Capo can be chosen or request recommendation comparing `[0,2]`.
`CapoComparison` records chosen value, reasons and outcomes; `not-evaluated` is honest, not a
recommendation claim. Preserve concert melody/key for each candidate; disclose bass register
changes/omissions. Difficulty, profile version, capo choice and effective instrument must agree.

Every placement requires finger: open/fret 0 uses finger 0, stopped uses 1–4. No barre in any
initial profile. Every performed sound has one placement and one complete held contact, including
open strings. Different occurrences may choose different placements of the same written sound.
The entire sustain occupies a string. Every attack/release has a post-release-then-attack
`HandState`; its active IDs must equal the recomputed sweep. A held finger cannot move to another
string/fret. Two roles cannot share an occupied string, even in unison. Never infer a barre.

Synthetic limits (12 physical frets, span 4, four sounding/fretted contacts) are test-only.
Transitions use the effective tempo map and profile's explicit speed/reassignment limits.
`uncalibrated` must produce `transition-unverified`; it cannot support a human-playability claim.
A hard-validated draft may still be downloadable with that limitation and pending musical review.

## One performed timeline; exact ties/tuplets

`Form` supports nonnested, nonoverlapping linear repeat sections with total passes. Other
directions/endings/nested repeats return `unsupported`, not a flattened success. `occurrences[]`
is the authoritative ordered performed bar schedule. Each includes ID, original written bar,
pass (visit count of that bar), performed start/length, effective entry BPM and meter.
`performedTempos[]` materializes the entry restoration **for every occurrence**, plus changes
inside the occurrence. `sourceTempoId` identifies the effective preceding written tempo point;
the initial written score requires a tempo at zero. At equal entry/explicit tempo position,
emit one effective tempo point. Never carry the repeat-end BPM back into an unmarked opening.

`performedSounds[]` is a complete expansion, not a second arrangement. IDs are stable by written
sound ID + attack occurrence ID (e.g. `m4@o1`); `occurrenceIds` includes all contiguous bars spanned
by a held sound. One sound/tie chain causes one attack, not one per notation segment or bar.
Source `tieChainId`/refs preserve tie provenance; `NotationSegment.eventId` points to one merged
sound. Segments encode exact duration plus base, dots, tuplet group/ratio/index and tie status.
The fixture's triplet has three `2/3`-quarter segments; its cross-bar `m4` is one `[3,5)` sound.
Notation segments must exactly tile the corresponding sound/rest without gap/overlap, lie in
their bar, and preserve spelling/voice. Adapters can split further losslessly but cannot retrigger.

**Jump policy:** reject any sound/tie continuing across a noncontiguous repeat jump. Do not
truncate or carry it by accident; request a supported source interpretation. Ordinary contiguous
barline ties work. A source tie entering a repeat beginning also requires explicit resolution
if any repeated pass would become an orphan continuation.

Actual-song literal form oracle (technical facts, not a committed score):

```
1–7, 5–7, 8–19, 17–19, 20–46, 43–46, 43–46, 43–46
= 64 occurrences = 256 quarters
```

Inherited tempo counterexample: three 4/4 bars, BPM 80 at bar 1, repeat bars 2–3 twice, BPM 120
at bar 3. Visits `[1,2,3,2,3]` have `[80,80,120,80,120]`, total **13s**. Carrying 120 back gives
**12s** and fails. At PPQ960 the restore occurs at tick **11520**. The actual requested song marks
its repeat entries, so alone it would not expose this bug.

Score, cursor, seeks, role playback and MIDI consume these same occurrence/sound IDs.
Engraving folds supported linear repeats when every pass has identical notation, fingering,
tie state and relative effective tempos. It prints written bars with repeat barlines and total
pass counts. Every performed segment retains a mapping to its printed beat, including later passes.
If passes differ, engraving stays unfolded and explains why. An explicit unfolded adapter option
also supports diagnostics and full-performance export oracles. Unfolded bars retain written-bar
and pass labels. The transport always identifies the current written bar and performed pass.
Native repeat instructions are engraving only. Never feed the expanded canonical timeline
through the renderer's repeat player. Audio and MIDI use the canonical performed timeline directly.

## Plans, results, approvals and exports

`Plan` only references source-grounded bass/harmony candidates, octave shifts and density.
It cannot authorize melody changes. Source-derived/user-confirmed `ChordSpan` can be explicitly
unknown. Generated provenance still references supporting source events; changes record before/
after pitch/duration for bass register moves, omissions and shortened accompaniment. Approved
bass cannot be silently dropped to fit harmony: return `reapproval-needed` with diagnostics.

Planner provenance is either an actual `configured-llm` call (provider/model/call timestamp and
response digest/accepted IDs), or **`deterministic fallback`**, with explicit reason. No configured
provider, timeout, invalid response, refusal, or disabled planning does not become an AI claim.
Provider credentials never enter these models.

`ArrangeResult` distinguishes `candidate`, `invalid-candidate`, `search-exhausted`, `unsupported`,
`selection-needed`, `invalid-input`, `reapproval-needed`, and `proven-unsatisfiable`. Only exhaustive
finite-domain search with recorded proof may claim the latter. Beam search failure is not proof.
Engine counts `budget.maxStates`; worker's outer `maxElapsedMs` may abort into `search-exhausted`,
never proven unsatisfiable. Candidate is not a validated or exportable success.

Approval stages are `sourceReady → melodyApproved → bassApproved → arrangementApproved`.
Validate upstream scope records and full locks at each step. Dependency invalidation:

| New revision change | Retained musical approvals | Always invalidated |
|---|---|---|
| source/selection/melody/transposition | none | bass/harmony, validation, artifacts, human review |
| bass | melody, if unchanged scope | bass/harmony, validation, artifacts, human review |
| harmony | melody + bass, if unchanged scopes | harmony, validation, artifacts, human review |
| difficulty/profile/tuning/capo/tempo | unchanged musical scopes may be carried explicitly | physical validation/fingering as needed, artifacts, human review |

No carry-forward is automatic merely because a digest was copied. Settings edits must revalidate
the full score and cannot carry incompatible locks. V1 only supports standard tuning; accepting
an alternate tuning requires a supported future schema/profile, not unchecked array values.

`validatedDraft` wraps the score and a passed `ValidationReport` tied to both source and score
references. It is **not** a persisted magical trusted token. Export endpoints must load the
current head and source, verify digests, rerun the independent validator, then project/export.
Validation envelopes forged by a client or a schema test have no authority. A `sourceReady`
score with pending musician reviews can download as **unreviewed draft** after hard checks pass.
The musical-review gate still blocks a final playable-release claim, not these draft downloads.

`AdapterProjection` is JSON-safe: one engraved staff+TAB guitar part; stable
event/segment/occurrence → native beat/note IDs (one-to-many ties and passes); separate role
tracks/channels 0/1/2, all zero-based acoustic program 24. Only the role-separated projection
sounds. Muting filters by role without duplicating/truncating another role or losing cursor IDs.
Renderer-native classes, layout engines and audio nodes never enter persisted documents.
The version-1 projection describes unfolded engraving. A distinct version-2 projection describes
folded repeats and the occurrences represented by each printed bar. Neither changes `ScoreV1`.
Artifact `notationSegmentCount` counts logical performed segment mappings, not unique printed glyphs.

U02 implementation `9217c32d36bd22f04a6fc505271b24fcb5d8e6ab` reports a bounded 24-occurrence
original export proof; independent judge is pending at this freeze. Its documented alphaTab
mapping is `staff.capo=c`, `transpositionPitch=0`, `displayTranspositionPitch=-12` (canonical
written-octave offset remains +12). Do not add another capo shift. The separate
`tools/export-proof` fixture/constraints should be consumed by U12; no cherry-pick or renderer
adoption occurred in U03.

Export returns bytes, MIME/filename and `ArtifactManifest`: exact revision/source/profile and
adapter versions, artifact hash/length, expected occurrence/attack/notation counts, capo/tuning,
validation version and reviewed/unreviewed label. PDF bytes must really engrave staff + TAB;
MIDI must equal the complete performed role union. Independent artifact checking, page sizing,
font embedding, balanced note-offs and rounding tolerances remain U02/U12 gates.

## Signature examples

These are integration sketches, **not implemented behavior**. Types are exported by `ports.ts`:

```ts
const imported = await sourceAdapter.import({kind: 'songsterr-url', url});
if (imported.status !== 'source-ready') return imported;
const planned = await optionalPlanner.plan(imported.source, request, signal);
const result = engine.arrange(imported.source, request, planned.plan, planned.provenance);
if (result.status !== 'candidate') return result;
const report = validator.validate(imported.source, result.score, {approvedRevisions});
// API verifies current head + both digests and independently reruns validation.
// A parsed report supplied by the browser must never be accepted as authority.
if (report.status === 'passed') {
  const draft = ValidatedScoreV1Schema.parse({
    status: 'validatedDraft', score: result.score, validation: report,
  });
  const {bytes, manifest} = await scoreAdapter.exportArtifact(imported.source, draft, 'pdf');
}
```

Transport can use multipart for `ImportInput.bytes`, and binary download for `Artifact.bytes`;
these local port values are intentionally not persisted JSON. API export responses instead carry
a same-origin download path and parsed manifest. Shared `LocalDownloadPathSchema` requires a
root-relative path and rejects `//` authority references, every backslash and C0/C1 control
character. Where the application origin is available, use
`resolveLocalDownloadUrl(downloadPath, location.origin)` to normalize with the URL parser and
verify the final HTTP(S) origin before navigation/fetch. Do not decode/reinterpret the returned
path as another URL or use an off-origin redirect to circumvent this boundary.
Source import/score/store/export requests must
be runtime parsed at their boundaries; UI workers share these schemas, not parallel note models.

Concrete request construction once the source and explicit selection are available:

```ts
const request = ArrangementRequestSchema.parse({
  sourceRevision: {id: source.revision.id, digest: source.revision.digest},
  selection, // MelodySelectionSchema: complete explicit event IDs/rests, not a track ID
  preferences: {
    difficulty: 'intermediate', ability: {id: profile.id, version: profile.version},
    capo: {mode: 'recommend', compare: [0, 2]},
    transposition: {mode: 'preserve', semitones: 0},
    tempoScale: 1, bassDensity: 'sparse', harmonyDensity: 'sparse',
  },
  ability: profile, maxPhysicalFret: 12, locks: [],
  budget: {maxStates: 10000, maxElapsedMs: 5000},
});
const proposal = await api.arrange(request.sourceRevision, request, signal);
// For proposal.status === 'candidate', saved is its API-stamped ScoreV1:
// API allocated the project/revision header and computed its digest first.
const firstSave = await api.commit(saved.projectId, {
  kind: 'create', expectedHead: null, replacement: saved,
});
if (firstSave.status !== 'saved') return firstSave; // Existing head is a conflict, never overwrite.
// For approve/edit, API stamps a NEW replacement, parentId = firstSave.revision.id,
// then commit uses expectedHead: firstSave.revision (nonnull). See typed schema-only
// first-create -> approve -> edit example in tests/fixtures/boundaries.test.ts.
// After independent validation of the saved current head:
const download = await api.exportArtifact({
  projectId: saved.projectId,
  expectedHead: {id: saved.revision.id, digest: saved.revision.digest},
  format: 'midi',
}, signal);
if (download.status === 'ready') {
  // downloadPath is same-origin; label using manifest.review, not approval assumptions.
  return resolveLocalDownloadUrl(download.downloadPath, location.origin).href;
}
// stale-revision or validation-failed must never return old cached bytes as success.
```

## Verification and known gaps

Run `bun install --frozen-lockfile`, then `bun run check`. Build produces a **domain library**,
not a React app. The harness ran before logic; its absent result is preserved in
[`docs/evidence/foundation.baseline.json`](evidence/foundation.baseline.json).

The complete two-bar original source/score fixture covers independent roles, repeated pitch,
quarter triplets, rest and cross-bar sustain. The separate expected melody intervals and physical/
capo/form/tempo negative controls are literals, not adapter-generated expectations. Fixture
artifact `original-raw.json` is original project-authored data, not Songsterr content.

This is a deliberate narrow dependency refinement approved by the parent: U03 contract and
foundational checks do not depend on renderer selection and run alongside isolated U02. Full
F1 eight-bar and F2 sixteen-bar export fixtures, importer/engine/validator behavior, playback,
revision-store implementation and live full-song acceptance remain **named pending gates** in
`literal-oracles.ts`, not fake passing tests. Public song facts/opening assertions are seeds for
a future optional live runner, not evidence of acquisition, audition or complete melody selection.
The fixture's `sourceReady`/uncalibrated/pending review is intentional. No release gate G1–G11
passes merely because the foundation builds.

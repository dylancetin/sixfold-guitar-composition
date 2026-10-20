# U11/U12 integration API

Browser imports **only** `src/adapters/index.ts`; Node imports `src/adapters/server.ts`.
No domain/schema changes. alphaTab 1.8.4 is private to the notation adapter; no
native object, audio node or renderer serialization belongs in persisted JSON.

```ts
import { createAlphaTabScore, createPlaybackController } from '../../adapters';
const notation = createAlphaTabScore(score, { title: 'My arrangement', barsPerRow: 2 });
const { projection } = notation; // contract AdapterProjection, JSON-safe
const layout = await notation.renderSvg(750, abortSignal);
// Place each fragment.svg at its x/y within layout.width × layout.height.
// SVG glyphs use font-family alphaTab. Supply Bravura via @font-face (see below).
// layout.beats gives nativeBeatId, occurrenceId, bounds, cursorX for cursor overlays.
// projection.mapping joins eventId/segmentId/occurrenceId to those stable beat IDs.

const audio = createPlaybackController(score);
const unsubscribe = audio.subscribe(snapshot => { /* set React state */ });
// Directly in a click handler (not after a fetch):
await audio.play(); // creates/resumes AudioContext, synthetic plucked triangle tone
audio.pause();     // preserve position; cancel ALL current and queued sources
audio.stop();      // cancel and return to zero
audio.seek(4);     // quarters on the one unfolded performance; resumes held notes
audio.setTempoScale(0.75); // absolute multiplier of canonical BPM, not compounded
audio.setMuted('bass', true);
audio.setSolo('melody', true); // multiple solo roles supported, mute wins
audio.setLoop({ startQuarter: 0, endQuarter: 8 }); // half-open, >=100ms
audio.setLoop(null);
const metrics = audio.getMetrics(); // planned/actual audio times, late/skip/cancel counts
await audio.dispose(); // on score revision replacement/unmount
unsubscribe();
```

`prepareFromGesture()` can explicitly unlock audio before Play. Read
`getSnapshot().readiness`, `audioState`, `state`, `error` rather than claiming
readiness after loading notation. `activeSegments` includes silent rest segments;
`activePerformedSoundIds` preserves tie identity across bars; `audiblePerformedSoundIds`
filters role mute/solo only while playing. Snapshot quarter/seconds derive from
AudioContext time, not timer ticks. A suspended tab pauses/cancels; it requires a
new gesture to resume. Replace the controller whenever the revision changes.

This is honestly **synthetic plucked audio**, not a recorded acoustic guitar or
alphaTab soundfont. Do NOT start alphaTab playback alongside it: there is one
combined engraving part and only canonical role audio. Role gain nodes allow
single-guitar mute/solo without duplicate combined-track playback.

Font bundling (Vite supports the `?url` asset import):

```ts
import bravuraUrl from '@coderline/alphatab/font/Bravura.woff2?url';
// @font-face { font-family: alphaTab; src: url(<bravuraUrl>); }
// Await document.fonts.load('34px alphaTab') before measuring UI screenshots.
```

Retain/distribute alphaTab's MPL-2.0 notice and Bravura OFL notice. SVGs explicitly
materialize font family/size; PDF embeds the installed pinned Bravura OTF.
`bun run probe:adapters` copies both notices into its artifact directory; application
packaging should include those notices with the renderer and font assets.

## Server export

```ts
import { createScoreAdapter } from '../../adapters/server';
const adapter = createScoreAdapter({
  validator, // REQUIRED real independent Validator; no built-in passing fallback
  getValidationContext: async (source, score) => ({
    approvedRevisions: await loadApprovedFullRevisionsFromTrustedStore(score),
  }),
  assertCurrentRevision: async (scoreRef, sourceRef) => {
    // Compare BOTH id and digest with the trusted current head/source; throw on drift.
  },
  pdfPageSize: 'A4', // or LETTER
});
const projection = await adapter.project(validatedDraft);
const artifact = await adapter.exportArtifact(source, validatedDraft, 'pdf', signal);
// artifact.bytes are actual binary; manifest binds digest/version/counts/settings.
```

Exports runtime-parse snapshots, recompute both revision digests, verify source
manifest/identity and loaded approval digests, then call the injected validator
**for every request**. The supplied validation envelope is ignored, never trusted.
Representability checks run independently after validation. The optional current
head hook runs before and after rendering; an API omitting it MUST do equivalent
checks itself. Adapter cannot independently discover the current store head.
No artifact cache or endpoint/persistence implementation is included.
Signals are checked before/after validation/rendering and between PDF systems.
Heavy synchronous native rendering is not preemptible JavaScript; the UI's worker
or API job runner must terminate its worker for a hard wall-clock cancellation.

`AdapterError.code` distinguishes `revision-stale`, `validation-failed`,
`unsupported-construct`, and `artifact-mismatch`; parsing/abort errors also reject.
No unsupported timing is rounded to fit. Native notation is PPQ960, so e.g. a
seventh tuplet fails explicitly. MIDI is SMF1 conductor + roles on channels 0/1/2,
program 24, already-sounding pitches, exact note ticks, integer-microsecond tempo
flooring. Same-role overlapping unisons cannot be independently released on the
one required role channel and are explicitly unsupported for MIDI.

`notationSegmentCount` counts **performed** mapped notation segments, including
ties/rests/passes, not just the written segment array. PDF packs whole systems
with one global scale on A4/Letter, refuses oversized units, embeds Bravura and
checks complete coverage. Native duplicate capo effect captions are disabled;
the single subtitle and page header explicitly identify capo-relative frets.

Validation and musical review are separate. A hard-valid but pending arrangement
exports with `unreviewed-draft` in filename, manifest and PDF. Browser projection
is visualization, not proof of feasibility/approval or download authority.
The `musically-reviewed` label additionally requires an accepted, objection-free
review at matching ability/tempo and a trusted loaded reviewed revision with
identical content (excluding revision/review/approval headers). A copied review
record on changed musical or physical content cannot upgrade the label.

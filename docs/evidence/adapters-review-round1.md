# Independent U11/U12 canonical-adapter review — round 1

## Verdict: NOT VERIFIED — one concrete integration blocker

**Do not integrate `043b1fc216cd46c9bf3998b022150783df0b89a4` yet.** A valid canonical revision at non-unit tempo scale is exported and played at the wrong tempo. This is a correctness failure in the adapter unit, not pending human audition or a request for additional architecture.

- Reviewed checkout: `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-cf255def`, clean at the exact requested commit before/after review.
- Root ownership was transferred during review. Root remains clean and unchanged at `4d410ef83a7117f6ed2b488f84acdd73b3972c71`; no cherry-pick, root edits, TSV/TODO promotion, or integration/review commit was made because the pass condition failed.
- All reviewer-created files are under `/tmp/opencode/guitar-adapters-review-r1*`.
- No subagents, source/engine/UI/schema edits, or unrelated proof regeneration.
- This is an original-fixture canonical adapter audit only. It does not approve full-song s692866 selection/arrangement, source-engine-UI wiring, or product acceptance.

## Blocker B1 — P1: effective canonical BPM is multiplied by tempoScale again

**Status: NOT VERIFIED. Reproduced through the real injected independent validator and actual MIDI/PDF bytes.**

Locations in the reviewed adapter commit:

- `src/adapters/timeline.ts:108–110`: `createTempoClock` multiplies `performedTempos[].quarterBpm` by the preference/runtime scale.
- `src/adapters/midi.ts:29–32`: SMF tempo repeats that multiplication.
- `src/adapters/alpha-tab.ts:98–100`: native engraving tempo repeats that multiplication.
- `src/adapters/playback.ts:27,185–187`: initial and changed audio clocks inherit the same mistaken baseline.
- `tests/adapters/adapters.test.ts:125–130`: the existing non-unit-scale test changes the preference but leaves performed tempos at unscaled 80 BPM; its fixture-only oracle accepts a revision the real validator rejects. It therefore does not test the actual canonical boundary.

The canonical contract calls occurrence entry BPM **effective** (`docs/CONTRACT.md:175–179`). The real independent validator reconstructs entry/performed BPM as written BPM × preference scale (`src/engine/validator.ts:148–160` in the engine checkout); the form implementation agrees (`src/engine/form.ts:79–86`). The adapter must consume that materialized effective map, not apply the preference twice.

Focused reproduction:

```sh
bun /tmp/opencode/guitar-adapters-review-r1/tempo-repro.ts
```

Input is the complete original 8-quarter study, written 80 BPM, preference scale 0.5, occurrence entry BPM 40, and both performed tempo points 40. Both digests are recomputed. `independent-guitar-validator-1` returns `passed`, with only the explicitly allowed uncalibrated-transition warning. `createScoreAdapter.exportArtifact` reruns that actual validator successfully.

| Measurement | Required | Actual |
|---|---:|---:|
| MIDI tempo | 40 BPM | **20 BPM** |
| MIDI duration | 12 s | **24 s** |
| Initial WebAudio canonical clock duration | 12 s | **24 s** |
| Actual PDF metronome captions | 40 | **20**, at both occurrences |
| Runtime absolute scale changed to 0.75 | 60 BPM / 8 s | **30 BPM / 16 s** |

Evidence in `/tmp/opencode/guitar-adapters-review-r1/`:

- `tempo-repro.ts`, `tempo-repro.json`: small reproducible boundary test and parsed results.
- `tempo-source.json`, `tempo-score.json`: exact immutable input snapshots.
- `tempo-wrong.mid`, `tempo-wrong.pdf`: actual wrong binary exports, not mocked summaries. Tone MIDI parses the MIDI; PDF.js extracts the `= 20` glyph/text captions from the PDF.
- `effective-tempo-case.json`: independently reproduced duration failure in the broader review harness.

### Minimal correction required before re-review

1. Consume effective `performedTempos` directly for MIDI and initial native notation/audio tempo.
2. Preserve the documented absolute runtime tempo control: when the requested playback scale changes, apply **requested scale / revision preference scale** to the revision's effective tempo map, not requested scale alone. Maintain the current quarter position and cancellation behavior.
3. Replace/add the non-unit-scale regression using a revision accepted by the real validator. Cover initial scale 0.5 (40 BPM / 12 seconds), change to 0.75 (60 BPM / 8 seconds), PDF captions, MIDI tempo/duration, and repeat-entry restoration. Keep note ticks/pitches unchanged. Update the API/evidence wording to reflect the effective canonical baseline.

No schema rewrite, second timing model, new validator fallback, or unrelated feature is required.

## VERIFIED — bounded notation, exact MIDI union, and actual PDF rendering

I read `docs/evidence/adapters-api.md`, `adapters-review.md`, the production modules, tests, probe scripts, and actual artifact directory. The production adapter does not import the U02 proof tool or test fixture code.

Reopened the existing artifacts under `/tmp/opencode/guitar-adapters-u11-u12/` without replacing them:

- Both source/score revision digests verify. Each `source-raw.json` byte count and SHA-256 matches its source manifest; its parsed parts/bars/tempos/form/events exactly equal the source snapshot. The +2-semitone variant is explicitly newly authored, not falsely attributed to old source bytes.
- All six actual export bytes match their manifest SHA-256/length and source/score references.
- Both capo revisions also pass the real independent validator at scale 1. Sounding pitches stay identical at capo 0 and 2; relative frets differ by two. No MIDI capo offset is added.
- Parsed both MIDIs using the actual-byte oracle: complete exact role/pitch/on/off union, 108 attacks (60 melody / 24 bass / 24 harmony), PPQ960, balanced pairs, programs 24 on channels 0/1/2, all track ends and final off at 92,160 ticks, 72 seconds. Tone MIDI is a second parser, **not a second-player audition**.
- Parsed/raster-checked all 18 existing PDF pages: A4 4 and Letter 5 per capo; all 24 occurrence/pass labels, 12 complete systems, embedded Bravura, actual noteheads/durations and TAB string/fret coordinates, final coverage, and raster staff/TAB visibility pass.
- Direct visual inspection: capo-0 A4 page 1, capo-0 Letter page 3, capo-2 A4 page 4, capo-2 Letter page 5, and the browser notation screenshot. Clefs, triplet brackets, separate sustained bass/harmony durations, the cross-bar tie/TAB continuation, and the final double barline are visible. Sparse Letter last-page packing is cosmetic, not clipping.
- Read and exercised the non-fixture-specific exact eighth-triplet/overlapping-harmony regression. Separate native lanes preserve independent durations; mapping covers rests and tied performed IDs. Native timing/pitch assertions reject inexact timing rather than rounding. These are bounded tested constructs, not a universal claim about every possible canonical input.
- Native engraving is one combined staff+TAB part; projection is explicitly unfolded with no native repeats; browser audio is only the canonical role-separated performed-note union. There is no second combined audio track.

### VERIFIED — eight actual corruption controls

Reopened all eight existing negative files and reproduced their relevant failures:

1. Missing final PDF system → complete-system coverage failure.
2. Fontless PDF → missing actual music glyphs.
3. Clipped final TAB PDF → raster line visibility failure, despite retained operators.
4. Capo-0 captions over capo-2 frets → actual reconstructed TAB sequence mismatch.
5. Missing final bass MIDI pair → exact complete union mismatch.
6. MIDI octave shift → exact pitch union mismatch.
7. Unmatched MIDI note-off → pairing failure.
8. Stale repeat-entry tempo → exact tempo-map failure.

Also inspected the freshly rasterized clipped final negative (`negative-clipped-final.png` in the reviewer directory): the final TAB is actually missing, unlike the complete positive final pages.

## VERIFIED — actual validator/export boundary, not the supplied passing envelope

Used the real `guitarValidator`, not just `oracleValidator`, from the engine checkout `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-2e0bc3f7`. Its code was unchanged during the broad harness run; SHA-256 of `src/engine/validator.ts` was `d1cc9dc2915855640863351eee34458db456195b4de7cc7a60aaff0969cf8154`. The checkout was subsequently observed clean at `50a0d68895ce02b943bf49e5da29c05a29b852c3`; engine integration itself remains a separate task.

Verified through `createScoreAdapter.exportArtifact`:

- Fresh actual validation is invoked on each request. A missing/forged client validation envelope is not authorization.
- A re-stamped revision omitting the held melody performance is rejected by actual validation despite a copied passing client report.
- No validator configured → export rejects; there is no production passing fallback.
- Source-ready, hard-valid, pending-human-review draft with empty approval context exports as `unreviewed-draft` in manifest and filename. This is useful and correctly permitted.
- Melody-approved score without its trusted full approved revision fails with actual `approval-stale` diagnostics, surfaced by the adapter as `validation-failed`.
- Supplying the correct full approved revision permits that same draft. Corrupt loaded approval digest and stale source/score content reject.
- A test-only accepted musical-review record plus identical trusted reviewed content can produce `musically-reviewed`; omit that reviewed revision, or copy the record onto changed fingering, and the label stays `unreviewed-draft`. No human approval is claimed by this synthetic test.
- Existing focused tests additionally reproduce stale report references, changed head during export (two hook calls), unsupported exact timing, wrong capo, and abort rejection.

The optional current-head hook is explicitly an integration responsibility; no claim is made that the adapter can discover the authoritative store head itself or replace API delivery/CAS checks.

## VERIFIED — browser safety, audio controls, and measured DSP boundaries

The browser barrel imports neither server export module nor Node dependencies. A fresh browser-target bundle succeeded (83 modules, 2.27 MB); inspection found no `node:`, Node `require`, PDFKit, or SVG-to-PDFKit imports. Browser code builds and runs in actual Chromium.

I inspected the actual saved `browser-audio.json`, probe implementation and schedule records, not just the prose claim:

- Chromium 156.0.8078.4; no recorded page/probe errors.
- 2,402 cursor samples over 60.049705 audio seconds, 25 completed loops.
- Saved metrics: 183 scheduled sources, zero missed notes, zero maximum scheduling lateness, bounded 10 scheduled keys at capture. No duplicate cycle/event/expected-time schedule keys.
- Peak DSP RMS 0.106430; muted-bass RMS 0; excluded-harmony RMS 0; solo-melody RMS 0.052198; pause RMS and active source count 0.
- Cursor calculation uses AudioContext time, not interval accumulation. The extremely small saved drift number is internal clock/formula consistency, **not an independent physical output-latency measurement**.

Reproduced the key DSP/control boundaries in a short fresh Chromium run, without rerunning an unnecessary full 60-second recording:

```sh
LD_LIBRARY_PATH=/tmp/opencode/hece-browser-libs/usr/lib64:/tmp/opencode/dernek-document-preview-deps/usr/lib64 \
  bun /tmp/opencode/guitar-adapters-review-r1/browser-short.ts
```

- Real button click unlocks audio. Each initial role has nonzero DSP RMS (~0.056).
- Bass mute produces actual bass samples of zero while melody/harmony continue.
- Melody solo produces actual bass/harmony samples of zero while melody remains nonzero (~0.0499).
- Pause freezes quarter position and produces zero samples; stop returns to zero and produces zero samples.
- Seek into the tied sustain resumes the held event, with nonzero melody/bass DSP and no fake tie reattack in the canonical projection.
- AudioContext suspension pauses/cancels, preserves position, and resumes from a new gesture/play action. Analyser data remains the previous buffer while suspended; it is not new physical output or proof of continued sound.

Saved actual 2,048-sample buffers per phase and role in `browser-short-samples.json`; computed RMS and plotted/visually inspected `browser-short-waveforms.png`. Waveform traces show the changing union and flat pause/stop phases. These are actual short DSP sample windows, not a fabricated waveform or a full audible recording.

Deterministic additional controls reproduce unavailable-audio error/readiness, suspension cancellation, held-note loop clipping, dispose rejection, and a deliberately delayed scheduler: missed-note metrics increase but cursor position still follows elapsed audio time. Existing tests reproduce pending gesture resume followed by stop, tempo-preserved quarter, half-open loops, and end seek.

**INCONCLUSIVE / explicitly not claimed:** human listening, speaker/microphone latency, subjective guitar quality, second-player MIDI audition, and guitarist musical/playability approval. The original long-run evidence contains scalar DSP measurements and scheduling records, not raw 60-second waveform samples. These limitations do not block a valid honestly labeled draft; B1 does.

## Commands/results and handoff

Executed in the exact adapter checkout, with build output redirected under `/tmp`:

- `bun run test:adapters`: **13 pass / 0 fail / 99 assertions**.
- `bun run typecheck:adapters`: pass.
- `bun run typecheck`: pass.
- `bun run test`: **32 pass / 11 TODO / 0 fail / 302 assertions**.
- `bun run test:controls`: all 16 expectations matched.
- `bun build src/adapters/index.ts --target=browser --outdir=/tmp/opencode/guitar-adapters-review-r1/browser-build`: pass.
- `bun /tmp/opencode/guitar-adapters-review-r1/review-checks.ts`: 13 review groups verified; **effective canonical tempo group failed**. Full per-group details are saved in `checks.json`. The harness intentionally records all results; its successful process exit is not a claim that every group passed.
- Short Chromium DSP probe: pass; samples and measurements saved.
- Focused real-validator tempo reproduction: confirms wrong audio/MIDI/PDF tempo.

Combined **post-integration root** checks were not run, because no integration was performed. U04 check coverage/package/lock/scripts were not touched. Existing U02 proof artifacts were not regenerated.

**Handoff:** fix B1 only, then rerun the focused real-validator non-unit-tempo tests plus normal adapter checks. Do not mark U11/U12 full-song/UI delivery complete. No additional blocker was established by this bounded review.

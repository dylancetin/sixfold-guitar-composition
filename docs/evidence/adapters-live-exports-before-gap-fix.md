# Actual-song adapter integration smoke — blocked, not release approved

## Outcome

The actual `independent-guitar-validator-1` accepts all three provided unchanged
ScoreV1 drafts, with only the disclosed `transition-unverified` warning. The
adapter then rejects both actual-song capo-2 and capo-0 PDF/MIDI exports before
producing bytes. Recommendation chooses capo 2 and hits the same first failure.

**No full-song PDF/MIDI artifacts were produced.** Consequently independent
exported-event comparison, PDF all-page parsing/raster review and optional native
browser render are blocked, not passed or substituted with another score.

The failure is an **adapter-generated silent gap**, not a legitimate engine note
or source tuplet that needs changing. No musical data, fingerprints, tempos,
notation, placements or revision stamps were altered to make export pass. No
passing validator stub, test-only oracle or bypassed export gate was used.

## Inputs and actual validation

- Adapter baseline: `043b1fc216cd46c9bf3998b022150783df0b89a4`.
- Latest post-tempo-fix rerun: **`6f1f455e11c30a90ab983626b631e261c39c0745`**,
  completed 2026-10-20T21:58:28.637Z. Source and all three candidate file hashes
  are unchanged from the baseline. All five export attempts hit the identical
  first timing failures after actual validation passes again.
- Engine checkout at `50a0d68895ce02b943bf49e5da29c05a29b852c3`.
- Real validator imported from
  `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-2e0bc3f7/src/engine/index.ts`.
- Source:
  `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7364a0c1/tests/source/.local/live/source.json`.
- Direct candidate ScoreV1 JSONs (not result wrappers):
  `/tmp/opencode/engine-live-0.json`, `engine-live-2.json`, `engine-live-recommend.json`.
- Source song/revision 692866 / 847990; 46 written bars, 64 occurrences,
  256 quarters; all candidates have preference tempo scale **1**.
- Drafts remain `sourceReady`, pending musician review, with empty trusted
  `approvedRevisions` context. Provisional identities are experiment inputs, not
  an authoritative saved project/head or approved release.
- `createScoreAdapter` recomputes digests/source identity and reruns the actual
  validator for every attempted download. Initial precheck also used that real
  validator. All those reports passed; native exact-timing check then rejected.

The baseline `generation-before-tempo-fix.json` contains exact input file hashes,
source/score references, actual reports/call counts and error stacks. It was
preserved before the separately authorized tempo-only correction.

| Candidate | Canonical attacks | First native timing rejection |
|---|---:|---|
| capo 2 | 361 | beat 35, occurrence o5, written bar 5/pass 1 |
| capo 0 | 354 | beat 36, occurrence o5, written bar 5/pass 1 |
| recommend (selected capo 2) | 361 | beat 35, same occurrence |

## Exact minimal failure

At occurrence `o5`, written `bar-5`, pass 1, performed start **16 quarters**:

1. Canonical bass sound **`b5`**, segment **`n21`**, performed **`b5@o5`**,
   starts at **16** and lasts **3/2** quarters.
   Its note is sounding **MIDI 47 (B2)**, written **59 (B3)**. The canonical
   dotted-quarter segment is correct and native playback lasts **1,440 ticks**.
2. Provenance source ID **`p8:b5:v0:bt0:n0`**, source part 8/voice `p8:v0`,
   source sounding **MIDI 35 (B1)**, source start **16**, duration **3/2**.
   The engine explicitly disclosed its +12 bass-register adaptation to MIDI 47;
   the experiment did not add or change that adaptation.
3. Placement is string index **1** (open tuning 45): capo 2/relative fret 0,
   or capo 0/relative fret 2, both sounding 47 and physical fret 2.
4. The adapter pads the remaining bass voice silence **[35/2,20)**, duration
   **5/2 quarters = 2,400 ticks** at PPQ960. This is adapter-generated silence:
   no canonical sound, source event or notation-segment ID belongs to this rest.
5. `rhythmCandidates()/gap()` choose native base denominator **2**, **dots 3**,
   **tuplet 3:2**. Rationally `(4/2)*(15/8)*(2/3)=5/2`, but pinned alphaTab 1.8.4
   applies only `dots===1` or `dots===2`; **three dots are ignored**.
6. Actual native rest start is **16,800 ticks**; duration **1,280**, not **2,400**.
   It would finish at 18,080 rather than 19,200: short by **1,120 ticks (7/6 q)**.
   `buildNative` correctly fails its exact-timing guard rather than silently export
   corrupted engraving. The MIDI path is blocked too because the exporter checks
   both engraving and MIDI representability before producing either artifact.

The next canonical bass note is `b7`, at written/performed **20**, duration **3/2**,
sounding MIDI 47, source ID `p8:b6:v0:bt0:n0`. It is unchanged.

Exact source events, placements, notation, neighboring native beats and expected
positions: **`minimal-failures.json`**. An observation-only prototype wrapper
captured the finished native model in a temporary process. It did not edit any
repository/dependency file or actual candidate.

Standalone two-beat original native reproduction:

```sh
node /tmp/opencode/guitar-live-exports/minimal-native.mjs
```

Result `minimal-native.json` independently reproduces the 1,280-vs-2,400 duration
using no actual-song data. Native implementation reference:
`node_modules/@coderline/alphatab/dist/alphaTab.core.mjs:7494–7501`.

This is the boundary to correct separately after the tempo gate/review: avoid
unsupported three-dot generated rhythms and decompose gaps losslessly using
representable durations. No such correction or musical workaround was made in
this smoke experiment.

## Reproduction and evidence files

```sh
bun /tmp/opencode/guitar-live-exports/generate.ts
bun /tmp/opencode/guitar-live-exports/diagnose.ts
node /tmp/opencode/guitar-live-exports/minimal-native.mjs
```

All local evidence is under `/tmp/opencode/guitar-live-exports/`:

- `generation-before-tempo-fix.json`: preserved baseline 043b1fc export attempts.
- `generation.json`: latest exact-head attempts (see header for commit).
- `capo-2/initial-validation.json`, `capo-0/initial-validation.json`,
  `capo-recommend/initial-validation.json`: real validator reports.
- `capo-2/failure.json`, `capo-0/failure.json`, `capo-recommend/failure.json`.
- `minimal-failures.json`, `minimal-native.json` and temporary scripts above.
- No `full-song.mid`, `full-song.pdf`, PDF rasters or browser screenshot exists
  because the validated export boundary rejected before generating files.

## Separate authorized tempo-only correction

The review's independent P1 tempo double-scale correction is a separate outcome;
it does not explain or resolve this actual-song gap because these candidates use
scale 1. Narrow correction, real-validator regression, real binary artifacts and
real Chromium signal measurement are under:

`/tmp/opencode/guitar-adapters-tempo-fix/after/`

Narrow fix commit: **`6f1f455e11c30a90ab983626b631e261c39c0745`**, directly above
`043b1fc`. Actual real-validator PDF/MIDI plus initial audio now give **40 BPM /
12 seconds**, runtime absolute scale 0.75 gives **60 BPM / 8 seconds**; repeat
restoration `[40,60,40,60]` gives 20 seconds, with unchanged note ticks/pitches.
The old preference-only scaled fixture is independently rejected as invalid.
The new regression fails before the production correction and passes afterwards.

Real Chromium 156.0.8078.4 / 44,100 Hz probe confirms nonzero DSP at both speeds,
preserved quarter position, 1.599274 seconds of runtime audio clock equals
1.599274 quarters at 60 BPM, and pause RMS 0. This is signal/clock consistency,
not hardware or human audition.

- `/tmp/opencode/guitar-adapters-tempo-fix/before/result.json`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/result.json`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/constant-80-at-half/score.mid`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/constant-80-at-half/score.pdf`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/repeat-entry-restoration/score.mid`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/repeat-entry-restoration/score.pdf`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/browser-tempo.json`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/browser-tempo.png`

No root integration, source/engine/UI edits or public full-song fixture occurred.
Only the separately authorized tempo correction and regression were committed;
the actual-song three-dot gap-rest blocker remains unmodified for coordination.

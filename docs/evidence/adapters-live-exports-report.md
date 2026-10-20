# Actual-song adapter exports — local draft-fidelity checks passed

## Current final outcome — 2026-10-20T22:33:10Z

**Gap fix: `ee367928997e7df1011f018b13d14dd3ddf21c3d`**, directly above the
preserved tempo fix `6f1f455e11c30a90ab983626b631e261c39c0745`. Final generation
ran from that clean exact commit; working-diff SHA-256 is the empty hash
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Both unchanged actual-song capo drafts now export through `createScoreAdapter`
with the **actual `independent-guitar-validator-1`** and empty trusted approval
context. No validator stub, altered canonical input, rest-time quantization or
representability bypass. Source and all three candidate file fingerprints are
identical to `generation-before-gap-fix.json`.

The only new production correction is generated silence: candidates exclude
unsupported dots=3 and prefer ordinary rests. The original failing 5/2 gap becomes
half + eighth, **1,920 + 480 = 2,400 exact ticks**. Canonical note mappings, sound
attacks, times, pitches, placements and notation are unchanged. Adapter version
is `canonical-guitar-1.0.1`. No other production engraving fix was needed.

### Actual artifacts

All paths below are under **`/tmp/opencode/guitar-live-exports/`**:

| File | Bytes | SHA-256 |
|---|---:|---|
| `capo-0/full-song.mid` | 5621 | `46f90c60871867344fe62f6bdac09102eb4bccdc85324b86be45be1eaf201d96` |
| `capo-0/full-song.pdf` (A4) | 80185 | `97f53d30f70dd2938d3ac1c9052a69877101c94b54a3c10fb3fbbbf69b14e558` |
| `capo-0/full-song-letter.pdf` | 80094 | `ad3662064aab882cae9f4dd8218a2e13e42d749fc57a211b0ccc82d0e8601fcd` |
| `capo-2/full-song.mid` | 5691 | `c704cc754aaea01856fa27e32c1debafc4a16892ebd683cf66edea1f45245328` |
| `capo-2/full-song.pdf` (A4) | 80380 | `0e77f13f36cd1f93fff5a2d575cc5f10b3c6f6898f4d1f2bac023bc00b5585e1` |
| `capo-2/full-song-letter.pdf` | 80285 | `7ce375b251be1595b9ac6a0ce8ce1aa7f6a6b075c2c617a2b2622f419971945e` |

The recommendation draft's `capo-recommend/full-song.mid` also passes, 5,691 bytes,
SHA-256 `237486776b194b483409b61358df8542623fa444e1451359897812e4297a447d`.
Every artifact has its matching parsed manifest, exact revision/source bindings,
real validation version, hash/length and unreviewed-draft status.

### Independent actual-byte checks

`check.ts` imports no adapter/exporter or engine/form implementation. It reopens
actual bytes, independently computes expected canonical intervals/tempos and checks
the literal 64-occurrence requested-song form. **`verification.json`: passed.**

- Capo 0: **354 attacks = 245 melody + 58 bass + 51 harmony**.
- Capo 2: **361 attacks = 245 melody + 58 bass + 58 harmony**.
- `midi-file` and Tone MIDI independently equal every role/pitch/on/off tick;
  complete 245-note melody union is identical between capos. Acoustic program 24
  on channels 0/1/2; balanced pairs; exact 64 effective tempo entries independently
  checked against source-written position. No capo shift or double repeat.
- Last note-off **244,800 ticks / quarter 255**; every track ends at **245,760 /
  quarter 256**, preserving final silence. Integer-microsecond tempo integration:
  **171.738858 s** to last off; **172.405524 s** to performance end.
- **44 PDF pages** parsed and raster-checked: A4 and Letter, 11 pages each per capo.
  Every PDF has all 32 complete combined systems, all 64 original-bar/pass labels,
  all effective tempo captions, embedded Bravura and final o64/S46/P4 double barline.
- Exact PDF glyph operators reconstruct every staff head's spelled guitar octave:
  **365 note placements at capo 0**, **373 at capo 2**, per PDF. Actual printed TAB
  fret/string/tie sequences equal canonical placements: **361** and **369** printed
  frets respectively. Four same-bar tied continuations omit redundant TAB digits
  by convention, but all staff heads/ties remain required; incoming barline ties
  print parenthesized frets. No note is dropped from canonical audio/MIDI.
- Sampled raster staff/TAB line coverage **100%**. Direct visual inspection of
  pages **1/6/11** for both sizes and both capos found readable notation, ordinary
  gap rests, tuplets, cross-system ties and intact final bars, with no clipping.

Raster paths are `capo-{0,2}/rasters/page-{01..11}.png` (A4) and
`capo-{0,2}/letter-rasters/page-{01..11}.png` (Letter). Per-file inspection JSONs
are `midi-inspection.json`, `pdf-inspection.json`, `pdf-letter-inspection.json`.

Checker corrections were measurement fixes, not changes to the music: PDF.js
text items can merge heads at distinct heights, so individual showText/CTM glyph
coordinates are used; Letter-scale ledger lines are excluded from long five-line
staff detection; same-bar tied TAB digit omission is tested explicitly. No extra
production defect was found. All actual staff heads and MIDI intervals are checked.

### Original gap and preserved tempo regressions

- `tests/adapters/gap.test.ts` fails on the pre-fix adapter (beat 6), and after fix
  requires the literal 1,440-tick bass followed by 1,920 + 480 ticks of rest, all
  mappings/performed sounds preserved and input byte-for-byte unchanged.
- `/tmp/opencode/guitar-adapters-gap-fix/original-gap/` contains the new original
  fixture, actual real-validator report, injected binary exports and native/MIDI
  observations proving old **1,280** versus new **2,400** rest ticks. Actual Chromium
  156 renders it with 11 mappings / 9 sounds / one complete staff+TAB system.
- Real-validator tempo gate rerun after gap fix remains passed at
  `/tmp/opencode/guitar-adapters-gap-fix/tempo-regression/result.json`: effective
  40 BPM / 12 s, absolute runtime 0.75 → 60 BPM / 8 s, correct PDF captions, repeat
  restoration `[40,60,40,60]` and unchanged tick/pitch union.
- Original-repeat proof rerun in its own directory preserves all 18 PDF page
  checks and eight corrupted-file rejections:
  `/tmp/opencode/guitar-adapters-gap-fix/original-repeat-proof/verification.json`.
- Final fast checks: 14 adapter tests / 112 assertions; typechecks passed;
  foundation 32 pass / 11 TODO; all 16 controls matched; frozen install and browser
  bundle passed. No changed dependencies, new canonical timing model or schema.

### Reproduce / review scope

```sh
bun /tmp/opencode/guitar-live-exports/generate.ts
bun /tmp/opencode/guitar-live-exports/check.ts
bun test tests/adapters/gap.test.ts
ADAPTERS_VALIDATOR_MODULE=/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-2e0bc3f7/src/engine/index.ts \
  bun run test:adapters:tempo /tmp/opencode/guitar-adapters-gap-fix/tempo-regression
```

Fresh independent judging is still required. These are draft artifact-fidelity
checks, not self-approved complete release or musician acceptance. Candidates
remain provisional identities, sourceReady, unapproved selection/musical review,
uncalibrated transitions; second-player MIDI/human audition remains separate.
No root integration, source/engine/UI edits, app model connection or create button.
Chat agents generate scores; adapters serve the viewer/player/download boundary.
No actual-song score/fixture/image has been committed to Git or uploaded publicly.

---

## Historical failure record below (superseded by the successful correction above)

This retained section describes 043b1fc/6f1f455 **before** the gap fix, not current
file existence or current export status. The unchanged complete historical report
is also preserved as `report-before-gap-fix.md`. Old per-capo errors are now named
`failure-before-gap-fix.json`; `generation-before-gap-fix.json` records that gate.

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

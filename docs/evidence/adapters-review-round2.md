# Independent canonical-adapter review — round 2

## Verdict: VERIFIED — adapter + actual-artifact scope

The integration set `043b1fc216cd46c9bf3998b022150783df0b89a4` + `6f1f455e11c30a90ab983626b631e261c39c0745` + `ee367928997e7df1011f018b13d14dd3ddf21c3d` passes this fresh independent review. **No remaining adapter integration blocker was found.** This supersedes the round-one tempo blocker and the subsequent full-song generated-gap blocker, not their historical failure records.

Root/worktrees were read-only until the parent explicitly transferred sole root ownership. The worker checkout remained clean at exact `ee367928`. After verification, the authorized ordered picks landed above `d2a00d3c09635189df5f90f8181c0354104d7181` as:

- `043b1fc` → `39dcceb8355e2d875c5442d2744c9377c1b276a9`
- `6f1f455` → `3a6fabf5dde4481435f9d299d224225ae278e7bb`
- `ee367928` → `665d98d750852daaaf1a6d5d09b17790a31dc413`

Only `package.json` conflicted: the resolution retained the existing source hook, fixture+engine test selection and engine build, adding the adapter scripts/dependencies. The lockfile applied unchanged from the worker. Root aggregate additions retain every prior check and add adapter typecheck, tests, real-validator effective-tempo regression and browser build. No workflow/agent typecheck or implementation was invented or integrated. A02 remains NOT VERIFIED separately.

## B1 corrected — effective BPM, runtime ratio, actual bytes

Inspected the entire correction diff and reran `test:adapters:tempo` with the actual `independent-guitar-validator-1`, not `oracleValidator` or a passing stub. The real validator rejects the old preference-only scaled fixture and accepts the corrected effective-tempo revision.

| Boundary | Required and freshly observed |
|---|---|
| Written 80, revision scale 0.5, effective map 40 | MIDI 40 BPM / 12 s; initial canonical audio 12 s |
| Actual PDF metronome captions | `[40, 40]` |
| Runtime absolute scale 0.75 | requested/revision ratio 1.5; 60 BPM / 8 s; quarter preserved |
| Repeat restoration | actual MIDI/PDF `[40, 60, 40, 60]`; 20 s; runtime 40/3 s |
| Notes | complete exact role/pitch/on/off union preserved; no capo or tempo tick shift |

Reran the same gate in the integrated root against its integrated real validator. A fresh Chromium 156.0.8078.4 probe on the integrated browser bundle also observed duration 12 → 8 s, unchanged quarter at the change, nonzero DSP RMS at both speeds, 0.8010884353741498 seconds = 0.8010884353741498 quarters at 60 BPM, and pause RMS 0. These are actual signal/audio-clock observations, not physical output-latency measurements or human audition.

Evidence: `/tmp/opencode/guitar-adapters-review-r2/tempo/`, root aggregate's real-validator result at `/tmp/opencode/guitar-adapters-effective-tempo/result.json`, and `root-browser/browser.json` under the round-two directory. The original wrong 20 BPM / 24 s artifacts remain in `/tmp/opencode/guitar-adapters-review-r1/`.

## B2 corrected — actual old versus new 5/2-quarter generated silence

Loaded the actual pre-gap adapter from `git archive 6f1f455` into reviewer temporary storage, without changing a worktree or dependency. On the same real-validator-approved original gap fixture, the old adapter fails its exact-timing guard at beat 6. Observation of the finished native model gives:

- Note: start 0, duration **1,440 ticks**.
- Old synthetic rest: start 1,440, dots=3, duration **1,280 ticks**, not 2,400.
- Corrected native rests: `[1440,3360)` **1,920** + `[3360,3840)` **480** = **2,400 ticks**.

The committed literal regression, actual independent validation, actual PDF/MIDI export, unchanged input serialization, 11 canonical mappings, 9 performed sounds and Chromium rendering all pass. New generated candidates exclude unsupported third dots and prefer ordinary rests; the exact native guard remains. No canonical note, source, placement, duration or notation was rewritten to evade it. Adapter version is `canonical-guitar-1.0.1`.

Evidence: round-two `independent.json`, `original-gap/observation.json`, actual original-fixture binaries, and `browser.json`. Historical full-song rejection metadata remains in `/tmp/opencode/guitar-live-exports/generation-before-gap-fix.json` and `report-before-gap-fix.md`.

## Actual s692866 — independently reopened, regenerated, and checked

Source identity is Songsterr **692866 / revision 847990**. Recomputed source/score digests and file SHA-256 checks pass. Source and all provided candidate files are unchanged from the failed-gap run. Both inspected drafts are intermediate, standard EADGBE, transpose 0, capo 0/2; approval context is empty and the only real-validator diagnostic is the disclosed nonblocking `transition-unverified` warning.

The independent reviewer script unfolds selected SOURCE events using a literal 64-occurrence written-bar order, source event pitch/start/held duration and rational-to-integer ticks. Its source melody oracle does not import adapter timeline, engine form or native expected values. All **245 exported melody attacks and exact holds** equal that source-derived oracle at each capo. This proves fidelity to the explicit, still-unapproved source selection, not a human decision that this is the best melody interpretation.

Reopened all supplied bytes; separately exported all seven artifacts through the real validator into reviewer storage; then repeated generation and all-byte checking through the integrated root adapter and root validator. Fresh capo MIDI bytes equal the originals exactly. A forged client passing envelope cannot replace the fresh validator: a restamped missing-melody performance is rejected with `validation-failed` at both capos.

### MIDI

- Capo 0: **354 = 245 melody + 58 bass + 51 harmony** attacks.
- Capo 2: **361 = 245 melody + 58 bass + 58 harmony** attacks.
- `midi-file` and Tone MIDI independently parse every exact role/pitch/on/off interval; balanced pairs; programs 24 on channels 0/1/2; no capo double shift or repeat doubling.
- All **64 tempo entries** also equal source-written-position reconstruction, independently of candidate/native tempo assertions.
- Last off **244,800 ticks / quarter 255**; all four track ends **245,760 / quarter 256**, retaining final silence.
- Integer-microsecond MIDI tempo integration: last off **171.738858 s**, performance end **172.405524 s**. The engine's ideal nonrounded BPM duration is different by the expected SMF microsecond quantization; note ticks are unchanged.

### Native model and PDFs

The reviewer independently observed all native note/rest beats: contiguous **3,840-tick coverage in every lane of every occurrence**, exact notation-segment start/duration, exact sounding/written guitar octave, string and capo-relative fret. All **387/395** canonical mappings are present. The adapter's private native expected-duration arrays are not the oracle. Native master bars have no repeats.

The actual-byte checker imports no adapter/exporter/engine/form implementation. I read its expected-value construction before rerunning it; expected staff/TAB values come from canonical notation/spelling/placements, with geometry reconstructed from actual PDF operators, not exporter metadata.

- **44 pages** freshly parsed and raster-checked: A4/Letter × capo 0/2 × 11 pages.
- Each PDF: **32 complete systems**, all **64 original-bar/pass labels**, all effective tempo captions, embedded Bravura, exact revision/capo/unreviewed-draft captions.
- Actual staff glyph coordinates match **365/373 note placements** per capo; printed TAB fret/string/tie sequences match **361/369**. Four same-bar tied continuations omit redundant TAB digits by alphaTab convention; staff heads remain checked. Bar-entry ties print parenthesized frets.
- Sampled staff/TAB raster line visibility is **100%** across all 44 pages; complete final occurrence/system is present.
- **Direct visual inspection:** pages **1/6/11 of all four PDFs**, twelve images in total. Clefs, ordinary generated rests, tuplets, separate voice durations, cross-system ties, capo-relative frets and the final **o64/S46/P4 FINAL** double barline are visible, without clipping. This review did not substitute text extraction for those views.

### Browser

Fresh browser-target module build contains no Node/server PDF dependencies. Actual Chromium renders both complete 64-occurrence scores: **32 systems each**, all 354/361 audio projection events and 387/395 mappings. The original gap fixture also renders. No page/probe errors. Inspected first/last full-score browser captures. The facade remains non-audio notation plus one role-separated canonical audio union, not simultaneous alphaTab combined playback.

Evidence under `/tmp/opencode/guitar-adapters-review-r2/`: `independent.ts/json`, `actual-byte-recheck/verification.json`, `generated/generation.json`, `root-generated/generation.json`, `root-generated/verification.json`, all-page rasters and local browser captures. Supplied exact artifact hashes remain in `/tmp/opencode/guitar-live-exports/report.md` and matching manifests. No actual-song score, binary or screenshot is committed to Git or uploaded publicly by this review.

## Checks, integration safeguards and honest limitations

Worker focused checks: **14 adapter tests / 112 assertions**, both typechecks, **32 foundation pass / 11 TODO**, all **16** oracle controls, and real-validator tempo integration pass.

Combined integrated-root `bun install --frozen-lockfile` and `bun run check` pass all **10** hooks: source **46 / 403 assertions**; foundation+engine **58 pass / 1 optional live skip / 11 existing TODO / 0 failures**; adapters **14 / 112**; both strict typechecks; actual-validator tempo/PDF/MIDI gate; domain, engine and adapter browser builds; 16 controls. The separately live-enabled engine test then passes **1 / 21 assertions**. U02's unchanged lightweight predicates pass **18 / 18**; its large artifacts and prior DSP loops were not needlessly regenerated. Source, engine, domain, their tests, contract, U02 and prior A02 review files remain unchanged. Package/lock/script checks and commit mapping are recorded separately in the integration evidence.

Reviewer-only tooling mistakes are disclosed, not product failures: the first redirected checker lacked output directories; the next ran a temporary global native-observation hook concurrently with another export. Creating the directories and isolating that hook fixed the reviewer harness. Two ancillary command-location mistakes (a nonexistent U02 `verify.mjs`, then the live test run from the U02 subdirectory) were corrected to the actual package `npm test` and root live-test invocation. The preservation checker initially demanded a full identical tempo-pick patch ID despite retained engine-script context in `package.json`; it now compares non-package patch IDs and separately asserts the exact additive package union. Gap-pick full patch identity and all final canonical adapter/lock contents match. All final positive claims use subsequent successful runs, not those failed exits.

The unchanged bounded artifacts, eight negative binaries and broader DSP controls were already independently reviewed in round one. Their relevant adapter tests still pass; this round focuses on both real corrections and the new full-song evidence rather than repeating the extensive unchanged loops.

**Still open:** human source-melody audition, second-player MIDI/human listening, subjective musical quality, guitarist physical/transition calibration, A02 publication acceptance, A03 website HTTP/deep-link/download wiring and A04 actual musician task. Pending human review does not block a hard-valid honestly labeled draft. No HTTP planner, new generation UI, schema or extra feature was added. No subagents were spawned.

**Handoff:** VERIFIED adapter + actual-artifact scope and authorized root integration only. The site remains the separately pending read-only viewer/player/PDF+MIDI-link boundary; CHAT subagents remain the generation workflow.

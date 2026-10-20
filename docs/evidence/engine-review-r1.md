# Independent U05/U07/U08/U09 engine review R1

**PASS / VERIFIED for bounded engine integration. No engine correction required.**
**Full-song PDF/MIDI/preview delivery and human musical/playability approval remain NOT VERIFIED.**
Independent same-model GPT-6.1 Sol judge, 2026-10-20; no additional subagents.
Read the authoritative contract, all engine implementations/tests and engine evidence;
inspected actual source/selection and full output documents, not just worker summaries.
Review was read-only until parent granted sole root integration ownership.

## Scope and actual independent results

Reviewed worker `bf6509e`, `3d8fe8a`, `50a0d68` in `t3-2e0bc3f7`.
Canonical source and complete proposed map were consumed directly from source worker
`t3-7364a0c1/tests/source/.local/live/{source.json,melody-proposal.json}`.
Song **692866**, upstream revision **847990**, format **5**, 11 parts;
source digest `853b28dbd5898318df37c0355dc256303ca598022e43e359d987f0315fd7149d`.
Checked `/tmp/opencode/engine-live-{0,2,recommend}.json`, regenerated all nine
difficulty/capo experiments, and repeated them from integrated root. Intermediate root
documents exactly match all three supplied complete output documents.

- Separate Python **Fraction** oracle imports no engine helpers. It uses literal
  visits `1–7,5–7,8–19,17–19,20–46,43–46,43–46,43–46` and source-derived exact
  intervals, not solver counts. Every **141 part-0 attack / 154 refs** is retained;
  disclosed proposed selection has **173 written → 245 performed melody attacks**.
  Every source ID, sounding pitch, rational onset and release matches in all nine runs.
- **46 written bars → 64 occurrences / 256 quarters / 172.4056795131845s**.
  Independently reconstructed entry restoration, tempo origins/source IDs and all
  effective BPMs match. Final sound releases at quarter **255**; selected silence,
  notation and form continue through **256**, with no truncated ending.
- Melody, source key and preserve-transposition are unchanged across all difficulties
  and capos. Key remains **unknown**, not B major. Intermediate recommendation is
  **capo 2**: **40/58 bass + 40/58 harmony** written/performed attacks; chosen capo 0
  has **40/58 bass + 37/51 harmony**. At recommendation: **six omissions, six shortened
  sustains, 40 bass and 40 harmony register-change audits**, all source-bound.
- Separate notation arithmetic proves sound/rest tiling, bar containment, exact
  sounding identity and tie continuity; every live onset/duration is exact at PPQ960.
  Independent half-open sweep proves full sustained string/finger occupancy, one whole
  contact per performed sound, every release/attack hand state, no barre, count/span
  limits, and `pitch = tuning + capo + relative fret` under both physical-fret maxima.

## Validator independence and negative controls

Production `validator.ts` never imports solver/search or `expandForm`; it reconstructs
source selection, form/tempo, performed events, notation, evidence, physical sweep and
full approval scopes. Engine's internal validation is not the sole acceptance evidence.
Judge mutation digests are restamped using an independent Node SHA-256/canonical-JSON
implementation, so failures cannot be attributed merely to old document hashes.

**All 13 judge mutations fail substantively:** coherent final melody removal (all related
graph records removed; **only melody-mismatch**); flattened repeats; missing repeat-entry
tempo; removed omissions; removed register audits; wrong capo; wrong source identity;
occupied held finger; later attack on a sustained string with both pitches still correct
(**only string-collision**); shortened contact; missing boundary state; absent referenced
approval; and modified full lock with copied digest. Real full approval context and exact
release/reuse pass. Capo 2 relative **10 / physical 12** passes max12, while relative
**11 / physical 13** fails with **only profile-limit**.

Supplied tests additionally exercise missing middle melody/tuplets, octave/sustain
changes, retriggered ties, stopped finger0, five stopped contacts, fresh-finger hand-speed
bypass, immutable bass carried into harmony and incompatible capo locks. The inherited
80/120-BPM repeat fixture is **13s, not 12s**, restores at tick **11520**, and its carried
tempo mutation fails production validation. Specified transitions re-finger the full
performed sequence, including repeat boundaries.

Finite empty mandatory pitch-domain proof checks all six strings; beam failure and
insufficient proof budget remain **search-exhausted**, never false impossibility.
`maxStates` is shared across compared capos. `maxElapsedMs` is an outer worker
responsibility, not a wall-clock guarantee implemented by this pure synchronous port.
API must still stamp authoritative identities and load authenticated full approval revisions.

## Heuristics and human caveats

Search ranks bass, then harmony by **1 + min(duration,4)/20 per written attack**, then
fretting cost. It favors retained attacks over continuous bass, uses the two lowest
feasible bass registers, and does not optimize bass-line intervals. Sparse planner
selects one structural source attack per bar, not the complete source accompaniment.
Intermediate capo 0 has two octave-sized bass leaps (max12 semitones), capo 2 none
(max8); both hold 59 written bass quarters. These are heuristic observations, not
musical objections or required new features. Recommendation uses bounded trials:
its capo-0 comparison has 36 harmony attacks versus 37 in a separate chosen-capo run.
No global optimum, B-major identification or subjective musical approval is claimed.

All profiles remain provisional/no-barre and movement uncalibrated, explicitly warning
`transition-unverified`. This does **not** block hard-validated unreviewed draft downloads.
Pending musician audition/selection approval, human movement calibration and final
playable-release approval are distinct from automated validator passes. Planner is
honestly deterministic fallback, not a configured LLM call.

## Adapter/export boundary — still NOT VERIFIED

At canonical adapter **043b1fc**, all three live scores pass `compileTimeline`;
original eight-bar engine output also passes native alphaTab projection. All three
live native projections nevertheless fail the adapter's exact-timing guard.

The valid **5/2-quarter silent bass gap** after bar5's dotted-quarter bass becomes an
adapter-generated triple-dotted half-note **3:2 tuplet rest**. alphaTab ignores those
dots: at tick **16800**, native duration **1280** differs from expected **2400**.
Capo0 fails native beat36; capo2/recommend fail beat35; all are bar index4/voice1.
Engine's preceding note is correctly `[16,35/2)`; that gap rest is not engine notation.
Fix adapter gap representation losslessly; do not quantize or alter engine melody.
The guard correctly rejects instead of silently exporting wrong timing.

This additional repro is separate from the adapter judge's parent-reported double
`tempoScale` application: **performedTempos already contain effective BPM**, as the
contract and engine require. Adapter correction/re-review remains separately assigned.
This review creates no full-song PDF/MIDI/preview or visual-verification claim.

## Reproduction and integration

```sh
ENGINE_LIVE_SOURCE=/path/source.json ENGINE_LIVE_SELECTION=/path/melody-proposal.json bun run check
bun docs/evidence/engine-review-probe.ts /path/live /tmp/opencode/engine-review
python docs/evidence/engine-review-oracle.py /path/live /tmp/opencode/engine-review
# Optional cross-check, reads an independently prepared adapter checkout:
bun docs/evidence/engine-review-probe.ts /path/live /tmp/opencode/engine-review /path/adapter-worktree
npm --prefix tools/export-proof test
```

Evidence: [root aggregate](engine-review-root-check.json),
[judge controls/nine root experiments](engine-review-probe.json),
[independent rational oracle](engine-review-oracle.json), and
[integration/patch identities](engine-review-integration.json).
Initial detailed report and native instrumentation remain at
`/tmp/opencode/guitar-engine-review-r1.md` and
`/tmp/opencode/guitar-engine-review-r1-adapter-debug.ts`.
One diagnostic oracle rerun initially globbed its own empty redirected output; selection
was corrected to explicit score filenames and rerun successfully. No music/oracle facts
or production code were altered to pass that checker correction.

| Worker | Root |
|---|---|
| `bf6509e` | `6796889` |
| `3d8fe8a` | `c1d6a2a` |
| `50a0d68` | `e4842bf` |

Ordered conflict-free cherry-picks from clean root `4d410ef`; stable patch IDs match.
Review/log/TODO/root-check edits are separate from the three implementation commits.
Root check preserves **46 source tests / 403 assertions**, adds strict engine/test/probe
typechecking and browser engine build, and runs **59 foundation+engine tests / 434
assertions / 11 existing TODO / 0 failures**, including all27 engine tests with live
inputs. Without those optional environment paths the live test explicitly skips.
All **18 lightweight U02 predicates** still pass; heavy proof artifacts were not regenerated.
Domain/contract, source code/tests, lockfile and U02 content are unchanged.
Raw source, complete candidate scores and melody proposal stay outside Git.

Bounded engine integration is accepted, not the complete product or G1–G11 release gates.
Full-song audition, UI, authoritative persistence, corrected adapters and independently
checked canonical PDF/MIDI/preview remain open.

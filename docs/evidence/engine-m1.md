# M1 focused role/register correction

## Captured baseline — before any gate or solver change

Own branch at `50a0d68`; engine/domain trees compare identical to root `95018b3`. No root writes, no author input writes, no new model call or musician-review claim.

Original tests deliberately red (`bun test tests/engine/register.test.ts`: 0 pass, 3 fail):

1. A literal statically valid held B3 bass above a later A3 inner tone is accepted by validator v1.
2. Original held F#4→G#4 lead / B foundation / A inner study chooses B3 (59), though B2 (47), A3 (57), F#4 (66) can all occupy distinct fret-2 strings.
3. Original melody-rest E→B bass study chooses `[40,59]`, adding an unnecessary octave to the source +7 motion despite an isolated, reachable B2.

`engine-m1-baseline.json` records a fresh run of the **unchanged full authored Plan** (159 candidates; raw SHA-256 `07e999ffdfa59e3507fdd125a505829e02b1ee082245d0843cc78f3d91f9f34b`) against the supplied canonical source/request, with reused original recorded planner provenance. Every input byte hash was rechecked unchanged. Baseline 0/2/compare all pass old validator, retain 92/146 bass and 67/99 harmony written/performed attacks, yet have 10 written bass/harmony crossings. Same-line inflated large bass leaps: 25 at capo 0, 22 at capo 2; statically lower-feasible isolated high bass: 5/3. Local baseline score snapshots are `/tmp/opencode/engine-m1-baseline-{0,2,compare}.json`, not committed.

Reproduction (paths are local copyrighted input references, not copied fixtures):

```sh
bun tests/engine/probe-register.ts \
  --run /home/taytay/.t3-nightly/worktrees/guitar-composition/t3-bfbeaaab/.agent-runs/8030f5fb-37d0-4247-8188-75949cfab2b9 \
  --plan /tmp/opencode/guitar-musician/plan.json \
  --output docs/evidence/engine-m1-baseline.json \
  --scores /tmp/opencode/engine-m1-baseline
```

## Minimal semantics proposed (no schema change)

For overlapping half-open sounding intervals, bass < inner harmony < protected melody, whenever those roles coexist. The independent validator must reconstruct this order, not accept solver flags. Existing crossing locks require explicit reapproval rather than silent alteration. Intentional inverted role labels are not representable as an exception in current V1; do not broaden the schema just for this song.

Retain source bass first; bass register and same-line source contour are musical preferences ahead of inner-tone density and fret convenience. Plan bass octaveShift is a preferred target, not an authorization to alter melody or force an impossible pitch. Necessary guitar-register folding remains allowed and audited. Held strings/fingers, exact boundaries, physical/profile and specified transition limits remain mandatory. Movement of current actual-song drafts remains uncalibrated.

## Separate independent gate

Validator version is now `independent-guitar-validator-2-role-order-v1`. It independently checks every exact overlapping ordered role pair from the score, with bar/event references and existing `unsatisfied` diagnostics prefixed `[role-order-v1]`; it does not import the generator predicate. Performed expansion is independently validated as before. No domain/schema changes. Old passed envelopes do not establish passage under the new validator version.

The generator's small shared role predicate also rejects conflicting **mandatory locked** roles before search with `reapproval-needed`. No implicit inversion exception or silent lock mutation exists in current V1.

At this gate-only boundary `bun test tests/engine/register.test.ts` reports **3 pass / 2 fail**, intentionally: the independently authored literal crossing is rejected, harmony-first attack is rejected, exact release boundary passes, and backed crossing snapshots still require reapproval. The two retained solver regressions remain red (the old crossing solver now returns `invalid-candidate` rather than laundering it; isolated high bass is still high). Explicit engine/tests/probe typecheck passes. This is the gate, not a claim the solver is fixed yet.

## Solver correction (separate from the gate)

The core change is deliberately small, with no source/song IDs or schema policy added:

- Check the shared generator role predicate against **every held sound at either attack**, not only simultaneous chord attacks or bass-vs-lead. This applies to the full performed re-fingering path too.
- Use `sourceMidi + explicitTransposition + 12*plan.octaveShift` as a **preferred** bass target. Fold to the nearest physically available, protected-melody-compatible source pitch class; retain fallback octave candidates. Filter melody conflicts **before** limiting the bass domain, so a high source keyboard note does not hide an attainable lower foundation. Never force an unavailable low E at capo 2 or a requested octave above melody.
- Rank retained source bass first, then source-oriented bass register/contour, then inner-tone density, then fretting convenience. The internal preference penalty is two units per octave away from the preferred legal target, plus one unit per octave of successive **same source part/voice** contour error. This is an explicit heuristic musical preference, not a physical or human-calibrated law.
- Keep the last source/realized bass in state and in the future-equivalence key even after release. It is no longer correct to merge two states with different bass histories just because active contacts happen to match.
- Register-generated provenance is now `register-sparse-2-role-order-v1`. Existing ordered locks remain unchanged; no regenerated provenance is substituted into a protected lock.

Original regression tests now also check source-plan target influence, safe fallback when its target would exceed the lead, necessary capo-2 E-register folding, reducing/shortening a held inner tone before sacrificing bass, and separately fingered harmony at/unison/above the lead. Nine focused tests pass (33 assertions). The held original fixes B3→B2 while retaining the A3 inner voice and both lead notes; the isolated breath fixes `[40,59]` to `[40,47]`. The reduction test correctly permits an audited early inner-voice release rather than demanding an unnecessary outright omission.

## Full unchanged authored Plan: before → after

`engine-m1-after.json` is a fresh full experiment with the same 159-candidate Plan, source, request, original call provenance and byte hashes. All inputs were checked unchanged again. **No bar-35 candidate was removed.** Every capo trial passes validator v2 and all static held-contact checks. Recommendation selects capo 0 based on source-oriented register/contour, not merely a low maximum fret.

| Measurement | Capo 0 before → after | Capo 2 before → after |
|---|---|---|
| Melody written / performed | 173 / 245 → identical | 173 / 245 → identical |
| Bass written / performed | 92 / 146 → unchanged | 92 / 146 → unchanged |
| Harmony written / performed | 67 / 99 → unchanged | 67 / 99 → unchanged |
| Crossed written / performed intervals | 10 / 16 → **0 / 0** | 10 / 16 → **0 / 0** |
| Crossed performed quarters | 11 → **0** | 11 → **0** |
| Bass leaps ≥12 semitones | 25 → **0** | 25 → **0** |
| Same-line enlarged octave-sized leaps | 25 → **0** | 22 → **0** |
| Isolated high bass with lower static position available | 5 → **0** | 3 → **0** |
| Sum absolute same-line source-contour error (semitones) | 396 → **0** | 396 → **96** |
| Bass MIDI range | 40–61 → **40–49** | 42–61 → **42–52** |
| Physical maximum fret | 7 → **9** | 9 → **9** |
| Stopped span maximum | 3 → **3** | 4 → **4** |
| Observed min-fret anchor travel proxy | 296 → **304** | 146 → **160** |
| Observed anchor max step / max frets-per-second proxy | 5 / 36 → unchanged | 4 / 9 → unchanged |
| Omissions | 0 → **0** | 0 → **0** |
| Register audit records | 146 → **146** | 146 → **146** |
| Shortened sustains | 1 → **1** | 1 → **1** |

Both remain at most three simultaneous sounds / three stopped contacts. The one bass shortening remains the source bar-35 B `[3/2 → 1]` quarter sustain; it is still explicit, not hidden to make the counts pass. **The low E3 harmony at bar 35 remains present and source-grounded**, exactly as requested for this root-fix experiment. The later author round may address M2 separately.

Exact performed melody, selected rests, written bars, repeats, 64 occurrences / 256 quarters, and every performed tempo digest match baseline, not just attack counts. Source spellings, merged sustains, tuplets and final event continue to pass independent source/selection tests. No melody pitch/key or timeline edit was used.

The final metadata also revalidates the **saved old complete score documents** under v2: each fails with exactly 10 `unsatisfied` role-order errors (not digest errors); each freshly generated score passes. No revision/hash-only mutation explains the gate's rejection. Source and Plan are not relabeled as a new model call.

Search counts: 6,283 states at chosen capo 0; 5,246 at chosen capo 2; 6,629 total for comparison, within the shared 10,000-state budget. No failure was called impossibility. This is still bounded search, not a proof of global musical/physical optimality.

### Remaining issues, explicitly not passed

- At capo 2 there are **eight same-line contour direction reversals**, totaling 96 semitones of absolute contour error, around the E-register folds in bars 7→8→9 and 19→20→21. E2 MIDI 40 is unavailable under capo 2, so this strategy uses E3; neighboring low bass preferences then create those remaining direction changes. The metadata lists all eight pairs. We do **not** claim no other joint voicing could reduce them.
- Capo 0 needs physical fret **9 rather than 7**, and the observed anchor-travel proxy increases by 8; capo 2's increases by 14. Those proxies include changes in the minimum occupied stopped fret, not measured hand trajectories or calibrated movement limits. All actual profile transitions remain `uncalibrated`; no human-playable-release claim follows from static validation or a lower bass.
- M2 low-register congestion, M3 expression/quiet-thumb balance, natural decay of long acoustic pedals, actual listening/guitarist acceptance and fresh PDF/MIDI/artifact review remain pending. The old static/audio/artifact judgments are not silently promoted to a new musical acceptance.
- Current V1 has no role-order override for a deliberately inverted approved snapshot. It returns explicit `reapproval-needed` / role-order diagnostics without editing locks; an identical reapproval alone does not bypass the invariant. Any future exception semantics need separate coordination, not an invisible schema expansion here.

## Final verification / handoff

- Full foundation + engine run with **both optional live tests enabled**: **69 pass, 11 pre-existing TODO, 0 fail**, 960 assertions. This includes all original failures, canonical source mutations, the full unchanged authored Plan at capo 0/2/compare, all retained 159 candidates, and independent baseline melody/rest/form digest comparisons.
- Explicit engine/tests/probe strict typecheck passes.
- Browser bundle succeeds with no Node/Bun imports in core (Bun I/O is only in local probes/tests).
- No domain, source, renderer, UI/server, root, canonical log, authored Plan/request/source, receipt, or prior publication writes. No subdelegation.

```sh
ENGINE_M1_RUN=/absolute/canonical/run ENGINE_M1_PLAN=/tmp/opencode/guitar-musician/plan.json \
ENGINE_LIVE_SOURCE=/absolute/canonical/run/source.json ENGINE_LIVE_SELECTION=/absolute/canonical/run/selection.json \
bun test tests/fixtures tests/engine

bun tests/engine/probe-register.ts \
  --run /home/taytay/.t3-nightly/worktrees/guitar-composition/t3-bfbeaaab/.agent-runs/8030f5fb-37d0-4247-8188-75949cfab2b9 \
  --plan /tmp/opencode/guitar-musician/plan.json \
  --output docs/evidence/engine-m1-after.json \
  --scores /tmp/opencode/engine-m1-fixed \
  --previous-scores /tmp/opencode/engine-m1-baseline
```

Final canonical candidates are local only: `/tmp/opencode/engine-m1-fixed-0.json`, `engine-m1-fixed-2.json`, `engine-m1-fixed-compare.json`. They have provisional engine identities and fresh digests; orchestration still stamps authoritative identities before persistence/publication. Earlier engine evidence files are historical pre-M1 observations, not passage under the new validator version. This correction is offered for the next independent musician round, not self-approved as musical acceptance.

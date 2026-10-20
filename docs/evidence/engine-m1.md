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

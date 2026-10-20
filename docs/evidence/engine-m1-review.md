# Independent engine review round 2 — M1 bass foundation

## Verdict and boundary

**VERIFIED for the M1 engine/independent-validator correction and root integration.** This is a fresh independent review, not the worker's self-approval or a new musician/model call. Root started clean at `648f5f2972bb3c9f227b24de506028871bb71405`; worker reviewed at `4199242f052382b4939d9fa7cbc30135d4a36593`. No subagents were used.

**A04 musical/full-product acceptance remains open.** M2's bar-35 E3/F#3 congestion is deliberately unchanged for an actual musician revision. Expression, natural bass decay, melody prominence, human audition and calibrated movement are not established by this review. These are not new approval prerequisites for downloading a hard-validated **unreviewed draft**. Website scope stays read-only playback/downloads.

## Preserve the earlier musical failure

The original bounded engine review (`engine-review-r1.md`) passed its then-existing static checks, not this subsequently discovered musical invariant. The independent actual-plan judge `/tmp/opencode/guitar-musician-review/REVIEW.md` found M1: role labels did not make the bass the actual lowest voice. The source had bass below harmony, but the realized accompaniment crossed **10 written / 16 performed intervals, over 11 performed quarters**. For example:

- Bar 8 source E1→B1 (+7) became E2→B3 (+19), with B3 (59) **above** A3 (57). Bar 9 and homologous 20/21 repeated the problem.
- Late source C#2 became C#4 (61) above E3 (52), changing the realized lowest tone/inversion; subsequent C#4→F#2 introduced −19 instead of source −7.
- The lone bar-42 B also became an unnecessary B3 fill.

Fresh pre-integration execution of the root v1 engine reproduced those actual scores exactly, including the saved `/tmp/opencode/engine-m1-baseline-{0,2,compare}.json` documents. All passed v1. The old authored plan/actual-call provenance was reused truthfully; no new authorship, receipt or approval was manufactured.

The literal original counterexamples also reproduced: held B3 above a later A3 passed v1; the solver selected B3 although B2/A3/F#4 have distinct fret-2 positions; isolated E→B in a melody breath became `[40,59]` rather than `[40,47]`.

## Corrected gate, independently tested

Validator **`independent-guitar-validator-2-role-order-v1`** checks exact half-open overlaps for **bass < inner harmony < melody**, including unisons and either attack order. Its pairwise implementation does not import the generator predicate. Separately verified complete performed expansion makes the written-overlap check apply to every occurrence, not just chord attacks.

- Literal bass-first and harmony-first held crossings now fail with only substantive `unsatisfied` / `[role-order-v1]` errors; exact release-before-attack reuse still passes. Harmony at/above melody with otherwise legal separate-string fingering also fails.
- All three saved complete v1 scores fail v2 with **exactly ten role-order errors**, not stale-digest failures. Every fresh fixed score passes.
- Backed crossing bass/harmony locks return **`reapproval-needed`**, leaving the request/lock bytes unchanged; supplying their authentic snapshots does not bypass the validator. Legal ordered locks remain exact, including original provenance, and pass with authoritative context.
- V1 has no deliberate-inversion override. Reapproving an identical crossing does not exempt it from this invariant; a future exception would require separate semantics. No schema or approval-UI expansion was introduced.

The solver applies symmetric ordering against all held roles, uses the plan's source-octave preference with legal register folding, and ranks retained source bass then register/contour ahead of inner density and fretting cost. Bass history is retained in the future-equivalence key. This is an explicit bounded heuristic, **not** a global optimality or human-ability proof. Necessary capo-2 E1→E3 folding remains available and audited; unavailable optional bass is an explicit omission, not an invented whole-score impossibility. A six-string empty mandatory-melody domain yields a finite proof, while insufficient proof budget, truncated search and impossible specified movement yield `search-exhausted`.

## Source and interval oracle — not count-only acceptance

`/tmp/opencode/guitar-engine-m1-review/oracle.py` is a new standalone Python `Fraction` checker with no production engine/domain/form imports. It reads actual source, original plan and all six freshly reproduced complete scores; it reconstructs source section intent, full literal 64-occurrence form, performed expansion, tempo entries, source pitch intervals and full-sustain physical occupancy.

- All **173 written / 245 performed melody attacks**, all **141 main-voice written notes**, 172 successive written intervals, exact pitches/spellings/onsets/releases, selected rests, bar-42 silence, ties, form and effective tempos remain unchanged. No key/melody edit was used.
- Every one of the **159 individual plan candidates** has its exact source-backed role/attack/pitch-class realization; all accompaniment source IDs **and durations** match before/after. Harmony retains the exact proposed octave. No drop-all-harmony, candidate substitution, omission or silent sustain change was used to clear M1.
- The independent release-before-attack sweep checks every performed pitch equation, held string/finger, contact, hand-state set and profile limit. Both corrected trials have at most three sounding / stopped contacts; no collision or barre.
- At capo 0 the bar-8 B is now **B2 (47), below A3 (57)**; E2→B2 is the source +7. Late C# becomes **C#3 (49), below E3 (52)**; bar-42 B becomes B2. Same-line source contour is exact throughout, not just fewer large-leap counts.

| Independent before → after | Capo 0 | Capo 2 |
| --- | --- | --- |
| Bass written/performed | 92/146 → unchanged | 92/146 → unchanged |
| Harmony written/performed | 67/99 → unchanged | 67/99 → unchanged |
| Crossed written/performed pairs | 10/16 → **0/0** | 10/16 → **0/0** |
| Crossed performed quarters | 11 → **0** | 11 → **0** |
| Written bass leaps ≥12 semitones | 25 → **0** | 25 → **0** |
| Sum absolute same-line contour error | 396 → **0** semitones | 396 → **96** semitones |
| Bass range | 40–61 → **40–49** | 42–61 → **42–52** |
| Maximum physical fret / stopped span | 7/3 → **9/3** | 9/4 → **9/4** |

Comparison still chooses **capo 0**, now with meaningful source-register evidence: zero register/contour penalty versus eight at capo 2, not merely a lower fret maximum. Both preserve sounding melody/key. Capo 2's unavailable low E requires E3 in this realization, leaving **eight same-line contour direction reversals** around bars 7→8→9 and 19→20→21. We do not claim that no alternative joint voicing could improve those. Capo 0's extra reach and increased anchor-travel proxy are real tradeoffs; all movement remains `uncalibrated`.

## Integration and compatibility correction

Only the three requested worker commits were cherry-picked, in order, with equal stable patch IDs and no conflicts:

| Worker | Root | Stable patch ID |
| --- | --- | --- |
| `2a2fc7a` | `88ec74b` | `a2e5277825a405e847fe4e95976dace702c01442` |
| `af4d8ba` | `7c97848` | `1341280b4fdaedb84e682d917b432091a44aa196` |
| `4199242` | `0f591c0` | `89c4358492c88caecc3c60a6000dc6a2964844e7` |

The **first root aggregate failed** solely because `tests/adapters/effective-tempo.ts:38` hard-coded validator v1 even though its actual fixture passed v2. Preserved log: `root-check.log`. Minimal test-only integration correction **`1f29779`** changes that assertion to the exact v2 ID and additionally requires both actual artifact manifests to carry it. It does not loosen timing/interval checks or change adapter code. Review evidence is committed separately from that correction and all implementation picks.

Frozen install, strict engine/test/probe typecheck, explicit agent typecheck/tests and the corrected root aggregate all pass. Both optional live tests were enabled: source-grounded legacy engine plus the unchanged authored plan at capo 0/2/compare.

- Focused foundation/engine: **69 pass, 11 pre-existing TODO, 0 fail; 960 assertions**.
- Root all-feature run: **149 pass, 11 TODO, 0 fail; 1,621 assertions**. Its tests overlap the separately run hooks; totals are not added together.
- All **13 existing foundation/source/engine/adapter/agent/publication hooks** pass, including the actual effective-tempo PDF/MIDI regression. Viewer/client/server typecheck, six boundary tests and client build also pass.
- `package.json`, lockfile, check aggregator, domain/schema, source, production adapters, agent/publication and viewer/server code are unchanged from `648f5f2`. Integrated engine/tests match worker `4199242` exactly. No reference/source/plan/request/receipt or old publication writes occurred; **58 protected original input/author files** retain their pre-review raw hashes.

## Actual core + canonical export smoke

Because fingerings changed, the integrated root CLI ran the real elapsed-time-bounded engine and local canonical adapter, using the **existing exact original plan and factual receipt**. It atomically installed only a reviewer-local draft under `/tmp/opencode/guitar-engine-m1-review/publications/arr-5e5937786c3001f9a8dc655e25e52062aacc0b45659125612c980ddaa7ec6690`. A separate capo-2 canonical adapter smoke also passed. No root `.arrangements` store or retained preview was created/switched. The supplied `https://engine-review.invalid` origin is explicitly construction-only: **no HTTP-tested user links are claimed**.

Independent actual-byte checks (`artifacts.ts` / `artifact-smoke.json`):

- Both PDF/MIDI manifests bind exact score/source/profile/capo/counts, canonical adapter `1.0.1`, **validator v2** and `unreviewed-draft`; published music differs from the independently reproduced comparison only in orchestration-stamped headers.
- Two MIDI parsers match **all 490 actual role/pitch/on/off intervals per capo** (245 melody + 146 bass + 99 harmony), all 64 effective tempo entries, balanced pairs and final tick 245760 / 172.405524 seconds. A paired-pitch MIDI corruption fails the oracle.
- The two A4 PDFs each have 11 pages and all 64 actual source-bar/pass labels. Targeted actual per-string fret/tie checks pass for systems containing **8–9, 29–30, 35–36 and 43–44**, checking the changed bass register and unchanged M2. This is not another unchanged 44-page A4/Letter geometry/raster audit, optical proof of every symbol, browser/UI review or listening claim.
- The canonical adapter rejects a formerly passed **v1 envelope** around the actual old crossing score when exporting under v2. The previous immutable v1 publication remains readable by the read-only store with its historical version intact; no relabeling or overwrite occurred.

## Reproduction and evidence integrity

Private/full-song source and generated outputs remain local, not committed. Reviewer scripts/results are in `/tmp/opencode/guitar-engine-m1-review/`; worker reproducer and focused original studies are integrated under `tests/engine/`. `reproduce.ts` captured the baseline while root was still `648f5f2` and the fixed worker was `4199242`; replaying its old-engine leg requires that historical root, not today's corrected root.

```sh
ENGINE_M1_RUN=/absolute/prepared/run ENGINE_M1_PLAN=/tmp/opencode/guitar-musician/plan.json \
ENGINE_LIVE_SOURCE=/absolute/prepared/run/source.json ENGINE_LIVE_SELECTION=/absolute/prepared/run/selection.json \
bun run check
python3 /tmp/opencode/guitar-engine-m1-review/oracle.py
bun /tmp/opencode/guitar-engine-m1-review/artifacts.ts
```

| Private evidence | SHA-256 |
| --- | --- |
| `reproduction.json` | `12055c5dcb0d6593c326b852a1720b8aa9d3a9b59e1544e7d413c146a4f753fd` |
| `oracle.json` | `9762bede231dff6d5663a38a602c70d14cd3e640db1d7f6736a714ded39a314f` |
| `artifact-smoke.json` | `2713e51f8e4e050332226674da3769f99b37c6b58280b310b85e730bee468b01` |
| Initial failed `root-check.log` | `ffb0ac6105490136d45fc1535043ee5479a1e2fdffaaea620a78db1f06e71829` |
| Corrected `root-check-corrected.log` | `5839d6216dfaf2beb31676a3656f600c6763f76dc2b633b27b52d17f93b436ae` |

Remaining acceptance: actual author M2 trial/source-specific musical review; honest phrase/balance/decay audition; final corrected-plan canonical publication and independent artifact check; Project Shelf final origin/store and exact HTTP viewer/PDF/MIDI testing; human audition/calibration for any final playable-release claim. This engine pass does not close those items or require arbitrary approval before draft downloads.

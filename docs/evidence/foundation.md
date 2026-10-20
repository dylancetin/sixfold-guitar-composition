# U03 — canonical contract and verification foundation

**VERIFIED: bounded foundation only. Independent contract review pending.**

Review follow-up: the independent review returned **NOT VERIFIED for integration** at the
original commit. See [`foundation.review-fix.md`](foundation.review-fix.md) for the two boundary
corrections and focused checks; fresh independent approval remains pending.

- Base: planning commit `25b1aea`.
- Worktree: `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7599a70e`.
- Branch: `t3/u03-contract-foundation`.
- Bun 1.4.2 (`744846f84`), Node v24.12.0, TypeScript 5.9.3, Zod 4.1.12,
  `@types/bun` 1.3.1; exact direct pins and committed `bun.lock`.
- Contract and actionable boundary examples: [`../CONTRACT.md`](../CONTRACT.md).
- Runtime source/types: `src/domain/{rational,revision,schemas,ports,index}.ts`.

## Narrow dependency refinement

The parent's implementation brief explicitly permits U03 contract/test work concurrently
with isolated U02: exact timing, source identity, selection, fingering state and immutable
revisions do not depend on renderer selection. This narrows the ordering in WORKFLOW U03;
it does **not** approve production renderer adoption before U02 review. U02's implementation
`9217c32d36bd22f04a6fc505271b24fcb5d8e6ab` was reported complete during this run. I read its
`docs/evidence/export-proof.md` constraints, recorded the native capo/octave mapping, and
did not cherry-pick it. The independent U02 judge was still in progress at this handoff.

Owned paths only. No app UI, importer, arrangement/physical-validator feature, renderer,
reference-project changes, retained server or delegation. Canonical `docs/decisions.tsv`,
WORKFLOW, TODO and BASELINE remain unchanged; integrator owns their updates.

## Baseline → demonstrated capabilities

Falsifiable hypothesis: a renderer-independent JSON V1 contract can represent exact
three-role music, explicit source melody, unfolded form, fingering and revision safety;
its runnable scaffold rejects malformed input and its literal test oracles distinguish
the required corruptions, without pretending to implement an arranger or product validator.

Before adding logic, created the check runner and ran:

```sh
node scripts/check-foundation.mjs > docs/evidence/foundation.baseline.json
```

Exit **1**, `status: absent`: no package/lock/tsconfig, domain, tests or contract. No old
passing test suite existed. New results cannot be interpreted as an improvement in song
arrangement quality; they demonstrate previously absent contract/check capabilities.

| Measurement | Evidence | Result |
|---|---|---|
| Original absence before logic | `foundation.baseline.json` | absent, exit 1 |
| First complete harness run | `foundation.initial.json` | 20 pass / 11 todo; typecheck + build pass |
| Later API-example type narrowing error | `foundation.typecheck-regression.json` | typecheck exit 2; 22 tests pass; corrected literal `format` with `as const`, not a weakened assertion |
| Final owned-worktree harness | `foundation.final.json` | all four commands exit 0; **23 pass, 11 todo, 0 fail**, 197 assertions |
| Fresh dependency install and same harness | `foundation.clean-install.log`, `foundation.clean.json` | 8 packages installed; same 23/11/0, all commands exit 0 |

Final build bundles a browser-targeted **domain library**, 76 modules / 138.92 KB, not an
application. Initial development also caught and corrected a spread-union typing issue
and the pinned Bun types' required callback for `test.todo`; pending callbacks now throw
if someone removes `.todo` without implementing the gate.

## Rerun

```sh
bun install --frozen-lockfile
node scripts/check-foundation.mjs
# Equivalent entry point: bun run check
```

The runner executes and captures full output/exit codes for `bun run typecheck`, `bun run test`,
`bun run test:controls`, `bun run build`. Its nonzero result propagates any failing command.
`test:controls` emits each literal mutation's expected/observed result; final JSON preserves
all 16 controls, including genuine negative outcomes (not merely a claim that tests exist).

Actual clean run used `/tmp/opencode/guitar-u03-clean.6aVcwe` with no copied `node_modules`.
Repeat from this worktree:

```sh
set -e
clean=$(mktemp -d /tmp/opencode/guitar-u03-clean.XXXXXX)
cp -R package.json bun.lock tsconfig.json src tests scripts docs "$clean/"
bun install --cwd "$clean" --frozen-lockfile
node "$clean/scripts/check-foundation.mjs"
```

No server starts. `git diff --check` passed. Dependency/build outputs remain ignored.

## Literal evidence and limits

`tests/fixtures/original-raw.json` is a newly authored two-bar study, SHA-256
`a0d288bc06bafd081bede759fa30f8bb30c65a69217b9cbb7cad08cb2064b044`, 752 bytes.
`original.ts` contains complete source and score documents with reproducible full-document
digests, selected monophonic melody/rest, bass/harmony, quarter triplets, repeated pitch,
cross-bar tie, required fingers, occurrence placements, held contacts and boundary hand states.
Its schema fixture is unapproved/uncalibrated, not a generated or physically certified score.

Literal negative oracles reject wrong pitch, +12 shift, missing middle/final/triplet event,
tie retrigger, sustain string/finger collision, five stopped contacts, excessive span,
and flattened/truncated form. Exact release/attack equality passes. Capo controls distinguish
relative zero/physical fret, 40/41 loss at capo 2, physical maximum 12, and MIDI 66 vs double
shifted 68. The independent tempo example produces **13s restored vs 12s carried**, restore
tick 11520 at PPQ960. Full identity hashing rejects an unchanged digest after capo/difficulty/
source/review/ID edits. These are **test-only oracle examples and domain-helper tests**;
they do not prove a production engine, validator, storage implementation or exporter.

Public requested-song facts (46 bars / 64 occurrences / 256 quarters, five tempo points,
bar-5 opening) are literal seeds for a future optional live runner. No live request,
copyrighted full-song fixture, source acquisition, audition or complete melody approval
is claimed. Full eight-bar F1/adapter integration, U02 fixture integration, source/engine/
physical validation, timed transitions, store/CAS/stale downloads, playback and full-song
acceptance remain 11 named pending gates. No product G1–G11 verdict changes.

## Parent/judge review needs

1. Review the frozen V1 schema/signatures and scope-based approval semantics. Pure validation
   takes API-loaded, digest-verified prior approval revisions as context; do not trust candidate
   lock snapshots or client-supplied validation envelopes.
2. Wire real source, form and independent physical validators in later units; graph completeness,
   selected melody coverage, approval authenticity and transitions are not structural schema checks.
3. Integrate the U02 proof after its independent review; native adapter objects stay private.
4. Resolve actual intro/outro event selectors, capo recommendation and profile calibration with
   the musician. Validated drafts may download before musical approval; no human-playability claim.

Candidate canonical-log rows are in `foundation.candidate-rows.tsv`; parent may append them
after review. This file does not claim to be the canonical log or independent judgment.

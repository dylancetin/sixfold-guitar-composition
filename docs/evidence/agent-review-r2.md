# Independent A02 workflow/publication review — R2 VERIFIED

Date: 2026-10-20. Reviewed commits: `4a039f301fbf76f45c255b7afaebeb32754d4ae1` + `fa60798622215e917445e217c7d9dac3dd3a8625`, from `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-bfbeaaab`. **VERIFIED for A02 infrastructure integration: no remaining blocker or regression found in this review.** This does not verify an actual musician receipt, song publication, full-song musical/artifact acceptance, viewer HTTP links, human approval, or a final release.

Fresh independent review; no subagents or implementation changes. This is a same-model independent review, not a cross-family audit. Both project checkouts were read-only for this reviewer. All test installation, generated outputs, probes and review files were written under `/tmp/opencode`. No cherry-pick, root integration, actual musician receipt, production publication, server launch or UI change was performed. Integration remains conditional on the parent's explicit grant and root-owner transfer.

## Narrow correction and findings

1. **R1's blocker is corrected, not hidden.** `src/agent/plan.ts:29–43` removes the candidate-equivalence comparison/helper, without replacing it with a novelty/quality rule. Exactly unchanged baseline choices and equivalent renamed choices now accept a correctly bound receipt; one density-token change has no special evidentiary meaning. Neither equality nor inequality establishes a model task or new composition.
2. **Existing boundaries remain.** Strict `PlanSchema`, unique candidate IDs, note-only existing source references, duplicate-reference rejection, strict delegation schema, exact raw-byte response SHA-256, source ID/digest and request-digest bindings all remain. `src/agent/publish.ts:23–32` still requires explicit `--baseline` or both plan and delegation; it never infers model involvement from a plan file. No schema/features/security gates were added or demanded.
3. **No-receipt model claims remain rejected.** Independent checks rejected undefined, null and empty receipts for each of exact baseline, renamed-equivalent and density-edited choices. Publication without delegation, without an explicit branch, or mixing baseline and plan also rejected. Explicit baseline publication retained `agent:null`, `deterministic-fallback`, and notes denying model-authored arrangement claims.
4. **Guidance is truthful about retained choices.** `AGENTS.md:15`, generated brief guidance, `docs/AGENT-WORKFLOW.md:49,66–68`, and `docs/WORKFLOW.md:75` permit source-reviewed/selected baseline, explicitly not newly composed material. Actual parent task attestation and independent inspection of real output/reasons remain separate from synthetic receipt acceptance. The older implementation evidence is clearly headed as historical initial behavior with the R1 correction linked; preserving its old rejected-guard description is not a current policy claim. New AGENTS user-flow instructions remain present.
5. **The production correction is bounded.** Relative to `4a039f3`, only `src/agent/plan.ts` and `src/agent/brief.ts` change production code. Prepare/publish orchestration, source/engine/validator, publication schema/store, CLI, package/lock/check hooks are unchanged by the fix. The original chat-only generation/read-only viewer boundary remains: no site creation, HTTP model transport or provider credentials.

## Independent old-failed / new-passed proof

Created committed-source snapshots with `git archive` under `/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/{old,new}`. Old production is `4a039f3`; new is `fa60798`. Copied the **same new regression test file** into the old snapshot, without changing either checkout. Test-file SHA-256 on both snapshots: `f0e00c0aaf14f81d28b2a11c70ade988005c9e846005925554e0b0bb12322a16`.

| Command/check | Independently observed result |
| --- | --- |
| New snapshot `bun install --frozen-lockfile` | Exit 0; 8 packages installed in scratch only |
| Old snapshot `bun test tests/agent --test-name-pattern 'baseline agreement accepts'` | **Exit 1: 0 pass / 1 fail**, specifically old `Baseline-equivalent choices cannot be relabeled AI-authored` exception |
| Same regression on new snapshot | **Exit 0: 1 pass / 4 assertions / 0 fail** |
| New `bunx tsc --project tests/agent/tsconfig.json` | Exit 0 |
| New `bun test tests/agent` | **14 pass / 78 assertions / 0 fail** |
| New `bun run check` | Exit 0; source **46 pass / 403 assertions**; fixture+engine **58 pass / 413 assertions / 1 live skip / 11 existing TODO / 0 fail**; all **16** literal controls; domain and engine browser builds |
| New `bun build src/publication/index.ts --target=browser --outdir=/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/publication-browser` | Exit 0; browser-safe publication schema builds |
| `bun /tmp/opencode/guitar-a02-independent-r2.ts` | Exit 0; **77 recorded boundary observations**, all expected outcomes; completed `2026-10-20T22:41:30.307Z` |
| Worker `git diff --check 8554002 fa60798` | Exit 0 |

The scratch aggregate is the worker's existing source/engine aggregate, **not** the newer root adapter aggregate and not yet agent aggregation. Agent tests/typecheck and publication-browser build were independently run explicitly. No skipped/TODO gate became a pass.

## Retained broad checks; no regression found

R1 recorded **63 observations**, not 63 independent product passes. R2 retains all **61 unaffected observation IDs**, replaces only the two equivalence/token observations with corrected expectations, and adds 14 observations (77 total). The original R1 script/output are unchanged. No previously passed source/engine/storage result was reopened merely to impose a musical-novelty demand.

The rerun covers canonical stamping before selection/request/baseline/brief; unchanged provider identity; source/request/selection/baseline/provenance corruption; unknown/rest/repeated source references; duplicate candidates; illegal octave/melody/extra fields; malformed/misbound receipt and whitespace-byte failures; actual worker success, real 1 ms elapsed-budget failure and in-flight cancellation; complete installation; exact prior-byte replay without adapter invocation; immutable metadata; physical corruption independently rejected after restamping; wrong manifest/source/capo/count/digest/adapter/validation/review/model metadata; unsafe IDs, unexpected files, partial directories and symlinks; interruption after five durable staging files before visibility; owned cleanup and prior-byte preservation; unknown-lock rejection/preservation; and preservation of a user-owned ignore file.

An additional end-to-end retained-baseline model-file branch ran the real engine/worker/validator and five-file store with a conspicuously **synthetic** bound receipt and **storage exporter doubles**. It preserved the exact baseline plan and synthetic task identity, stayed `unreviewed-draft`, and did not claim new composition. This is original technical-fixture boundary evidence, **not** actual musician attestation or real PDF/MIDI export evidence. The parent still owns the actual task receipt; this reviewer did not read, modify or attest the pending musician output.

## Evidence paths and preservation

- Test/probe command records, timestamps, exit codes, stdout/stderr and their hashes: `/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/` (`old-regression`, `new-regression`, `agent-typecheck`, `agent-suite`, `aggregate`, `browser-schema`, `independent-probe` prefixes).
- Machine comparison/summary: `/tmp/opencode/guitar-agent-review-r2-0rcwv0jd/verification-summary.json`.
- Probe: `/tmp/opencode/guitar-a02-independent-r2.ts`, SHA-256 `30a8b3350e951428642d6f4dcb492fa15575cc206342b711f678212247da6b8b`.
- Probe result: `/tmp/opencode/guitar-a02-independent-r2.json`, SHA-256 `a0ae47ee218246671be826ee012805434aa2b53b00966d5ad2c18a598cbfcab1`.
- Probe fixture root: `/tmp/opencode/guitar-a02-independent-r2-nvE4Xe` (not a user publication).
- Historical R1 probe/output hashes still match the preserved report: `9a35d5c24358cec3dc5d68e9cc795c5aa1e68ee17804b09485576bcbe8c72ea7` / `2c18b3d41f01167eb074cf8a26fb3fe35d55be67a81bc58e59cdaf6e98c665b4`.
- Root `docs/evidence/agent-review-r1.md` remains byte-identical to `d2a00d3`, SHA-256 `2ce9417b437a1a949910b62be7788951b439122d62dd9ebf77974c35bcab568a`. Original failure evidence is not rewritten as a pass.

Worker HEAD remained `fa60798622215e917445e217c7d9dac3dd3a8625`, clean. Root HEAD observed at start/finish: `665d98d750852daaaf1a6d5d09b17790a31dc413`; root acquired an uncommitted `scripts/check-foundation.mjs` change during the review, belonging to the active root owner, not this reviewer. It was only read and must not be overwritten or discarded. No root clean/integrated verdict is claimed.

## Conditional integration handoff

**Ready for parent grant; not integrated.** After the current adapter judge releases root ownership and the parent grants this unit, cherry-pick `4a039f3` then `fa60798`. Preserve the existing source/engine/adapter package scripts, dependencies, lockfile and all check hooks, including any newly completed root-owner work; do not replace root configuration with the older worker snapshot. Add agent/publication typecheck, tests and browser-safe build coverage to that aggregate, retaining all existing checks. Reconcile durable review/TODO/log entries by appending the R2 outcome without erasing `d2a00d3` or unrelated updates. Keep implementation integration and durable evidence in separate commits as requested, then rerun the complete integrated root checks.

Actual task/output inspection and the parent's factual musician receipt, actual-song publication/full-song artifacts (**A04**) and read-only viewer/browser/reachable HTTP verification (**A03**) remain separate. This verdict neither blocks honest hard-validated draft downloads on human review nor certifies human playability, audition/calibration, or G11 from synthetic tests. No UI was changed or visually verified.

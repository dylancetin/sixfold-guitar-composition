# Independent A02 workflow/publication review — NOT VERIFIED

Date: 2026-10-20. Reviewed implementation: `4a039f301fbf76f45c255b7afaebeb32754d4ae1`, clean checkout `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-bfbeaaab`, based directly on root `8554002`. No subagents, implementation edits, cherry-pick, publication of the pending musician output, or new production gates. This is a same-model independent review, not a cross-family audit. Root changes for this review are documentation/evidence only.

## Verdict and exact minimal correction

**NOT VERIFIED for integration: one blocker.** `src/agent/plan.ts:29–38` compares only the candidates' role/source IDs/octave/density, ignoring reasons and actual task evidence, and rejects every baseline-equivalent plan. `docs/AGENT-WORKFLOW.md:68` and `tests/agent/workflow.test.ts:81–82` make that rejection intentional. Documentation saying the guard is not proof of reasoning does not scope its unconditional behavior.

An actual source-reading musician may independently retain a good baseline. The current code forces it to change a musical choice or abandon recording the actual model involvement. Conversely, my counterexample changes just one density token under the same deliberately synthetic attestation and is accepted as `configured-llm`. Equality/inequality is not an authorship oracle. The accepted synthetic fixture is **not** a newly discovered authentication bypass: the receipt already deliberately trusts the parent attestation; the problem is the extra musical-novelty requirement.

Smallest acceptable fix, without a schema/framework/HTTP planner or added compliance gate:

1. Remove the unconditional baseline-equivalence rejection in `acceptAgentPlan`; retain strict PlanSchema, unique/source-note ID checks, exact raw response hash, source/request bindings and explicit baseline-versus-plan choice.
2. Allow an actual musician task to affirm baseline choices. Correct the workflow prose/test to distinguish **actual model source review and its factual task/output evidence** from an unreviewed deterministic relabel. No task/evidence still means an honestly labeled deterministic fallback. Equivalent choices may be described nonblockingly as model-reviewed/retained baseline; neither equality nor a trivial edit proves or disproves involvement, and no claim of newly composed material follows.
3. Add regressions accepting equivalent source-reviewed choices with a correctly bound synthetic receipt (clearly only a boundary fixture), while retaining missing/mismatched receipt, source-ID and raw-byte failures. At actual acceptance the independent judge must inspect the real musician task and reasons; do not pretend a test receipt establishes authorship.

Do not ask the musician to modify a good arrangement simply to satisfy this guard. The parent can correct the isolated A02 worker and request another independent review. **`4a039f3` was not integrated.** Root check aggregation remains unchanged until an accepted A02 implementation lands.

## Executed checks and boundary evidence

| Command / experiment | Actual result |
| --- | --- |
| `bun install --frozen-lockfile` in A02 checkout | 8 installs / 9 packages checked, no changes |
| `bunx tsc --project tests/agent/tsconfig.json` | Exit 0 |
| `bun test tests/agent` | 13 pass / 75 assertions / 0 failures; this alone did not catch the scope error |
| `bun run check` in A02 checkout | Exit 0; source 46 pass / 403 assertions; fixture+engine 58 pass, 1 live skip, 11 existing TODO, 0 failures; 16 literal controls; domain and engine browser builds |
| `bun run check` in root after documentation-only review changes | Exit 0 at `2026-10-20T22:35:43.709Z`; same source/fixture/engine totals, controls and browser builds; report `/tmp/opencode/guitar-a02-root-check.json`; root aggregate is intentionally not yet extended to unaccepted A02 code |
| `bun build src/publication/index.ts --target=browser --outdir=/tmp/opencode/guitar-a02-independent-browser` | Exit 0; browser-safe shared schema builds without filesystem authority |
| `bun /tmp/opencode/guitar-a02-independent-r1.ts` | Corrected checker completed; 63 recorded observations, including the rejected equivalent-plan blocker and accepted one-token counterexample; **not 63 product passes** |
| `bun docs/evidence/agent-review-r1-guard.ts` | Reproduces equivalent-plan rejection and one-density-token acceptance against the reviewed checkout; historical failure reproducer, not a new gate |
| Default publish CLI against existing ignored run, explicit `--baseline`, no adapter override | Expected exit 1 naming absent local `src/adapters/server.ts`; no fake export or partial bundle |
| `git check-ignore` for actual full source, all 12 raw blobs and published score | All paths ignored through local ignore-all files |

The independent 63-observation probe used a freshly prepared **original technical fixture**, actual engine/worker and production validator, plus separately written, loudly labeled storage export doubles. Its controls covered:

- Canonical source stamping **before** selection/request/baseline/brief, unchanged provider manifest, bound source/selection and no invented locks/approval.
- Corrupt run/source/request/preferences/locks/selection/baseline/provenance; unknown/rest source IDs; duplicate candidate IDs/references; forbidden melody/extra fields and out-of-range octave.
- Wrong/missing/extra receipt fields, wrong exact raw plan bytes (including whitespace), wrong source ID/digest/request; equivalence rejection and one-token non-authorship counterexample.
- Actual worker success, a real 1 ms elapsed budget returning `search-exhausted`, and in-flight cancellation.
- Complete five-file installation; exact original-byte replay with an adapter that throws if called again; changed metadata no-overwrite; restamped schema-valid physical corruption rejected independently.
- Wrong manifest identity/path/source/review/model/integrity, wrong artifact source/capo/count/digest/adapter/validation, corrupted bytes, unsafe IDs, symlinks, extra source file and a present partial directory failing closed.
- Interruption after five durable staging files but before visibility: no partial visible ID, owned staging/lock cleanup and unchanged earlier bytes; unknown leftover lock rejected **and preserved**. Only the probe's own empty lock was subsequently removed.
- Existing user `.gitignore` preserved rather than overwritten; invalid viewer origins rejected.

Original detailed script: `/tmp/opencode/guitar-a02-independent-r1.ts`, SHA-256 `9a35d5c24358cec3dc5d68e9cc795c5aa1e68ee17804b09485576bcbe8c72ea7`. Detailed result: `/tmp/opencode/guitar-a02-independent-r1.json`, SHA-256 `2c18b3d41f01167eb074cf8a26fb3fe35d55be67a81bc58e59cdaf6e98c665b4`, completed `2026-10-20T22:33:11.851Z`. Temporary fixture root: `/tmp/opencode/guitar-a02-independent-r1-IpQTyO` (not a user publication).

**Checker failure retained:** the first independent probe exited 1 when its cleanup called `rm` on its own empty fixture lock without a recursive option (`ERR_FS_EISDIR`). Replaced that call with `rmdir` and reran in a fresh fixture root. This was reviewer-harness cleanup, not a production publication failure. It does not erase the independently reproduced guard blocker.

## Existing real-byte smoke: narrowly inspected, not re-certified

Read `readPublication` on the worker's existing deterministic bundle `arr-1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac`: integrity checks pass, `agent:null`, explicit deterministic fallback, `unreviewed-draft`, 64 occurrences / 361 attacks.

- PDF: 80,520 bytes, SHA-256 `5bf1bcae7fb7af03f7a1fe9b9386fd280a503695e4b40d63b5b1d8e8b00012ec`.
- MIDI: 5,700 bytes, SHA-256 `2098954cbbf4563cbac703c5de1b123873a366271063f636cd9ff092bacc28d5`.
- Both report `canonical-guitar-1.0.1`. External A01 checkout remains at `6f1f455` with **uncommitted** gap fixes. Current `alpha-tab.ts` hash `0c0b1fe989f32fce68c132fc51dd3612704a9a40c2bd1ac3762152243147a5e3`; `server.ts` hash `8d64923e469a2f8baa88f7e827e77747531a2e72fae2360ea1921037624f5c5b`, matching worker disclosure.

This read-only inspection confirms the disclosed bytes/bindings exist. It is **not** a fresh independent export run, PDF-layout/MIDI-event acceptance, audible audition, HTTP link verification or reviewed A01 integration. Storage doubles deliberately have recognizable signatures but are not real PDF/MIDI; no product export claim comes from them. Production CLI binds the canonical local adapter and fails explicitly when it is missing. No UI was changed, served or visually verified in this review.

## Current user pivot and remaining units

Users request arrangements from **project CHAT subagents**. The app only views/plays/downloads immutable publications; no create/import/rebuild/model/API-setting interface and no HTTP planner integration are required. The old original-study studio/source-edit bug and parked HTTP planner remain **superseded, unintegrated work**, not passed fixes. `docs/WORKFLOW.md` in the reviewed implementation correctly interprets old “API-owned” identities as shared orchestration/publishing; the actual prepare/publish stamping follows that boundary without changing musical event IDs. The browser-safe schema/server-only reader split is sound within this reviewed scope.

- **A01:** independently review and integrate the committed gap/tempo adapter corrections, then rerun actual exports; the existing uncommitted smoke does not close it.
- **A02:** fix the one guard/documentation/test blocker and re-review. No implementation/root-check integration yet.
- **A03:** independently review read-only viewer, safe listing/serving, deep-link refresh/playback/downloads, actual reachable HTTP bytes and required UI evidence.
- **A04:** await actual musician plan, inspect source reasoning and exact output, then have the parent write a factual receipt and independently verify full-song artifacts/links. G11 remains open. Human audition, calibration and guitarist acceptance remain open and do not block hard-validated draft downloads.

The parent supplied pending-task facts for later verification, not a completed receipt: task `node:delegated-task:command%3Amcp%3A6402f533-82cb-4de9-b53f-d4ed4f0055a5%3Adelegate-task%3Aguitar-musician-arrangement-r1`, provider `opencode`, model `openai/gpt-6.1-sol`, requested `xhigh`; T3 `recentRuns.requestedAt=2026-10-20T22:24:18.147Z`, `startedAt=2026-10-20T22:24:18.193Z`. These timestamps are distinct request/start facts; retain their meanings. **No actual receipt or response digest was generated, and no actual model-output inspection or G11 pass is claimed.**

Final review hygiene: canonical `docs/decisions.tsv` preserves its entire `8554002` byte prefix, appends four six-column rows, and `git diff --check` passes. Only `docs/**` is changed in root; reviewed worker files remain untouched. No existing gate is removed or relabeled.

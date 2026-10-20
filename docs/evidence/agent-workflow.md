# A02 agent workflow / immutable publication implementation evidence

Date: 2026-10-20. Scope: owned `src/agent/**`, `src/publication/**`, two CLI scripts, agent tests, orchestration docs. No client/server/viewer or root package/check/ignore/TSV edits. **Implementation self-checks, pending parent independent review/integration.**

Historical initial checks below describe `4a039f3`. Independent R1 review rejected its unconditional baseline-equivalence rule; that rule is removed, not an authorship safeguard. See `agent-review-fix-r1.md` for the narrow failing-before/passing-after correction and current tests. Actual model source review may retain baseline choices without claiming new composition.

## Executed checks

| Command / control | Observed result |
| --- | --- |
| `bun install --frozen-lockfile` | Pinned dependencies installed; lockfile unchanged |
| `bunx tsc --project tests/agent/tsconfig.json` | Passed strict agent/publication/source/engine/CLI typecheck |
| `bun test tests/agent` | **13 passed, 75 assertions, 0 failed** |
| `bun run check` | Existing aggregate passed: source 46/403 assertions; foundation/engine 58 passed, 1 live skip, 11 existing TODO, 0 failed; 16 literal controls and both browser builds passed |
| `bun build src/publication/index.ts --target=browser --outdir=/tmp/opencode/agent-publication-browser` | Passed; browser-safe shared schema has no filesystem import |
| `git check-ignore` against actual source/raw/published score | All local full-song paths ignored through directory-local ignore-all files |
| Publish without integrated adapter | Explicit error naming absent `src/adapters/server.ts`; no partial publication |
| Local canonical adapter smoke (below) | Real bytes emitted and immutable replay reused; not independent artifact acceptance |

Tests exercise actual source canonical stamping, actual interval/section/bass/harmony brief, deterministic provenance, source/request/brief integrity, exact raw plan response hash, unknown/non-note IDs, baseline-equivalent AI relabel rejection, wrong receipt binding, bounded real engine worker, independent physical rejection of a **schema-valid restamped** corrupt candidate, required explicit baseline/model choice, complete immutable file installation, identical replay, changed metadata no-overwrite, wrong-score/wrong-digest/failed MIDI export rejection, input-file races/stale publication rejection, interrupted **durable staging** cleanup/old-revision retention, unsafe IDs, artifact tampering and file symlinks.

Storage fault-injection export bytes and delegation receipts are conspicuously synthetic unit-test doubles (`NOT-live`/`NOT-renderer`), **not evidence of a live model call or renderer correctness**. Initial harness runs caught a test-double reference containing forbidden `parentId`; the harness was corrected to strict `{id,digest}`. A first physical-negative test hit structural finger validation too early; it was corrected to mutate a stopped placement and restamp, so the final test specifically proves rejection by the independent validator.

## Fresh actual-song prepare / deterministic smoke

Executed:

```sh
bun scripts/prepare-arrangement.ts \
  --url 'https://www.songsterr.com/a/wsa/beach-boys-you-still-believe-in-me-tab-s692866' \
  --difficulty intermediate --capo compare \
  --title 'The Beach Boys — You Still Believe in Me'
```

Ignored local run:
`/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-bfbeaaab/.agent-runs/8030f5fb-37d0-4247-8188-75949cfab2b9`.

Actual imported identity: Songsterr **692866 / upstream 847990 / format 5**, 11 parts, 46 written bars, 12 raw artifacts, 7 explicit proposed melody sections. Request is intermediate, compare capo 0/2, preserve sounding pitches/key; source key remains **unknown**. The deterministic comparison plan contains 86 candidates. Source and complete song/raw remain ignored/local; no complete copyrighted source is committed here.

At the time of the smoke, canonical adapters were not integrated in this checkout. The existing adapter worker's **uncommitted fix** was loaded directly (no renderer copy) using:

```sh
bun scripts/publish-arrangement.ts \
  --run '.agent-runs/8030f5fb-37d0-4247-8188-75949cfab2b9' \
  --base-url http://localhost:3000 --baseline \
  --adapter-module '/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-cf255def/src/adapters/server.ts'
```

Adapter checkout HEAD was `6f1f455` with uncommitted `alpha-tab.ts`/`server.ts` gap fixes. The observed artifact manifest reports `canonical-guitar-1.0.1`; file hashes at inspection:

- `alpha-tab.ts`: `0c0b1fe989f32fce68c132fc51dd3612704a9a40c2bd1ac3762152243147a5e3`
- `server.ts`: `8d64923e469a2f8baa88f7e827e77747531a2e72fae2360ea1921037624f5c5b`

Local immutable bundle:
`.arrangements/arr-1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac/`.

Observed via the actual store reader and canonical manifests:

- Independent canonical validator passed; selected **capo 2**, 64 occurrences, **361 performed attacks / 245 melody attacks**, 395 export mapping segments.
- PDF **80,520 bytes**, SHA-256 `5bf1bcae7fb7af03f7a1fe9b9386fd280a503695e4b40d63b5b1d8e8b00012ec`.
- MIDI **5,700 bytes**, SHA-256 `2098954cbbf4563cbac703c5de1b123873a366271063f636cd9ff092bacc28d5`.
- Status **unreviewed-draft**, `agent:null`, canonical planner **deterministic fallback**. No model-authored song plan was fabricated by this implementation worker.
- Repeating the command returned the same ID with `reused:true`, retaining the exact original artifact bytes instead of replacing them with a rerendered PDF.

This demonstrates actual local prepare → bounded engine → validator → current adapter execution → atomic store, **not final adapter acceptance**: it depends on another worker's then-uncommitted fixes. `pdfinfo` was unavailable (`command not found`); no independent page-layout/MIDI-event parse, audible check or screenshot claim is made here. No viewer server was started by this worker; generated `localhost` URLs are **not HTTP-tested public links** and must not be returned to a remote user as usable links.

## Handoff / unresolved gates

1. Parent independently reviews/integrates A02 and adds root `check:agent`/CLI/check/ignore aggregation if desired; canonical TSV remains integrator-owned.
2. Independently accept/commit/integrate A01 adapter fix; rerun canonical exports against that committed version. The script already binds `createScoreAdapter` with actual `guitarValidator` and empty authoritative approval context.
3. A03 viewer consumes the agreed manifest plus documented optional `integrity`/`artifacts`; `score.json` is canonical ScoreV1. Server-only `readPublication(root,id)` verifies safe immutable path and manifest/file integrity. Only validated publication IDs should be listed/served, never run/raw/staging/lock files.
4. Parent creates the **actual source-reading musician task** with requested GPT-6.1-Sol xhigh, supplies factual task metadata, and independently judges the real plan/full-song artifacts. The prepared ignored run above is available for that task. No subdelegation happened in this worker.
5. Run the read-only viewer through Project Shelf, HTTP-test exact reachable viewer/PDF/MIDI URLs and downloaded bytes, capture changed UI in the viewer worker, then return stable links in project chat. Human melody audition/guitarist calibration/review remain explicitly pending.

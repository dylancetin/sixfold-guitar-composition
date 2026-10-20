# Arrange in project chat; publish for read-only viewing

This is the current user-approved flow. It supersedes the original in-site creation/approval UI and HTTP-provider planner plan in `WORKFLOW.md`. The musical schemas, exact source importer, deterministic engine, validator and canonical export adapters remain in use. No application/CLI code calls an external model or needs new model credentials: **the project musician subagent is the reasoning model**.

## 1. Prepare actual source and an ignored run

```sh
bun install --frozen-lockfile
bun scripts/prepare-arrangement.ts \
  --url 'https://www.songsterr.com/a/wsa/beach-boys-you-still-believe-in-me-tab-s692866' \
  --difficulty intermediate --capo compare \
  --title 'The Beach Boys — You Still Believe in Me'
```

`--capo compare` evaluates 0 and 2 later, with unchanged sounding melody/key. A chosen capo is `--capo 0` … `--capo 12`; ability limits still apply. Difficulty is required (`beginner|intermediate|advanced`). These are conservative, versioned, **uncalibrated** ability defaults, not measured human ability. Ask in chat only for missing difficulty/capo; notify with the `ntfy-notify` skill before a human question. Standard tuning is fixed in V1. No inferred B-major/A-shapes assertion is made when the source key is unknown.

The command returns an absolute run directory under `.agent-runs/<uuid>/`:

- `source.json`: all canonical symbolic source parts/events, newly orchestration-stamped source identity/digest; upstream provider identity is unchanged.
- `raw/<sha256>`: exact immutable source page/part bytes, local only. Restrictions/403 stop import; no alternate-host bypass or demo substitution.
- `selection.json`, `selection-proposal.json`: complete explicit, **unapproved** source-grounded melody mapping and disclosed alternatives/silence.
- `request.json`: resolved difficulty/ability, standard tuning behavior, capo request, preserved concert pitch, sparse densities and deterministic state/elapsed budgets.
- `brief.md`: actual selected melody pitches/onsets/releases/rests and successive semitone intervals by section, form/tempos/key uncertainty, source part ranges, and nonselected bass/harmony note evidence by bar. It explains bass below guitar register and doubled-part alternatives.
- `baseline-plan.json`, `baseline-provenance.json`: honestly labeled **deterministic fallback**, never model-authored.
- `run.json`: orchestration-allocated project/source/arrangement IDs, creation time and source/request/baseline/brief integrity bindings. No event sourcing or approval database.

Directories create their own local `.gitignore` (`*`) before any source writes, so full-song data is ignored without concurrent root-file edits. Keep the local roots private; publication exposes only intended score/exports/notes, **never the run/raw store**. Optional `--runs-root` selects another **dedicated** local root; an existing different ignore file is not overwritten or assumed safe. Failed imports remove only their own temporary preparation directory. Already prepared runs are not overwritten.

## 2. Have the project musician agent author a real plan

The parent delegates to the requested GPT-6.1-Sol xhigh, then uses a separate independent judge. Resolve actual IDs/options in the live T3 catalog. Implementation workers do not secretly delegate. The musician must read the prepared source/brief/selection/request, reason about actual melody/phrase/bass/harmony evidence, and write a UTF-8 **PlanSchema-only** JSON file, conventionally `<run>/plan.json`.

```json
{
  "version": "agent-source-phrase-plan-1",
  "candidates": [
    {
      "id": "source-specific-candidate-id",
      "role": "bass",
      "sourceEventIds": ["<existing imported note ID>"],
      "octaveShift": 0,
      "density": "sparse",
      "reason": "Explain this actual source attack, phrase role, bass register and how it supports the selected melody."
    }
  ]
}
```

The placeholder above is documentation, **not a valid song plan or evidence of a call**. Candidates may only reference existing source notes; IDs must be unique; role is bass/harmony, octaveShift -3…3 and density sparse/regular. The plan cannot change protected melody/selection/key, directly prescribe arbitrary new rhythms/chords or guarantee candidate retention. Bass register is independently explored by the engine; harmony uses the proposed octave. The engine audits actual register moves, shortened accompaniment and omissions. Ask for source-specific reasons and meaningful phrase/density/register choices, not a mechanical baseline rename.

### Factual delegation receipt

After the actual task, the **parent** writes `<run>/delegation.json` using `AgentDelegationSchema` in `src/agent/plan.ts`:

| Field | Truthful value |
| --- | --- |
| `schemaVersion`, `transport` | `1`, `"project-subagent"` |
| `provider`, `model` | Actual provider/model from the delegation result/catalog (retain requested xhigh in the task evidence) |
| `taskId` | Actual T3 delegated task ID |
| `callId` | Actual model-call ID if exposed; otherwise the actual T3 task ID, explicitly the orchestration call, **not** an invented provider HTTP request ID |
| `calledAt` | Actual task-call timestamp, captured by the parent when delegating |
| `responseDigest` | SHA-256 of the **exact raw `plan.json` bytes**, including whitespace/newline (`sha256sum <run>/plan.json`) |
| `sourceRevision` | `{id,digest}` from `run.json` |
| `requestDigest` | `run.json.requestDigest` |

The canonical `configured-llm` provenance schema already accommodates this real delegated model call: provider/model, plan version, callId/time, raw response digest and all accepted plan candidate IDs. Transport and task identity are retained in publication notes/manifest; it is **not** a new HTTP planner. Accepted means schema/source-validated proposal, not that every proposed accompaniment survives constraints. A receipt is an honest orchestrator attestation, not cryptographic proof a model read music. The independent judge must inspect task evidence and actual output.

The publisher rejects wrong raw digest, wrong source/request, invented/non-note source references, duplicate candidates, and baseline-equivalent candidate choices even if names/reasons/version changed. That last guard prevents a trivial deterministic-to-AI relabel; it does not itself prove musical reasoning. If real planning fails or no factual receipt exists, publish explicitly `--baseline` or report the blocker. No automatic AI label and no new secret prompt.

## 3. Validate, export and atomically publish

```sh
bun scripts/publish-arrangement.ts --run '<run directory>' \
  --plan '<run directory>/plan.json' --delegation '<run directory>/delegation.json' \
  --base-url 'https://<actual-viewer-origin>'
```

Or, explicitly without a model-authorship claim:

```sh
bun scripts/publish-arrangement.ts --run '<run directory>' --baseline \
  --base-url 'https://<actual-viewer-origin>'
```

`--base-url` is a root HTTP(S) viewer origin, without credentials/path/query/fragment. `--store` defaults to `.arrangements`. The CLI binds to local `createScoreAdapter` from `src/adapters/server.ts`; until the independently verified adapter is integrated, a trusted existing checkout can be smoke-tested via `--adapter-module /absolute/path/to/src/adapters/server.ts`. That option never copies/clones the renderer or downloads a module. A missing/failed adapter returns an error, not fake export success.

Publishing rechecks the prepared inputs/plan receipt, runs the real engine in an elapsed-time-bounded worker (plus engine state budget), stamps the arrangement header without changing event IDs, independently validates source/melody/form/physical facts with an empty approval context, and exports **both** PDF and MIDI through `ScoreAdapter`. It checks projection/revision/source/profile/capo/counts/MIME/bytes/digests and validation/review metadata. Export-adapter runtime validation remains active. This entry point only publishes `unreviewed-draft`: it never invents human approval.

All five files are written and fsynced in a private sibling staging directory, reread and checked, then become visible at one same-filesystem directory rename. Per-ID exclusive locks prevent concurrent replacement. IDs bind the full immutable score digest. A valid existing identical revision reuses its original artifact bytes (PDF metadata can vary between rerenders), rather than replacing it. Present but corrupt/partial/wrong metadata fails closed. Failures, cancellation and normal interrupted staging clean only owned temporary files; a hard process crash may leave an ignored staging directory/lock for explicit operator diagnosis, never a partial visible bundle. Do not blindly delete another process's lock. Previous publication URLs remain valid; no mutable head or event log is needed.

## Shared viewer/server contract

`src/publication/index.ts` is browser-safe. Each `.arrangements/arr-<64 lowercase hex digest>/manifest.json` is:

```text
{schemaVersion:1, id, title, sourceUrl, createdAt, revision:{id,digest},
 files:{score:'score.json',pdf:'arrangement.pdf',midi:'arrangement.mid',notes:'notes.md'},
 status:'unreviewed-draft'|'musically-reviewed', agent:{model,taskId}|null,
 integrity?:{score,pdf,midi,notes}, artifacts?:{pdf,midi}}
```

Optional V1 extensions are documented here: `integrity` hashes the exact bytes of each named file; `artifacts` contains the canonical per-format `ArtifactManifest` (source/score/profile/adapter/validation identities, counts, review and bytes metadata). This publisher always emits both. Filesystem reader `readPublication(root,id)` in **server-only** `src/publication/store.ts` requires them, rejects unsafe/path-mismatched IDs, unexpected/missing files, symlinks and digest/manifest mismatches. `PublicationIdSchema` accepts only `arr-` plus 64 hex characters; filter directory listings through it to exclude local ignore/staging/lock entries. Never join an unchecked request path or expose the whole workspace/run store. Server serves these files read-only, without generation POST endpoints or credentials.

`score.json` is canonical **ScoreV1**, not a validation envelope or renderer serialization. Capo/difficulty/tuning/form/counts/settings are read from score, not duplicated editable model state in the manifest. The CLI returns absolute URLs:

- `/arrangements/<id>` — viewer
- `/arrangements/<id>/arrangement.pdf` — PDF
- `/arrangements/<id>/arrangement.mid` — MIDI
- `/arrangements/<id>/score.json`, `/arrangements/<id>/notes.md`

The generated URLs are **not automatically HTTP-verified**: start the existing read-only viewer with its store root set correctly, use Project Shelf for retained previews, and test viewer/download HTTP status, MIME and downloaded bytes from the actual reachable origin before returning links in chat. Do not return localhost links to a remote user. Capture changed UI through `nextcloud-images` when the viewer worker changes it.

## Checks and remaining acceptance

```sh
bunx tsc --project tests/agent/tsconfig.json
bun test tests/agent
bun run check
```

Agent tests cover real engine/validator/worker plus **clearly labeled storage exporter test doubles** for publication fault injection. They do not certify PDF layout, MIDI events, audible playback or real model calls. Actual adapter/full-song export, independent PDF/MIDI parsing/visual review, viewer/browser link tests and a genuine musician-agent plan must be evidenced separately. Software or a model judge cannot establish human guitarist acceptance. A hard-validated draft can be shared/downloaded with those limitations, without approval bureaucracy.

Current four delivery units after the user scope correction: **A01 adapter gap/tempo fix**, **A02 agent workflow/publication**, **A03 read-only viewer/deep links**, **A04 actual musical-agent plan/full-song acceptance**. The old original-study studio is baseline evidence, not the published-song viewer. Root scripts/check aggregation and canonical TSV rows belong to the integrator during parallel work.

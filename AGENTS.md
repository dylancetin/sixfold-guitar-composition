# Project-chat arrangement workflow

## Product boundary (user clarification supersedes the original studio plan)

- Users request a song arrangement **in this project chat**, supplying a song URL, difficulty and capo preference. Agents do the musical reasoning and return tested viewer/PDF/MIDI links here.
- The website is a **read-only published-arrangement viewer/player/download page**. Do not add a create-arrangement button, in-site generator, model picker, API credential form, HTTP planner, or new provider credentials. Existing musical domain/engine/validator/adapters remain reusable.
- Ask only for missing difficulty/capo preferences, not information already supplied. For the known demo: intermediate, standard tuning, compare capo 0/2, preserve the sounding melody/key. A complete disclosed source selection can be an unapproved draft; do not invent musical approval or block draft downloads on human review.
- Before **any question requiring human input**, load and use the `ntfy-notify` skill. If notification is blocked, state the blocker; never request tokens in chat. Use the harness private secret workflow if genuinely needed. This workflow needs no new model secret.

## Orchestration

1. Read `docs/AGENT-WORKFLOW.md` and `docs/CONTRACT.md`. Respect path ownership and source restrictions. Source/arrangement identity stamping belongs to shared orchestration/publishing, not the pure engine/provider.
2. Run `bun scripts/prepare-arrangement.ts` with the supplied URL/difficulty/capo. Read the resulting ignored `brief.md`, `source.json`, `selection.json`, and `request.json`; they contain **actual musical events and intervals**. Keep full source/raw/song and generated full-song outputs ignored/local. Never commit complete copyrighted source.
3. The **parent orchestrator** uses the requested **GPT-6.1-Sol xhigh** musician subagent and a separate independent judge. Resolve current provider/model IDs through the live T3 catalog, retain task IDs and factual call times. Give source details, owned output path and `PlanSchema` limits. Implementation subagents must not redelegate unless their brief permits it.
4. The musician task writes the actual model-authored `plan.json` and specific source-based musical reasons. Do not rename the deterministic baseline and call it AI. The parent writes a truthful `delegation.json` receipt after the actual task, hashing the **exact plan-file bytes**. Never invent provider calls, task IDs, authorship or approval. Missing/failed actual planning can only produce an explicitly labeled deterministic fallback.
5. Run `bun scripts/publish-arrangement.ts`. It runs the bounded engine, independent validator, canonical real exports, verifies source/request/artifact identities and atomically installs the complete immutable bundle. Do not substitute a renderer clone, fake bytes, screenshots or a print dialog. Failed exports must not expose a partial bundle or replace the previous valid one.
6. Have the independent judge inspect exact source/melody/form/physical facts, actual exported PDF/MIDI and provenance, not only a worker summary. A model judge is not human guitarist approval. Uncalibrated movement and pending audition stay visible.
7. Use the existing Project Shelf lifecycle for retained preview servers (`project-shelf-agent-servers` skill); never unmanaged background launches. Point the viewer's read-only root at the publication store. HTTP-test the exact returned viewer/PDF/MIDI URLs, MIME and downloaded bytes before sharing. UI changes require screenshot capture/upload via `nextcloud-images` skill.
8. Return stable absolute links plus the honest draft/review status in chat. No link counts as tested merely because CLI URL construction succeeded. Do not claim a final playable release without actual human review.

## Checks and shared changes

- `bun install --frozen-lockfile`; `bunx tsc --project tests/agent/tsconfig.json`; `bun test tests/agent`; `bun run check`.
- Agent/storage tests deliberately use labeled export test doubles; only canonical adapter runs prove actual export execution, and independent artifact checks remain separate.
- Shared publication schema: `src/publication/index.ts` (browser-safe); filesystem reader/store: `src/publication/store.ts` (server-only). Never re-export Node filesystem code into the browser entry.
- `.agent-runs/` and `.arrangements/` self-ignore through local directory `.gitignore` files. Root scripts/ignore/check aggregation changes require integrator coordination when workers are parallel. Only the integrator appends canonical `docs/decisions.tsv` during owned-path parallel work.

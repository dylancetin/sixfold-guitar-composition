# Grounding and delivery checklist

- [x] Read Principles section of `/home/taytay/.agents/skills/poteto-mode/SKILL.md`.

## Phase A: Frame

- [x] Read invoked skills and inspect repository and parent instructions. Record missing skills in `docs/BASELINE.md`.
- [x] Capture the original commit, file inventory, environment, and absent runtime checks in `docs/BASELINE.md`.
- [x] Define release scope, falsifiable gates, unknowns, effort, and stop conditions in `docs/WORKFLOW.md`.
- [x] Preserve the user's first song, arrangement-first priority, arrangement-time difficulty choice, and intermediate standard-tuning demo default.
- [x] Inspect the existing importer read-only at `/home/taytay/workspace/midi-to-readable-notaion`. Record the spelling difference and reuse boundaries.
- [x] Read the completed feasibility report and inspect primary source, MIDI, and PDF artifacts. Incorporate repeated form, section mapping, bass register, real exports, and optional configured planning.

## Phase B: Design the workflow

- [x] Describe melody approval, bass approval, playable harmony, playback, and export.
- [x] Propose the stable domain contract, test plan, and architectural experiments without selecting a production stack.
- [x] Order separately landable units by risk. Define evidence and ownership boundaries.
- [x] Obtain parent review. Reversible source, contract, test-foundation, and export-proof work is approved after this documentation checkpoint.

## Phase C: Run the loop

The planning checkpoint was documentation-only. U01 evidence preservation/audit, the bounded synthetic U02 export proof, U03 contract/test foundation, U04 source, the independently reviewed U05/U07/U08/U09 engine core, and the U11/U12 canonical adapters with both corrections are now integrated. The read-only website and CHAT publication workflow remain separate pending delivery. Unit details, dependencies, estimates, and gates are in `docs/WORKFLOW.md`.

- [x] U01. Preserve and audit existing local exact-song source/probe evidence and access limitations; reference remains read-only. See `docs/evidence/export-review.md` and preserved feasibility/design reports. U04 now verifies the actual raw retrieval trace; source audition remains open at U06. This is not full G1/G2 acceptance.
- [x] U02. Independently verify and integrate the original synthetic alphaTab/PDFKit multi-voice, tie/tuplet, capo 0/2, whole-system A4/Letter PDF and real MIDI proof. See `docs/evidence/export-review.md` and `tools/export-proof/unit-log.tsv`. No full-song/app/playability claim; cosmetic caption/Letter packing limits remain.
- [ ] Audition and approve the actual full-song melody section/voice/event selection, and obtain human guitarist review at target tempo. Two MIDI parsers do not satisfy a second-player audition or G5.
- [x] U03. Approve contract version 1, establish project checks, and add independent expected-event fixtures before features. Round 1 failed on first-create/identity ownership and same-origin download paths; corrected in `2319ed8`, independently verified in round 2, then integrated as `1790577` → `68b358f`. See `docs/CONTRACT.md` and `docs/evidence/foundation.review-round2.md`; the unchanged failed review is `foundation.review-round1.md`.
- [x] U04. Adapt the existing bounded Songsterr importer with explicit errors, event/voice selection, and exact source mapping. Independently verified and integrated as `b264d9f` → `8a13d0a`; see `docs/evidence/source-review.md`. Fresh raw/reference checks confirm 11 parts / 46 bars, 141 main attacks / 154 refs and a complete monophonic unapproved proposal. Key remains unknown; musician approval and arrangement feasibility are not source-import passes.
- [x] U05 core. Project this song into 64 unfolded occurrences with explicit effective entry tempos, written-bar/pass identities, exact triplets and contiguous ties. Independently verified; adapter labels and no-double-repeat rendering remain U11/U12 gates. See `docs/evidence/engine-review-r1.md`.
- [ ] U06. Complete CHAT difficulty/capo prompting and melody approval; compare capo 0 and 2 while preserving the original sounding melody and explicit section mapping. No in-site generation/import UI is required.
- [ ] U07. Source-grounded bass/register/sustain/omission engine core is independently verified; user editing and approval interaction remain open. Exact melody and full bass locks are preserved. See `docs/evidence/engine-review-r1.md`.
- [x] U08 core. Independently verify required placement, half-open held string/finger sweep, hand states, capo-relative/physical limits and specified effective-tempo transitions. Barres unsupported. Uncalibrated movement remains an explicit nonblocking draft warning, not human-playability approval.
- [x] U09 core. Independently verify sparse source-harmony candidates, full protected bass locks, source-grounded change audits and search-exhausted versus finite impossibility. Musical approval and user interaction remain open.
- [ ] U10 superseded scope. Actual CHAT musician/subagent evidence and honest deterministic provenance remain A02/A04 work; no HTTP planner/provider settings or new generation UI is required.
- [ ] U11 delivery. Canonical staff/TAB, transport, voice controls, seeking, absolute tempo and loops are independently verified at the adapter boundary. Actual full-song browser rendering passes; read-only website wiring remains A03.
- [ ] U12 delivery. Canonical real-validator-approved unreviewed drafts now produce independently checked full-song PDF/MIDI at both capos and page sizes. Website download/link bytes and publication binding remain A03; human approval is separate and does not block draft downloads.
- [ ] U13. Run the complete-song acceptance matrix, musician review, and independent audit. Claim live LLM assistance only with real provider evidence.
- [ ] For each unit, state a hypothesis, run its check, inspect artifacts, log a verdict, and continue only after verification.

U03's combined root check passed pinned installation, typecheck, **32 fixture tests / 11 pending / 0 failures**, 16 test-only oracle expectations, browser-target domain build, independent schema/helper probes and U02's 18 lightweight predicates. U02 artifacts were not regenerated; existing reviewed evidence is unchanged. The 11 named pending gates in `tests/fixtures/literal-oracles.ts` remain pending, including actual create/CAS storage, source/form/physical validation, browser playback, canonical full-song exports and musician review. No product G1–G11 gate is closed by this foundation check.

U04 integration adds `check:source` to the root aggregate: `bun run check` now also executes the strict source typecheck and **46 source tests / 403 assertions / 0 failures**, without traversing the independent export-proof npm package. Independent original/fresh raw-byte reconstruction, nine relevant corruptions, live reference comparison and real resource-timeout controls pass. See `docs/evidence/source-review-root-check.json` and `docs/evidence/source-review.md`; source acquisition/proposal verification does not close audition, API stamping/persistence or arrangement/export gates.

Engine integration retains `check:source` and extends the root strict typecheck, fixture/engine test selection and browser builds. The live-enabled review reproduces **59 foundation/engine pass / 11 existing TODO / 0 fail**, including 27 engine tests, and all nine difficulty/capo experiments. A separate Fraction oracle compares every source/pitch/start/end across **173 written / 245 performed melody attacks, 64 occurrences, 256 quarters, 172.405679513s**, including all 141 part-0 attacks. Thirteen independently restamped corruptions fail for substantive diagnostics. See `docs/evidence/engine-review-r1.md` and `engine-review-root-check.json`. This verifies the pure engine, not subjective musical approval or G1–G11 product acceptance; the existing foundation TODOs are not relabeled as passes.

**Canonical adapter/export round 2 is VERIFIED for adapter + actual-artifact scope:** the historical double-scale failure and generated `5/2` gap failure are retained, corrected by `6f1f455` and `ee367928`, then independently reviewed and integrated with `043b1fc` as `39dcceb` → `3a6fabf` → `665d98d`. Effective 40 BPM / 12 s and runtime absolute scale 0.75 → 60 BPM / 8 s pass actual MIDI/PDF/browser checks; the old native 1280-tick rest is now exact 1920 + 480 = 2400, without canonical note changes. Both actual s692866 drafts retain all 245 selected-source melody attacks, with 354/361 complete MIDI attacks, 64 occurrences / 256 quarters / 172.405524 rounded-MIDI seconds. All 44 PDF pages pass glyph/raster checks; pages 1/6/11 of every size/capo were directly inspected, including final double bars. Integrated full-score browser rendering passes. See `docs/evidence/adapters-review-round2.md` and `adapters-review-round2-integration.json`. Root aggregate preserves source/engine hooks and adds adapter typecheck/tests, real-validator tempo regression and browser build; no publication workflow code/typecheck is present. Human audition/calibration and A02/A03/A04 remain open, not draft-download blockers.

## Phase D: Keep the audit trail

- [x] Create `docs/decisions.tsv` with the exact `show-me-your-work` header.
- [x] Record baseline findings, limits, provisional scope, and deferred choices with evidence pointers.
- [ ] Append a row for each future decision, completed unit, failed experiment, scope change, or corrected gate.
- [x] Read the parent's independent architecture challenge and record the missing-architect fallback. Its excerpt criticism describes an earlier snapshot. Cross-model identity is not established.

## Phase E: Verify and hand back

- [x] Check document structure, log columns and pointers, unit coverage, effort arithmetic, and the repository diff.
- [x] Audit this run's log against available evidence. Record that `agent-transcripts/` is unavailable.
- [x] Prepare only the four planning documents for the authorized first checkpoint. Return the actual commit in the handoff.
- [ ] After implementation, verify the real product against every release gate. Grounding checks do not satisfy product acceptance.

## Current chat/publication scope and independent A02 review

The user clarified that **project CHAT subagents create arrangements** and return tested links; the app is a read-only viewer/player/downloads, with no create/import/rebuild/model/API settings. This supersedes original in-site studio/source-edit interaction and HTTP planner transport work, which remain unintegrated historical scope, **not passed fixes**. Existing musical source/engine/export gates remain intact. Shared orchestration/publishing performs the identity stamping formerly described as “API-owned”; no generation HTTP API is required.

- [x] **A01 adapter + actual-artifact scope:** independently verified and integrated all three committed adapter changes; fresh real-validator root exports, all-event checks, all 44 PDF-page checks, twelve direct first/middle/last views and full-score Chromium renders pass. See `docs/evidence/adapters-review-round2.md`. This supersedes the older uncommitted 80,520-byte PDF / 5,700-byte MIDI smoke, not its historical limits. A03 website downloads and human musical/physical review remain open.
- [ ] **A02:** `4a039f3` is **NOT VERIFIED / not integrated**. Remove the unconditional baseline-equivalence rejection: actual model source review may retain a good baseline, and a token musical change does not prove authorship. Retain exact receipt/source/request/hash validation and factual parent/judge evidence; update prose and regressions without a new schema/framework/HTTP planner. See `docs/evidence/agent-review-r1.md`. Thirteen worker tests and existing aggregate pass; independent probes recorded 63 observations including the scope blocker. Root agent/publication check aggregation awaits accepted code.
- [ ] **A03:** independently review read-only viewer/deep links, safe immutable-file serving, playback/downloads, HTTP bytes and UI evidence; old original-study studio is not the published-song viewer.
- [ ] **A04:** actual musician plan/full-song acceptance remains pending; no actual receipt generated by this review and no G11 pass. Parent must inspect real task/output and write the exact-byte/source/request-bound factual receipt only after completion. Human melody audition/calibration/guitarist acceptance remain open, not draft-download blockers.

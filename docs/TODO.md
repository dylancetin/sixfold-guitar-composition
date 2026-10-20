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

The planning checkpoint was documentation-only. U01 evidence preservation/audit, the bounded synthetic U02 export proof, U03 contract/test foundation, U04 source, and the independently reviewed U05/U07/U08/U09 engine core are now integrated. No application is implemented. Unit details, dependencies, estimates, and gates are in `docs/WORKFLOW.md`.

- [x] U01. Preserve and audit existing local exact-song source/probe evidence and access limitations; reference remains read-only. See `docs/evidence/export-review.md` and preserved feasibility/design reports. U04 now verifies the actual raw retrieval trace; source audition remains open at U06. This is not full G1/G2 acceptance.
- [x] U02. Independently verify and integrate the original synthetic alphaTab/PDFKit multi-voice, tie/tuplet, capo 0/2, whole-system A4/Letter PDF and real MIDI proof. See `docs/evidence/export-review.md` and `tools/export-proof/unit-log.tsv`. No full-song/app/playability claim; cosmetic caption/Letter packing limits remain.
- [ ] Audition and approve the actual full-song melody section/voice/event selection, and obtain human guitarist review at target tempo. Two MIDI parsers do not satisfy a second-player audition or G5.
- [x] U03. Approve contract version 1, establish project checks, and add independent expected-event fixtures before features. Round 1 failed on first-create/identity ownership and same-origin download paths; corrected in `2319ed8`, independently verified in round 2, then integrated as `1790577` → `68b358f`. See `docs/CONTRACT.md` and `docs/evidence/foundation.review-round2.md`; the unchanged failed review is `foundation.review-round1.md`.
- [x] U04. Adapt the existing bounded Songsterr importer with explicit errors, event/voice selection, and exact source mapping. Independently verified and integrated as `b264d9f` → `8a13d0a`; see `docs/evidence/source-review.md`. Fresh raw/reference checks confirm 11 parts / 46 bars, 141 main attacks / 154 refs and a complete monophonic unapproved proposal. Key remains unknown; musician approval and arrangement feasibility are not source-import passes.
- [x] U05 core. Project this song into 64 unfolded occurrences with explicit effective entry tempos, written-bar/pass identities, exact triplets and contiguous ties. Independently verified; adapter labels and no-double-repeat rendering remain U11/U12 gates. See `docs/evidence/engine-review-r1.md`.
- [ ] U06. Implement difficulty and capo prompting, compare capo 0 and 2, preserve original sounding melody, and implement section mapping and melody approval.
- [ ] U07. Source-grounded bass/register/sustain/omission engine core is independently verified; user editing and approval interaction remain open. Exact melody and full bass locks are preserved. See `docs/evidence/engine-review-r1.md`.
- [x] U08 core. Independently verify required placement, half-open held string/finger sweep, hand states, capo-relative/physical limits and specified effective-tempo transitions. Barres unsupported. Uncalibrated movement remains an explicit nonblocking draft warning, not human-playability approval.
- [x] U09 core. Independently verify sparse source-harmony candidates, full protected bass locks, source-grounded change audits and search-exhausted versus finite impossibility. Musical approval and user interaction remain open.
- [ ] U10. Implement genuine optional configured LLM planning with schema validation, provenance, consent, and an honestly labeled deterministic fallback.
- [ ] U11. Implement score and tab interaction, transport, voice controls, seeking, tempo, and measure loops.
- [ ] U12. Produce actual PDF and MIDI bytes from the approved revision, inspect every page and event, and verify local save and reopen.
- [ ] U13. Run the complete-song acceptance matrix, musician review, and independent audit. Claim live LLM assistance only with real provider evidence.
- [ ] For each unit, state a hypothesis, run its check, inspect artifacts, log a verdict, and continue only after verification.

U03's combined root check passed pinned installation, typecheck, **32 fixture tests / 11 pending / 0 failures**, 16 test-only oracle expectations, browser-target domain build, independent schema/helper probes and U02's 18 lightweight predicates. U02 artifacts were not regenerated; existing reviewed evidence is unchanged. The 11 named pending gates in `tests/fixtures/literal-oracles.ts` remain pending, including actual create/CAS storage, source/form/physical validation, browser playback, canonical full-song exports and musician review. No product G1–G11 gate is closed by this foundation check.

U04 integration adds `check:source` to the root aggregate: `bun run check` now also executes the strict source typecheck and **46 source tests / 403 assertions / 0 failures**, without traversing the independent export-proof npm package. Independent original/fresh raw-byte reconstruction, nine relevant corruptions, live reference comparison and real resource-timeout controls pass. See `docs/evidence/source-review-root-check.json` and `docs/evidence/source-review.md`; source acquisition/proposal verification does not close audition, API stamping/persistence or arrangement/export gates.

Engine integration retains `check:source` and extends the root strict typecheck, fixture/engine test selection and browser builds. The live-enabled review reproduces **59 foundation/engine pass / 11 existing TODO / 0 fail**, including 27 engine tests, and all nine difficulty/capo experiments. A separate Fraction oracle compares every source/pitch/start/end across **173 written / 245 performed melody attacks, 64 occurrences, 256 quarters, 172.405679513s**, including all 141 part-0 attacks. Thirteen independently restamped corruptions fail for substantive diagnostics. See `docs/evidence/engine-review-r1.md` and `engine-review-root-check.json`. This verifies the pure engine, not subjective musical approval or G1–G11 product acceptance; the existing foundation TODOs are not relabeled as passes.

**Canonical adapter/export correction remains open:** the separate adapter judge reported double application of `tempoScale` to already-effective performed BPM. Engine review additionally reproduces alphaTab rejection of the valid live bar-5 `5/2`-quarter silent bass gap: adapter-generated dotted tuplet rest is 1280 instead of 2400 ticks. Engine notation tiles exactly and the adapter correctly rejects rather than quantizing. Both adapter corrections and independent full-song PDF/MIDI/preview verification precede canonical export acceptance. Human audition/calibration is distinct and does not block hard-validated unreviewed draft downloads.

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

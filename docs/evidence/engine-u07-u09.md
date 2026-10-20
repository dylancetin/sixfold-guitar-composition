# U07/U09 candidate evidence and public integration notes

Base ce201e0; changes restricted to `src/engine/**`, `tests/engine/**`, `scripts/probe-engine.ts`, and `docs/evidence/engine-*`. No domain, source, adapter, API/UI, server, or canonical log changes. No subdelegation or network in the core.

## Public surface

`src/engine/index.ts` exports:

- `guitarEngine: Engine`: synchronous, pure `arrange(source, request, plan, planner)`.
- `guitarValidator: Validator`: synchronous independent `validate(source, score, {approvedRevisions})`.
- `expandForm({bars, tempos, form, events?}, tempoScale = 1)`: tagged `expanded` with exact `occurrences`, `performedTempos`, `length`; otherwise `unsupported` / `invalid-input` with diagnostics. Include selected merged source events to enforce jump-tie policy. Accepts a complete `SourceScoreV1` directly.
- `deterministicPlanner: OptionalPlanner`: async port, local deterministic source evidence selection; always `deterministic fallback`, no configured-model claim. Uses at most one sparse inner voice and one bass line, not doubled source bass parts.
- `createDefaultAbilityProfile(difficulty = 'intermediate')`, `createDefaultPreferences(ability?, capo?)`, `createDefaultRequest(source, completeSelection, difficulty?)`.
- `secondsBetween(start, end, performedTempos)` for boundary seconds; `scopeDigest(score, role)` for canonical approval payloads (sounds/rests start+ID ordered, role changes stable-ID ordered).

```ts
const request = createDefaultRequest(source, completeSelection, 'intermediate');
// Optional: request.preferences.capo = {mode:'chosen', value:2};
const planned = await deterministicPlanner.plan(source, request);
const proposal = guitarEngine.arrange(source, request, planned.plan, planned.provenance);
if (proposal.status === 'candidate') {
  // API allocates/stamps authoritative project/revision header and digest first.
  // API loads every referenced approval revision, not a client-provided context.
  const report = guitarValidator.validate(source, proposal.score, {approvedRevisions});
}
```

Engine candidate IDs are deterministic **provisional** identities. The source/selection must bind the same digest-verified revision; if API stamps a new source identity, rebind the proposed selection to that exact revision before creating the request. A complete proposed map needs no human approval to generate a draft. Draft output remains `sourceReady` / pending musical review. Uncalibrated movement is a warning, not a draft-download blocker.

## Search and physical behavior

The bounded sequence beam jointly considers mandatory exact melody and optional source bass/harmony, retaining held strings/fingers throughout intervals. Equivalent melody placements are not frozen before adding bass. A literal low-register fixture proves a more expensive melody string is selected to retain bass that the cheapest melody placement would block. Finger symmetry reduction applies only to uncalibrated profiles; specified transitions enumerate fingers and re-finger the entire unfolded performance, including repeat boundaries. Independent validator checks both hand-position speed and released-finger reassignment at effective tempo; assigning a fresh finger cannot bypass the speed limit.

Accompaniment uses source attacks and pitch classes only; register changes and shortened sustains have explicit before/after audit records. Omission records cover **proposed plan candidates**; other source parts/attacks are not silently claimed to be arranged. Default sparse planner discloses the selected source event IDs rather than pretending to copy an entire original accompaniment. Harmonic chord/key labels remain unknown rather than inventing a chart. Initial generated harmony is a single sparse inner voice (`voiceId: 'harmony'`), avoiding per-event native voice proliferation. Explicit locked polyphonic harmony is not implicitly simplified.

Bass/harmony locks are mandatory and never dropped/revoiced to make room. Stable per-event change IDs keep a bass register-change audit unchanged when adding harmony. Scope mismatch returns `reapproval-needed`; the Engine port cannot authenticate a referenced immutable revision or recover arbitrary custom historical change text absent from its request. API must supply those full revisions to independent validation. No copied hash is an approval bypass.

`maxStates` counts successor states and is shared between compared capos. `maxElapsedMs` is an outer worker deadline, not a hidden clock in the pure engine. Bounded failure is `search-exhausted`; no beam failure is called impossible. Only the exhaustively checked six-string empty melody-position domain returns `proven-unsatisfiable` with domain digest/proof. Unsupported exact notation fails with event/bar diagnostics, never quantizes. An internally rejected constructed score is `invalid-candidate`, not an exportable success.

## Original and negative verification

Final engine run with live fixture enabled: **27 pass, 0 fail** (132 assertions). Combined foundation + engine: **59 pass, 11 existing foundation TODO, 0 fail**, 434 assertions. The 11 TODO remain honestly pending foundation gates; they were not rewritten as passing product claims. With no live environment variables, the optional live test is explicitly skipped rather than fabricated.

Original eight-bar musical study covers 10 performed occurrences, inherited tempo restoration, quarter triplets, mixed 1/3 and 1/6 values, two cross-bar sustains, silence, low melody excluding impossible bass, and final attack. Both capos retain identical melody. Other cases exercise non-greedy melody/bass string choices, explicit transposition, complete unapproved defaults, budget exhaustion vs six-string proof, approved bass carried through harmony, capo incompatibility of an approved low E, and full performed specified-transition re-fingering.

Production-validator negative mutations are restamped before validation: missing middle/final melody, octave/sustain edits, incomplete rest selection, wrong source identity, missing triplet, retriggered tie, missing tempo restore, held string and finger collisions, contact shortening, missing boundary state, capo error, stopped finger0, five stopped contacts under no-barre/four-finger profile, too-fast hand movement with a fresh finger, absent approved revision and altered full lock. Exact release/reuse boundary passes. Actual-song mutations additionally remove the final melody, flatten to 46 occurrences, or erase omission audits, and are rejected.

Commands:

```sh
bun test tests/engine
ENGINE_LIVE_SOURCE=/absolute/local/source.json ENGINE_LIVE_SELECTION=/absolute/local/melody-proposal.json bun test tests/fixtures tests/engine
bunx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noUnusedLocals --noUnusedParameters --skipLibCheck src/engine/*.ts tests/engine/*.ts scripts/probe-engine.ts
bun build src/engine/index.ts --target=browser --outfile=/tmp/opencode/engine-browser.js
bun run check
```

The existing parent package test/typecheck/build scripts still target foundation paths; parent integration must include engine paths or use the explicit commands above. The browser bundle succeeds with no Node/Bun imports in core.

## Actual requested song (not substituted)

The source worker's local canonical source and complete proposed map were consumed directly, not reimported or copied. Source IDs/digests in the JSON evidence identify the exact document. All 11 parts / 46 bars; explicit intro and later fallback sections, full 141 merged part-0 attacks / 154 raw refs, plus disclosed proposed material. Raw and candidate song JSON remain outside Git.

See `engine-live.json`, `engine-live-beginner.json`, `engine-live-advanced.json` for metadata-only probe results. Every difficulty at chosen capo 0, chosen capo 2, and recommendation returns an independently passed draft with **173 selected written melody attacks → 245 performed melody attacks, 64 occurrences, 256 quarters, 172.405679513s**. Every full performed melody digest is identical across all nine experiments. The literal source-to-performance live test also compares every selected `(source ID, pitch, start, end)` using the independent 64-bar oracle, not counts alone.

Intermediate: 40 written / 58 performed bass attacks at either capo; 37/51 harmony at capo 0 and 40/58 at capo 2. Recommendation chooses capo 2, preserving the identical concert melody/key. The final sound releases at quarter 255; explicit selected rest/notation and form continue to quarter 256 (not a truncated ending). Six proposed accompaniment omissions and six shortened sustains at the recommended setting are visible; all bass/inner register moves are recorded.

First live run exposed the real 9/4 cross-bar sustain bug in greedy notation decomposition: unrelated tuplet denominators could strand a dyadic remainder. Fixed by forbidding unrelated odd denominator introduction, with an independent original regression asserting exact `1 + 1/4 | 1` tied notation. Subsequent live runs all pass; no melody alteration or quantization was used to get there. Sparse harmony initially retained only two notes; explicitly proposing source pitch-class inner-register relocations improved musical density without sacrificing bass/melody.

For adapter smoke testing, final intermediate canonical candidates are local only:
`/tmp/opencode/engine-live-0.json`, `/tmp/opencode/engine-live-2.json`, `/tmp/opencode/engine-live-recommend.json`.

Candidate rows (not canonical acceptance-log entries):

- U07 | exact melody-preserving bounded sequence search, source-grounded complete proposed draft; original + actual full-song capos 0/2 verified.
- U09 | source bass register search + sparse source inner harmony, audited drops/shortening, preserved bass locks; original + actual full-song verified.
- U08 follow-up | production validator checked against all generated drafts and independent original/live negative mutations.

Remaining gates: external independent review; adapter/native representation, PDF/MIDI artifact and playback/cursor testing; API authoritative identity/approval storage/context; musician approval and calibrated human movement. This evidence does not claim these gates or a human-playable final release.

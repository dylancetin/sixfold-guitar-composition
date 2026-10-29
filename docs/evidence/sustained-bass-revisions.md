# Sustained-bass revision batch — 2026-10-27

## User request and implementation

The user requested longer ringing bass instead of percussive punches, with capo and hand positions evaluated for a connected chord progression. Original library entries **01, 02, 03, 04, 06** were revised; **05, 07, 08** were removed from the served store into a private ignored archive.

- Updated `AGENTS.md`, `docs/AGENT-WORKFLOW.md`, and the generated Markdown brief in `src/agent/brief.ts`.
- `src/engine/search.ts` ranks exact monophonic bass coverage, then uninterrupted-hold continuity (sum of squared rational durations), before source register/contour, attack retention, harmony and fingering cost. The same comparator evaluates hand positions and capo trials. This is a bounded-search preference, not proof of globally optimal fingering or acoustic resonance.
- No source note was artificially lengthened. Musicians selected longer existing source notes, preserving the previously imported source, protected melody/selection and ability preferences in new ignored runs. These existing-arrangement revisions reused exact acquired sources rather than reimporting changed upstream versions. Source simplifications remain disclosed.
- The library shows the newest valid edition per score `projectId`. Earlier revised editions remain directly downloadable under their immutable URLs; separately requested removals return 404. Numbering follows current library order, so the original request numbers are not permanent identifiers.

## Musical results

Actual **written bass duration in quarter-note units**, not attack counts or measured acoustic decay:

| Original entry | Song | Before → after | Selected capo | Final PDF pages |
| --- | --- | --- | --- | --- |
| 01 | Caroline, No | 74½ → 171 | 2 | 7 |
| 02 | Don’t Worry Baby | 81 → 275½ | 2 | 11 |
| 03 | Girl | 81⅔ → 114 | 2 | 8 |
| 04 | God Only Knows | 120⅔ → 301 | 0 | 12 |
| 06 | You Still Believe in Me | 75 → 148 | 0 | 6 |

All five retain the exact protected melody/rest/form. Total bass attacks increase to cover source harmonic changes; this is not a claim of fewer attacks overall. God Only Knows retains one disclosed bass shortening. Other source-limited gaps and inversion/pedal alternatives remain explicit.

Don’t Worry Baby received a second actual musician task after independent review found nine bars without their original harmonic root in any output role. Nine existing piano downbeat eighths now provide those roots as inner support. Independent re-review confirmed all nine cues, all 107 unchanged bass intervals (275½ quarters), and the 50 previously retained harmony notes. These brief root cues do not establish aurally identical chord perception.

## Provenance and actual artifact review

Five initial musician tasks, one focused refinement, and six separate independent review tasks used actual `opencode` / `openai/gpt-6.1-sol`, `variant=xhigh` delegation. Parent receipts bind factual task IDs/times and exact plan-file bytes. Ignored ledgers:

- `.agent-runs/sustained-bass-mapping.json`
- `.agent-runs/sustained-bass-delegations.json`
- `.agent-runs/sustained-bass-judges.json`

Each final run contains `musician-review.md`, `delegation.json`, `publication.json`, `judge-review.md`, `judge-result.json`, and `delivery.json`. Complete song data and rendered artifacts remain ignored/local. Each independent judge inspected actual canonical PDF/MIDI bytes, source/melody/form/held contacts, source-based bass changes, and provenance. All final verdicts are **pass for an unreviewed draft**, not human guitarist approval.

Final immutable publication IDs:

| Original entry | Publication ID |
| --- | --- |
| 01 | `arr-d28b80d6a3adc5ea83fe088661a51cd26c16a37b6b44bbe2abfe0dfc2b021e5d` |
| 02 | `arr-1618a70506b5349d318ffe0ae7ed6d9272b3460de68a52eeb4e8d13480abf046` |
| 03 | `arr-d9c0048f0d5142ed95351f35816f4e8bb5fc0329f754db401126360c8a510dbf` |
| 04 | `arr-3693272d44305037f5fc0e693784695e8a0af6761ea438bb8245f97209cfb2a1` |
| 06 | `arr-dff05a5bd43d37277a625be2a391b157f47afd7df5f9d05938430f440738eaa8` |

## Verification

- Passed `bun install --frozen-lockfile`, `bunx tsc --project tests/agent/tsconfig.json`, `bun test tests/agent`, and `bun run check`.
- New engine regressions check one held root versus equal-coverage repeated punches, capo/open-string sustain beneath moving melody, and preservation of source-release gaps. Viewer regression checks newest-project listing, separate same-title projects and unchanged previous downloads.
- Canonical publisher exported real PDF/MIDI into an ignored staging store; exact judge-reviewed bytes were checked again and installed through `PublicationStore` into `.arrangements`.
- All five exact viewer/PDF/MIDI/score/notes URLs at `http://beelinkk:4590` returned HTTP 200 with expected MIME; downloaded artifact/score/notes bytes matched local hashes. Earlier revised PDF/MIDI bytes remained identical. Original 05/07/08 manifest/PDF/MIDI URLs returned 404. Library contains five current valid entries, zero unavailable bundles.
- Chromium rendered all five current score pages with no page errors and captured the final library. Used the existing Project Shelf-managed Sixfold server; no unmanaged preview was started.

Human audition, comfortable transitions and acoustic sustain remain unverified. Movement profiles remain uncalibrated and all five publications remain `unreviewed-draft`.

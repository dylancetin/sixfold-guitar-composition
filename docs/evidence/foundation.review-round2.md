# Independent U03 contract review — round 2, 2026-10-20

**VERIFIED for integration: corrected, bounded U03 contract/test foundation only.**
Both round-one blockers are resolved. The complete s692866 arrangement/application is
**NOT VERIFIED**; source audition and guitarist acceptance remain **INCONCLUSIVE**.
Reviewer: fresh independent GPT-6.1 Sol, intentionally the same model family requested
by the parent. No cross-family/arena review, subdelegation, or product implementation.

Reviewed worker `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7599a70e`
at `2319ed87f6177a71bcc96034b44a2e6d8f5a878b`, including foundation commit
`21b0c40e35e06b656e983117df48969beed28063`, the correction diff, all domain files,
fixture/check code, `docs/CONTRACT.md`, the worker correction report, and the preserved
[round-one review](foundation.review-round1.md). Read the settled
[U02 review](export-review.md); did not reopen its design or regenerate heavy artifacts.
The worker remained clean; root was clean at `e96fcd260bf719d2ef5570b68225ded36ff27b1c`.

## Corrections independently verified

1. **P1 — first create and identity ownership: resolved.**
   `src/domain/ports.ts:68–76,95–108` now expresses a `create` mutation with
   `expectedHead:null` and a parentless replacement. Existing edit/approve variants
   still require a complete nonnull `{id,digest}` head. Conflict results represent
   either a current reference or an absent head. CONTRACT lines 70–92 explicitly
   assign authoritative project/revision allocation, parent stamping and digest
   computation to API orchestration; the engine only proposes deterministic candidate
   identities. API stamping precedes authoritative validation/approval/persistence and
   must not rewrite musical event IDs or existing source/approval references.

   The compiled schema-only first-create → approve → preferences-edit example has fresh
   IDs, correct parents and recomputed digests. My separate real-schema probe accepted
   create and existing-head mutation shapes, rejected **32** malformed head/parent
   cases, verified that header stamping preserves musical/source references, and
   detected project/revision/parent tampering with stale digests. Create-on-existing
   must atomically conflict; an edit of an absent project must conflict with null.
   These outcomes are now expressible and specified, **not implemented or executed**.
   Schema parsing is not storage absence, atomic CAS, authorization or approval proof.

2. **P2 — same-origin download boundary: resolved.**
   `src/domain/ports.ts:80–93` applies the shared `LocalDownloadPathSchema` to actual
   ready export responses. `/artifacts/current.mid` parses. All three old bypasses
   (`//example.org/x.mid`, slash-backslash-host, and slash-newline-slash-host) demonstrably
   resolve off-origin with the raw WHATWG parser and now fail both the real response
   schema and `resolveLocalDownloadUrl`. The helper parses against the actual HTTP(S)
   origin and checks the normalized final origin.

   My separate probe rejected **195 control-character cases** (all 65 C0/C1 characters
   in three positions), plus absolute/relative URLs and backslash spellings. A corpus
   of **25,612** authority-prefix, encoded, Unicode and ordinary path cases had **8,754**
   accepted paths and **zero accepted off-origin resolutions**, independently comparing
   WHATWG URL origins and helper results. Encoded slashes remain same-origin URL path
   bytes: consumers must not decode/reinterpret them as a new URL. HTTP endpoint
   redirects are not implemented or tested; CONTRACT forbids circumventing the boundary
   with an off-origin redirect. No network security implementation is claimed.

3. **Minor findings: resolved without added features.**
   Empty/reversed half-open intervals now return false. **28,561** independent endpoint
   combinations, including signed half-quarter positions and boundary equality, match
   the direct interval predicate. Literal-only rest/form/capo test descriptions now
   identify fixture/arithmetic sanity rather than claiming importer/adapter rejection.
   Complete disclosed source-grounded default melody maps may produce unapproved drafts;
   actually incomplete/conflicting selections still require resolution.

The correction changes no source/score musical schema, source mappings, rational arithmetic
or digest algorithm. The engine remains an unchanged pure synchronous port: no random
identity allocation, head lookup, clock, network or persistence was added to domain code.
The browser-target domain bundle succeeds; no importer, engine, validator or UI is claimed.

## Checks actually run

Fresh worker `bun run check`: typecheck, **32 pass / 11 todo / 0 fail**, **302 assertions**,
all **16** test-only oracle expectations, and browser-target domain build pass. Separate
probe results and reproducible source are preserved below. The eleven pending gates still
use `test.todo` callbacks that throw if merely enabled; no pending test became a fake pass.

After both exact cherry-picks, ran the **combined root check once**:

```sh
bun install --frozen-lockfile
bun run check
bun /tmp/opencode/guitar-foundation-round2-probe.mjs /home/taytay/.t3-nightly/projects/guitar-composition
npm --prefix tools/export-proof test
```

Root installation pinned eight packages; all four foundation commands and the independent
probe pass with the same counts. U02 **18/18 lightweight predicate tests** pass; those
predicates are not new artifact proof. Its previously reviewed artifact evidence remains
the authority. Checked equal stable patch IDs, ordered integration, every pre-U03 tracked
file unchanged at the integration checkpoint, clean status and `git diff --check`.
Afterward only the requested review evidence, canonical log and TODO were added/updated.

Evidence:
- [Fresh worker harness](foundation.review-round2-worker-check.json).
- [Independent worker probe](foundation.review-round2-probe.json).
- [Reproducible probe source](guitar-foundation-round2-probe.mjs), run with Bun and checkout path.
- [Combined root commands, outputs, patch identities and preservation checks](foundation.integration-check.json).
- [Worker correction and before/after regressions](foundation.review-fix.md), historical worker evidence, not self-approval.
- [Round-one review](foundation.review-round1.md), preserved byte-for-byte, not rewritten as a pass.

## Integration outcome

Both commits cherry-picked in order, without conflict or code changes:

| Worker commit | Integrated root commit | Stable patch ID |
|---|---|---|
| `21b0c40e35e06b656e983117df48969beed28063` | `1790577a89883d6a236f4bcd6bbe0c959df7824d` | `27a0f18a270997545906f306cee3615fb0e8d045` |
| `2319ed87f6177a71bcc96034b44a2e6d8f5a878b` | `68b358fad99237adc02bf30bab32574cff3e8748` | `618bdf890a75e3158403d7941d6c469ea73acc15` |

The separate review-evidence commit follows `68b358f`; its actual SHA is in repository history
and the handoff. No resets, reference-project changes, concurrent root writers, server, UI
changes or subagents. U02 code, fixtures, prior evidence and tracked artifact inputs remain
unchanged. Worker evidence saying independent approval was pending describes its earlier
snapshot; this report and the canonical log record the new bounded approval.

Contract: [`docs/CONTRACT.md`](../CONTRACT.md); authoritative runtime exports:
[`src/domain/index.ts`](../../src/domain/index.ts), schemas in `schemas.ts`/`ports.ts`.

## Remaining named gates — unchanged, not foundation passes

1. **U04/F4:** bounded importer, restrictions, unsupported effects, exact source identity and revision drift, including actual-song raw retrieval trace.
2. **U05:** actual 46→64 form expansion, jump-tie rejection, meter/tempo restoration.
3. **U06/G2:** auditioned complete intro/vocal/outro event selectors and approvals.
4. **U08/F3:** independent production sustain/finger/transition validator and search outcomes.
5. **U10/F7 / G11:** real configured provider evidence, invalid IDs/output, timeout/refusal and honest fallback.
6. **U11/F5 / G6:** audio-clock/cursor, transport/seek/muting, 60-second timing and twenty-loop drift.
7. **U12/F2:** canonical integration of U02's separate 16-written/24-occurrence export fixture and artifact audit.
8. **U12/G9:** persistence, atomic create/CAS, dependency invalidation, stale export, save/reopen.
9. **U13/F1:** original eight-bar integration fixture with shorter triplets and adapter display-octave proof.
10. **U13/F6/F8:** fresh requested-song live runner, complete melody at capo 0/2, no double MIDI transposition and actual full-song artifacts/second-player check.
11. **G5:** human guitarist transitions and complete-song musical review.

Source-grounded bass/harmony generation and stage approvals (U07/U09), production PDF/MIDI,
interactive score/TAB and clean-browser/keyboard acceptance (G1–G10) remain product work.
No product release gate or live-LLM claim passes merely because this foundation is integrated.

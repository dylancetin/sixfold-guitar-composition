# U03 review corrections — awaiting fresh independent judgment

Review input: `/tmp/opencode/guitar-foundation-review.md`, verdict **NOT VERIFIED for
integration** at `21b0c40e35e06b656e983117df48969beed28063`. This follow-up records local
corrections/checks only, **not self-approval**. Parent/fresh judge owns integration verdict.

Worktree: `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7599a70e`.
No root integration, canonical TSV updates, dependency changes, server or delegation.

## Corrections

- **P1 / first save:** one `create` mutation, `expectedHead:null`, parentless replacement.
  Existing approve/edit mutations retain nonnull CAS references. Conflict results can express
  an absent current head. CONTRACT assigns all authoritative project/revision allocation,
  parent stamping and digest computation to API orchestration around the unchanged pure-engine
  signature. Store must atomically reject create-on-existing; schema alone cannot prove absence.
  The typed/schema-only first-create → approve → preferences-edit example uses allocated IDs,
  full recomputed digests and the existing mutation ports. No store implementation or fake CAS pass.
- **P2 / downloads:** shared `LocalDownloadPathSchema` rejects network-path `//`, any backslash,
  and all C0/C1 controls. `resolveLocalDownloadUrl` also normalizes against the actual HTTP(S)
  application origin and verifies final origin. Export response uses this shared schema.
- **Minor:** `overlaps` returns false for empty/reversed intervals. Literal-only rest/form/capo
  descriptions now say fixture/arithmetic sanity rather than implying implemented export/form gates.
- **Draft flow:** a complete source-grounded disclosed default melody map may produce an
  auditionable unapproved draft. Subjective intro/outro review is not a prerequisite; genuinely
  incomplete/conflicting selectors still return selection-needed. No musical approval invented.

## Reproduction and actual results

Before logic changes, added focused regressions and ran:

```sh
bun test tests/fixtures/boundaries.test.ts > docs/evidence/foundation.review-before.log 2>&1
```

Exit **1**, **1 pass / 5 fail**: first create unavailable, each of the three reported
cross-origin spellings accepted, and empty interval incorrectly overlapping.

After corrections and focused positive/negative tests:

```sh
bun test tests/fixtures/boundaries.test.ts
node scripts/check-foundation.mjs
git diff --check
```

- Focused run: exit **0**, **9 pass / 0 fail**, 105 assertions, in
  `foundation.review-focused.log`. Covers `/artifacts/current.mid`, browser-normalized attack
  spellings, absolute/relative URLs, all 65 C0/C1 characters, actual-origin normalization,
  first-create parent/head shape, existing CAS edit shape, typed lifecycle and interval boundaries.
- Full harness: all commands exit **0** in `foundation.review-check.json`: typecheck,
  **32 pass / 11 todo / 0 fail**, 302 assertions, unchanged 16 oracle-control expectations,
  browser-targeted domain build (76 modules / 140.66 KB).
- Original evidence files remain historical; no product, storage, network, browser-audio,
  full-song or musical-review gate was upgraded. Fresh independent review remains required.

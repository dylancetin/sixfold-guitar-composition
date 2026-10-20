# A02 R1 correction — baseline agreement is not an authorship test

Reviewed root evidence: `d2a00d3:docs/evidence/agent-review-r1.md`. Correction is confined to the A02 implementation worktree based on `4a039f3`; no root checkout edits, integration, new schema/mode or model call.

- Removed unconditional candidate-equivalence rejection and its comparison helper. A factual source-reading task may retain baseline choices; neither agreement nor a one-token difference establishes model involvement or new composition.
- Retained strict plan/source-note/unique-ID checks, exact raw plan-byte SHA-256, strict receipt and source/request bindings, and explicit plan+receipt versus deterministic baseline selection.
- Corrected agent/brief/workflow guidance: describe retained choices as **model-reviewed/selected baseline**, not invented new composition. Parent attestation and independent inspection of the actual task/reasons remain necessary; synthetic receipts only test boundaries. Existing prepared runs and pending musician output were not changed.

## Failing-before / passing-after regression

Added `baseline agreement accepts a bound task receipt, but never infers model involvement without one` using an original fixture, **exactly unchanged baseline JSON**, and a conspicuously synthetic receipt.

| Check | Observed result |
| --- | --- |
| `bun test tests/agent --test-name-pattern 'baseline agreement accepts'` before production correction | **0 pass / 1 fail**, rejected by old `Baseline-equivalent choices cannot be relabeled AI-authored` rule |
| Same command after correction | **1 pass / 4 assertions / 0 fail**: accepts exact baseline with bound receipt, preserves bytes/accepted IDs, rejects missing receipt and publish plan without delegation |
| `bunx tsc --project tests/agent/tsconfig.json` | Exit 0 |
| `bun test tests/agent` | **14 pass / 78 assertions / 0 fail**, retaining raw-hash/source/request/unknown-ID negatives and explicit deterministic `agent:null` coverage |
| `git diff --check` | Exit 0 |

No actual musician authorship, full-song artifact or integration gate is newly claimed. Independent re-review remains the parent's next step; the original R1 review is unchanged.

# Explicit notated-pitch bend draft

Date: 2026-10-27. The arrangement user requested a practical workaround after
an unsupported-source failure. One selected vocal bend blocked preparation.
The parent disclosed before preparation that the scoop would be simplified to
its notated starting pitch, not silently removed or claimed faithfully reproduced.

## Boundary

- Default import/selection behavior remains unchanged: selected bends carry an
  unsupported melody-affecting effect and block the proposed selection.
- `prepare-arrangement.ts --simplify-bends` explicitly opts into a simplified
  notated-pitch draft. No website generator/settings/provider flow was added.
- Known bend keys, finite bounded values, ordered point positions and complete
  endpoints are validated before simplification. Unknown/malformed curves fail.
- Source notes retain their notated pitch, onset, full duration and raw refs;
  `source-bend-simplified` retains the curve and explicitly identifies omitted
  pitch motion. The stamped source digest binds this interpretation.
- Diagnostics, actual musician briefing and published notes disclose the
  simplification. Checks preserve that interpretation, not expressive fidelity.

## Evidence

- Original-only `tests/source/bend.test.ts`: default blocking, opt-in exact
  notated pitch/time and curve retention, malformed/unknown negative controls.
- `bunx tsc --project tests/agent/tsconfig.json`: passed.
- `bun test tests/source tests/agent`: 139 passed, zero failures.
- `bun run check`: passed (including real adapter tests and viewer build).
- A real GPT-6.1-Sol xhigh musician task selected a sparse source-grounded
  reduction; the parent wrote the receipt from the actual task and exact plan
  bytes. A separate GPT-6.1-Sol xhigh judge independently inspected raw source,
  full selected melody/rest/form facts, provenance, static physical constraints,
  all seven actual PDF pages and exact MIDI note/tempo events. It passed the
  explicitly simplified **unreviewed draft**, not human playability or approval.
- Exact viewer/PDF/MIDI HTTP links returned 200, expected MIME and byte-identical
  canonical downloads. Full source, plans, receipts, checks and exports remain
  ignored/local; this evidence document contains no full-song transcription.

Human audition, instrumental outro interpretation, movement calibration and
guitarist approval remain pending. No final playable-release claim is made.

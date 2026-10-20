# Independent U04 source review — 2026-10-20

**VERIFIED and integrated: bounded Songsterr import and complete unapproved melody proposal.**
No blocking corrections. Musical-selection approval and the full solo-acoustic product
remain **NOT VERIFIED**. Reviewer: independent GPT-6.1 Sol; no additional subagents.

Reviewed `95e2b753b5bf191f23066abf46a04de1e2f758e6` and
`e081e61ba4014aab9fe1f7ddf0c1160ae6156065` in worker
`/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7364a0c1`.
Read the public barrel, every source implementation/test file, reference importer,
`docs/CONTRACT.md`, `source-u04.md`, and `source-live-facts.json`; inspected actual
raw page/part bytes and canonical documents rather than accepting the worker summary.
Root started clean at `ce201e04fd0e10bff826731ac77152ff76faafdc`; worker and reference
were clean. The reference remains read-only at `15e6e75b123c7e2426f6ec5376f241d1c14b4153`.

## Findings independently verified

- **Actual source identity:** requested song 692866, upstream revision 847990,
  format 5, eleven parts, 46 written 4/4 bars / 184 quarters. Original source-file
  SHA-256, byte length, revision digest, and all twelve raw artifact hashes match
  the worker's committed manifest. Fresh acquisition from integrated root succeeds;
  all eleven raw **part** hashes match the original acquisition. Dynamic page bytes,
  retrieval timestamp, provisional ID and document digest can differ across imports.
- **Exactness:** a separate BigInt rational implementation reconstructs every raw
  attack/rest, pitch, onset, tie adjacency, merged duration and complete original ref
  (including string/fret) for all eleven parts. No canonical event is added or lost.
  Part 0 has **154 raw pitched refs / 141 merged attacks**; triplet bars are
  **6, 8, 9, 18, 20, 21, 29**. Part 7 has 948 slots / 496 attacks; parts 8/9
  retain 174 each without register edits. Six actual reference `importSong` calls
  and independent `normalizeTrack` replay agree, without warnings, on the relevant
  beat identities, pitch members, fractions and onsets.
- **Bar 5:** opening pitches are 54, 59, 61, 63, 64, 63 at quarters
  16, 17, 18, 37/2, 19, 39/2; durations are 1, 1, 1/2, 1/2, 1/2, **1**.
  The last attack includes its tied continuation in bar 6 and both refs, not a
  retrigger or a truncated eighth. Fresh live literal checks pass.
- **Form/tempo:** written repeats remain 5–7 ×2, 17–19 ×2, 43–46 ×4, with all
  five tempo points intact. This unit does not expand the 64-occurrence / 256-quarter
  downstream performed form or claim jump-tie validation.
- **Selection:** exact complete map is part 1 at bars **1–4 and 34–37**, part 0
  elsewhere except **bar 42**, which explicitly preserves its four-quarter source
  rest with provenance. Every one of the 141 part-0 attacks, including the final
  attack, survives unchanged. Every part-1 event in the proposed fallback ranges
  survives too: there are **no overlapping omitted alternatives in this actual map**.
  Independent interval tiling proves no gaps, duplicates, clipped events or polyphony
  across 0–184. The original fixture separately exercises explicit upper-line choice
  in genuinely polyphonic material. Production code contains no acceptance-song ID
  or hardcoded song-note array; changed source identities/music are covered by original
  fixtures. Website default part 2 does not become melody.
- **Unsupported constructs/key:** the actual selected lines have no unsupported
  melody-affecting effects. Unsupported effects are retained and block a proposed
  chosen line, as independently demonstrated with a slide corruption. Percussion is
  explicitly excluded from pitched-melody semantics; irrelevant raw-only percussion
  is disclosed, not allowed to erase pitched source. Key stays **unknown**; inferred
  sharp spelling does not establish B major. Other unsupported versions/form/effects
  remain errors or explicit selection-needed outcomes, not generalized format support.
- **Identity clarification:** approved parent decision is clearly documented in
  `src/source/README.md`, import diagnostics and worker evidence. Import is a
  schema/digest-valid **provisional** document. API allocates project/revision identity
  and parent, schema-parses and rehashes **before saving or creating the selection**;
  it must preserve musical event IDs. A separate stamping/rebinding probe passes.
  No domain edit is needed or made. Actual API persistence is not implemented here.
- **Meaningful transport boundaries:** offline suite covers public host policy,
  manual redirects, denials/private flags, bounded streams and aborts. Independent
  controls additionally exercise an alternate-CDN redirect before destination fetch,
  wrong MIME, declared response size, the cumulative 32 MiB limit, and a genuinely
  stalled body: the 15-second timeout cancels it after **15001 ms**. Nine independent
  in-memory corruptions of actual captured data test orphan ties, contradictory
  rhythm, missing pitch, nested repeats, endings, grace timing, part structure drift,
  private data and a relevant unsupported pitch effect. No partial pitched result or
  silent melody substitution is accepted. This is scoped verification, not an
  exhaustive unrelated security audit.

## Commands and durable evidence

Run from root unless the command names another directory:

```sh
bun install --frozen-lockfile
bun run check
bun scripts/probe-source.ts --live --compare-reference --out tests/source/.local/review-live
bun docs/evidence/source-review-probe.mjs . /home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7364a0c1/tests/source/.local/live --manifest
bun docs/evidence/source-review-probe.mjs . tests/source/.local/review-live
bun docs/evidence/source-review-transport.mjs .
npm --prefix tools/export-proof test
```

All exit 0. Worker `bun test tests/source` gives **46 pass / 0 fail / 403 assertions**;
worker `bunx tsc --project tests/source/tsconfig.json` passes. Root aggregate repeats
those checks plus **32 foundation pass / 11 pending**, 16 test-only oracle expectations,
and the browser-domain build. Source-field probes perform 22,343 original-manifest
assertions and 22,338 fresh-import assertions; those are per-field assertions, not
that many distinct corruption tests. Reference scoped command
`bun test src/server/songsterr.test.ts` gives **45 pass / 6 skip / 0 fail**.
U02's 18 lightweight predicates pass; no heavy export artifacts were regenerated.

- [Aggregate root check and captured outputs](source-review-root-check.json).
- [Independent original-artifact result](source-review-probe.json),
  [fresh root result](source-review-fresh-probe.json), and
  [reproducible checker](source-review-probe.mjs).
- [Independent transport result](source-review-transport.json) and
  [reproducible controls](source-review-transport.mjs).
- [Integration, stable patch IDs, fresh part hashes and reference comparisons](source-review-integration.json).

**Root coverage correction:** added only `check:source` to `package.json` and its
required inputs/invocation to `scripts/check-foundation.mjs`. `bun run check` now runs
the strict source tsconfig and all 46 source tests; missing source inputs cannot
silently skip them. UI/root script owner must retain that hook when expanding its
aggregate check. No root tsconfig ownership change. Bare `bun test` is **not** the
release command: it also discovers the independent `tools/export-proof` npm package,
whose dependencies and test runner are separate. No test was disabled to obtain a pass.

## Integration and remaining gates

| Worker commit | Root commit |
|---|---|
| `95e2b753b5bf191f23066abf46a04de1e2f758e6` | `b264d9fea96613452bc68112f51fc798428801f9` |
| `e081e61ba4014aab9fe1f7ddf0c1160ae6156065` | `8a13d0a700f024e15f9d31ba17073837af4d6bf9` |

Exact ordered cherry-picks, matching stable patch IDs, no conflict or source edits.
Neither pick changes any preexisting tracked file. Domain, contract and U02 remain
unchanged; root coverage/review/log/TODO changes are in the following separate evidence
commit. No reset, discarded user work, reference writes, UI changes or extra agents.
Copyrighted complete raw/score/proposal documents remain only in ignored `.local/`
directories; committed evidence contains technical facts/checkers, not complete song fixtures.

**Still open:** musician audition and approval of primary/intro/interlude/outro choices,
actual difficulty/capo prompting and comparison, arrangement feasibility and target-tempo
guitarist review, performed-form implementation, UI/playback, and canonical full-song
PDF/MIDI acceptance. Passing source import is not approval of those choices or a claim
that the full melody-preserving solo-acoustic arrangement has shipped.

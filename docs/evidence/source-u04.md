# U04 source adapter — implementation evidence

Approved base: `ce201e0`. Scope: `src/source/**`, `tests/source/**`,
`scripts/probe-source.ts`, `docs/evidence/source-*`. No domain, engine, form
expander, server, UI, package or reference changes. No subagents or new deps.
Implementation/original-fixture unit: `95e2b75`.

## Interface / identity decision

`songsterrSourceAdapter: SourceAdapter` and
`createDefaultMelodySelection(source)` are public at `src/source/index.ts`.
The optional factory accepts transport/raw-sink dependencies for the API and
offline tests, without forking `ImportInput` or canonical music types.

Parent explicitly confirmed the minimal identity clarification on 2026-10-20:
the adapter returns a schema/digest-valid provisional import document. The API
allocates project/source revision identity and parent and recomputes digest
**before saving or generating the default selection on the stamped source**.
No canonical fields were added. Its diagnostic is informational, not an error
claiming corrupt/stale music. Full interface/security/retention details:
[`src/source/README.md`](../../src/source/README.md).

## Grounding and adaptation

Read authoritative `docs/CONTRACT.md`, all `src/domain/**`, both grounding
reports in this repository and `/tmp/opencode`, and the read-only reference
importer/model/tests/timeline/conversion documentation. Reference HEAD:
`15e6e75b123c7e2426f6ec5376f241d1c14b4153`, clean before and after the work.
`src/source/NOTICE.md` retains provenance and licensing caveats.

Adapted the proven page → state → current metadata → discovered CDN path,
not a new general scraper. Corrected the reference's 403 alternate-host retry,
stripped flags, floating time and discarded raw note/effect data. No CDN token,
acceptance-song ID or note array is hardcoded in production adapter/helper.
The live **acceptance script**, deliberately, has the requested song's literal
identity, count, repeat, tempo and bar-5 opening oracles.

## Executed checks

Reproducible commands, all exit 0:

```sh
bun install --frozen-lockfile
bunx tsc --project tests/source/tsconfig.json
bun test tests/source
bun run check
bun scripts/probe-source.ts
bun scripts/probe-source.ts --live --compare-reference
```

The source-specific strict tsconfig is intentional: the approved root tsconfig
and `bun run test` only include U03 files. Integrator should include source tests
and types in its final aggregate check; the source unit does not edit that
owner's package/tsconfig. `source-checks.json` records actual command outputs.

Additional broad discovery control: bare `bun test` finds the independent
`tools/export-proof/test` harness and fails because that separate package's
`midi-file` dependency is not installed in this checkout (**78 pass, 11 todo,
1 harness-load failure**). This is not hidden as a passing aggregate run. The
owned integration command `bun test tests/fixtures tests/source` passes without
installing out-of-scope export dependencies.

Offline source suite: **46 pass, 0 fail, 403 assertions**. Tests use
independently authored four-bar music with different song,
revision, part identities and literal rational expectations: primary part **4**,
polyphonic intro part **6**, wrong website default **2**. No copyrighted raw
fixtures are committed. They cover malformed/private URLs, unknown input/song,
missing access flags, private CDN data, unsafe redirects/token traversal,
schema drift, v5/v8 checked subsets, malformed/rhythm/tie errors, exact triplets,
merged unison/tie refs, unsupported effects, raw-only irrelevant percussion,
explicit source-silence decisions, bounded streams/storage, abort and wrong
default track. Unsupported effects in a proposed line fail rather than silently
dropping melody. The reference tests independently reran: **53 pass, 6 skip,
0 fail**, with no reference edits.

## Actual song, not a summary-only success claim

Optional live acquisition succeeded unauthenticated for song **692866**, upstream
revision **847990**, player format **5**. Both runtime SourceScoreV1 parsing and
recomputed revision digest passed. All **11 part identities**, **46 written
4/4 bars / 184 quarters**, five score tempo points and all raw page/part hashes
were checked. Percussion has explicit unsupported melody semantics, not silently
pitched guitar interpretation. A missing/unsupported irrelevant percussion part
does not erase the pitched source. See `source-live-facts.json` for hashes and facts.

Independent raw-byte checks, not adapter self-counts, verify **each** original
note/rest ref exactly once, source pitch/string/fret, original whole fraction,
attack offset, full voice rhythm and sum of merged tie durations. Literal checks:

- Part 0: **154 raw note slots / 141 merged attacks**, triplet bars
  **6, 8, 9, 18, 20, 21, 29**. First attack is at written quarter 16 (bar 5).
- Bar-5 pitches: **54, 59, 61, 63, 64, 63** at starts
  **16, 17, 18, 37/2, 19, 39/2**. Merged durations:
  **1, 1, 1/2, 1/2, 1/2, 1**. The last duration is **1**, not **1/2**,
  because its second raw eighth is tied from bar 6. Both refs survive.
- Part 7: **948 raw slots / 496 merged attacks**; parts 8 and 9:
  **174 slots/attacks each**, low source bass register preserved without revoicing.
- Repeat sections **5–7 ×2, 17–19 ×2, 43–46 ×4**, retained written, not unfolded.
  Expected downstream oracle is 64 occurrences/256 quarters; U04 does not expand it.
- Actual reference `importSong` calls for **0, 1, 2, 7, 8, 9** returned zero
  warnings and agree on **every beat identity, note/chord pitch, duration and
  attack onset**, plus counts/46 bars. Reference fetches are guarded against
  alternate hosts/access denials. This is stronger than comparing self-summaries.

## Complete unapproved proposed section map

- Bars **1–4: part 1 / p1:v0**, explicit 17 note/rest event IDs.
- Bars **5–16, 17–33: part 0 / p0:v0**, complete merged events/rests.
- Bars **34–37: part 1 / p1:v0**, explicit 17 note/rest event IDs.
- Bars **38–41: part 0 / p0:v0**.
- Bar **42: intentional four-quarter silence**, source-rest ID retained in
  proposal provenance/reason. No invented fill.
- Bars **43–46: part 0 / p0:v0**, outro choice disclosed and unapproved.

The live checker independently tiles all selected events/intentional rests:
**0–184 written quarters, no gap, overlap, duplicate or clipped event**.
All **141 part-0 attacks**, including final attack, remain selected. Ties and
triplets are unchanged. Part 1's unused polyphonic passages remain in source;
the original polyphonic fixture separately verifies explicit event-level choice.
Role ranking is disclosed evidence, not a musician's subjective approval.

## Engine handoff / copyrighted local artifacts

Actual verified source:
`/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7364a0c1/tests/source/.local/live/source.json`

Full proposal with selectors, intentional rests and provenance:
`/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-7364a0c1/tests/source/.local/live/melody-proposal.json`

Sibling `summary.json` and `raw/{song-page.html,part-0.json,...,part-10.json}`
retain the complete acquisition trace. `tests/source/.gitignore` ignores `.local/`;
probe refuses output outside that ignored subtree. Public technical access does
not establish score redistribution permission. No copyrighted score is embedded
in committed fixtures or evidence. API must restamp source/selection identities
before persistence; engine can use these local provisional documents for development.

Warnings: unknown key (B major remains a user hypothesis), inferred sharp display
spelling, accents/ghost dynamics retained but expressive playback not implemented,
unpitched percussion explicitly unsupported for melody, primary/fallback/outro
role decisions unapproved. The source format is private/unstable; other versions,
effects, grace timing, swing, endings, nested/overlapping repeats and malformed
data fail explicitly. File uploads are a separate adapter. No guitar feasibility,
human approval, full performed form, rendering, playback or export claim is made.

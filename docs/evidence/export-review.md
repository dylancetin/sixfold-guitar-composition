# U01/U02 independent integration review — 2026-10-20

**VERIFIED: bounded original synthetic export foundation only.** No serious U02
gate failure found. The requested complete Beach Boys s692866 arrangement/app is
**NOT VERIFIED**; source audition and guitarist acceptance remain **INCONCLUSIVE**.
Reviewer: independent GPT-6.1 Sol, intentionally the same model family requested
by the parent; no cross-family/arena review or subdelegation is claimed.

- Reviewed exact worker commit `9217c32d36bd22f04a6fc505271b24fcb5d8e6ab`.
- Cherry-picked unchanged onto clean planning HEAD `25b1aead108fcf867108fa48f56700598f89e6a2`
  as `c1d93ee91745c710c8ae803bb102e1bbec266b93` (equal stable patch IDs).
- No application code, root dependency/schema changes, or concurrent foundation
  worker changes were added. This review/evidence is committed separately.

## Independent checks actually performed

Read both literal TSVs, expected form/tempo JSON, adapter, independent checkers,
predicate tests, real outputs, worker report/log and the prior architecture review.
The sounding oracle contains literal merged intervals, not calls into the adapter.
The predicate self-baseline is not artifact proof. Neither MIDI nor PDF acceptance
imports the exporter; PDF acceptance parses actual bytes rather than trusting the
generated pagination manifest.

Fresh worker run (Node 24.12.0) before integration:

```sh
# From the worker's tools/export-proof directory:
node run.mjs /tmp/opencode/guitar-u02-judge-9217c32
node /tmp/opencode/guitar-u02-independent-judge.mjs
# From the integrated root's tools/export-proof directory:
npm ci --no-audit --no-fund
node run.mjs /tmp/opencode/guitar-u02-integrated-c1d93ee
```

Both proof runs passed **18/18 predicates**, actual artifact verification and all
**nine actual corrupted-file rejections**. Evidence roots above contain
`negative-controls.tap`, `generation.json`, `verification.json`, `verification.log`
and `unit-log.tsv`. The first also contains `independent-judge.json`,
`review-hashes.json` and `source-audit.json`. Historical unit log:
[`tools/export-proof/unit-log.tsv`](../../tools/export-proof/unit-log.tsv).

The separate temporary judge script imports neither adapter nor worker acceptance
functions. It independently reconstructs notation timing/string pitches from the
engraving TSV, merges only contiguous same-role/string/pitch ties, and matches the
separate literal oracle **including roles**. Observed tie destination ticks:
15,360 (melody 67), 23,040 and 38,400 (bass 42), 61,440 (melody 66).
Triplet segments are exactly 640/320 ticks, with no note-time tolerance.

Both `midi-file` and Tone MIDI independently match the actual complete sounding
union: **152 attacks = 76 melody + 36 bass + 40 harmony**. Actual files are SMF 0,
PPQ 960, 2,089 bytes, program changes only 24, balanced on/off pairs, ten exact
tempo entries, and actual final note-off **and track end** at 92,160 ticks / 96
quarters. Independent tempo integration gives **63.473184 seconds**, agreeing with
Tone after declared integer-microsecond flooring. Role counts describe the oracle
partition, not proven interactive role muting. Two parsers are **not two players**.
Capo 0/2 MIDI bytes are identical, SHA-256
`6454cfaedcba9a2407580c12aeabdc387dc8b88225ac910716dd7f41814d33fa`.

All **156 notation placements per capo** satisfy sounding = open tuning + capo +
relative fret; physical neck fret = capo + relative fret; written = sounding + 12.
First high-E note is sounding 66 / written F#5 (78): relative fret 2 at capo 0,
0 at capo 2. PDF.js measures the actual head on the top treble line, error below
0.000012 pt, and correct glyph scale. Sampled TAB frets agree with those pitches.

All **18 PDF pages** were parsed/rasterized: A4 3/3/3/3 complete systems, Letter
2/3/3/3/1, at both capos; 12 systems and O01–O24 exactly once per PDF, correct
source/pass labels, embedded Bravura, staff plus six-line TAB, intact final double
barline, and 100% sampled raster line coverage. Source inspection confirms complete
system bounds are checked before packing and over-height units throw rather than
clip. Raster review opened A4 pages **1/3/4** and Letter **1/3/5** for **both capos**:
readable notation/TAB, 3:2 tuplets, rests, independent sustain, cross-system/page ties
and final bar. All 18 fresh rasters are byte-identical to the worker's reviewed
artifacts. An enlarged O05 comparison confirmed incoming melody ties at both capos.
Repeated native capo captions and the sparse Letter last page remain cosmetic.

Actual negative bytes were reopened with the same acceptance checks: final melody
pair removed, +12 MIDI, unmatched off, stale O09 tempo, native double-capo +2,
fontless PDF, omitted final system, clipped final TAB and staff-only PDF. Rejections
respectively hit interval equality, pair balance, tempo equality, clef/TAB/font
content, bar coverage and **raster line coverage despite retained PDF text**.
The judge separately confirmed the intended MIDI mutations really changed exactly
the stated intervals/tempo; the malformed off genuinely fails pairing.

## U01 preservation and limits

The feasibility and design reports are preserved **byte-for-byte**, not rewritten
as current completion claims: [feasibility](guitar-feasibility.md),
[architecture challenge](guitar-design-review.md). SHA-256 respectively:
`843b6ebeb7b972a707d7db1a565a6287e713c12d1ddd821cbd5bcd0e2cc1ba46`,
`782d91a95bd7612695856361fb3085666ff1c1e2bfb5d9110c44ac3666fdf673`.
Their earlier excerpt/U02 criticism is historical; current full-song scope lives
in `docs/WORKFLOW.md`, and this review closes only the synthetic U02 experiment.

Independently reopened all six existing local normalized parts (0/1/2/7/8/9):
song 692866, revisionId 847990, 11 tracks, 46 measures each and no stored warnings.
Repeat markers agree with 64 occurrences. Reparsed the 183-byte/five-attack probe
and the actual 8,661-byte/957-attack diagnostic MIDI (124.405572 s, flat written
form, not solo guitar). Diagnostic SHA-256 remains
`725fbd62ed801770c36a1712fcba5ac0ea2cea9dc8ff68aeedebc0e547f8b7f2`.
No fresh source fetch or reference tests were rerun here. Initial judge code used
`song.revision`; inspection corrected it to actual `song.revisionId` before rerun;
that was a judge assumption failure, not an exporter failure.

No complete copyrighted song fixture is committed. Local normalized JSON and
diagnostic bytes remain under `/tmp/opencode/guitar-probes/`; their hashes and
metadata are in `source-audit.json`. The generic `songsterr.html`/part0 raw files
are another song, so an actual-song raw retrieval trace remains required at U04.
Stored zero warnings do not prove the old importer lossless or restriction-safe.

## Next review contract / open gates

**Ready for U03 contract review, not foundation integration or feature fan-out.**
The concurrent foundation worker is not reviewed/integrated by this task. Require
concrete runtime schemas for exact rational time, sounds vs notation/ties, source
and occurrence identity, entry tempos, capo/string/written-octave conventions,
placements/held-hand states, revision digests/locks/approval invalidation, and
explicit unsupported/search-exhausted results. Require literal negative fixtures
before accepting its clean install/check/build gate.

Still open: full-song auditioned section/voice/event selector (including intro and
outro), melody→bass→harmony approvals, physical validator and difficulty profiles,
64-occurrence product schedule, stable display/event mapping, role muting, actual
browser playback/readiness/cursor/seek, revision-safe downloads/save, second-player
audition and human guitarist review. U02 does not pass product G1–G10 or live G11.

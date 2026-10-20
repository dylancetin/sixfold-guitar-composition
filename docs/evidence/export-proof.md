# U02 — original multi-page export proof

**VERIFIED for the bounded original fixture, including capo 2. Not a product
release or human-playability claim.** Parent artifact review remains separate.

Worktree: `/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-357dc8b1`
Branch: `t3/bounded-export-proof-u02`.
Only `tools/export-proof/**` and this report are owned/changed. No root package,
application schema, importer, canonical decision log, or preview server changes.

## Reproduce

```sh
cd /home/taytay/.t3-nightly/worktrees/guitar-composition/t3-357dc8b1/tools/export-proof
npm ci --no-audit --no-fund
npm test
npm run proof
npm run verify
```

Node 24.12.0 / npm 11.6.2 / Linux x64. Package versions and lockfile are committed.
Output root **R** below is the actual local, git-ignored directory:

`/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-357dc8b1/tools/export-proof/artifacts`

Use `node run.mjs /tmp/opencode/another-run` and
`node verify-artifacts.mjs /tmp/opencode/another-run` for a separate run.
The current script regenerates everything; no temporary research module is
required. PDF metadata timestamps can change PDF hashes on a later run.

## Fixture and verification-first design

New original CC0 fixture **Copper Steps**, revision `u02-original-24-v1`:
16 distinct source bars, **24 explicitly written performance rows**, 96 quarters.
Form is literally `1–8,5–8,9–16,13–16`. No repeat commands enter alphaTab, and
no exporter interprets repeat semantics. Every occurrence retains source/pass
labels. Entry tempos restore 120→96 and 72→104 at the two jumps. Four ties cross
bars/systems (including bass), quarter/eighth 3:2 tuplets, rests, independent
bass/harmony sustain, sparse chords and final full-bar notes are present.

Before the adapter, the independent literal sounding-event oracle and negative
predicate tests were written. `fixtures/oracle.tsv` contains pitches, rational
onsets and merged durations, **not output derived from the fingering adapter**.
`fixtures/engraving.tsv` independently supplies notation and string/fret choices.
Both files and the literal form/tempo expectations are inspectable in the commit.
`checks.mjs` and `pdf-check.mjs` do not import the alphaTab adapter.

## Measured results

- **18/18** verification-first predicate tests passed (`R/negative-controls.tap`).
- Each real MIDI: **2,089 bytes**, SMF Type 0, PPQ **960**, **152 attacks**
  (76 melody, 36 bass, 40 harmony), 156 notation segments / four tie destinations,
  ten exact integer tempo entries, acoustic nylon-guitar program **24** only.
  Both independent parsers (`midi-file`, `@tonejs/midi`) match every literal
  `(pitch,onset,duration)`; note-on/off pairs balance. Final note-off and track
  end are **92,160 ticks / 96 quarters**, duration **63.473184 seconds** after
  declared microsecond-tempo flooring. No note-time tolerance is allowed.
- Both capo MIDI files are **byte-identical**, SHA-256
  `6454cfaedcba9a2407580c12aeabdc387dc8b88225ac910716dd7f41814d33fa`.
- **12 complete combined staff+TAB systems** per PDF; all bars O01…O24 appear
  exactly once. All **18 PDF pages** across the four files were independently
  parsed and rasterized with PDF.js; Bravura subset data is embedded (18,956
  bytes as exposed by PDF.js). No SVG conversion warnings.
- A4: four pages, system counts **3/3/3/3**. Capo 0 PDF **38,680 bytes**;
  capo 2 **38,900 bytes**. Glyph counts per page **73/64/67/63**.
  Drawing-operator counts capo 0 **3248/2743/2808/2677** and capo 2
  **3344/2743/2808/2677**.
- Letter: five pages, system counts **2/3/3/3/1**. Capo 0 PDF **39,687 bytes**;
  capo 2 **39,894 bytes**. Glyph counts **49/68/65/65/20**.
  Drawing-operator counts capo 0 **2217/2921/2675/2788/892** and capo 2
  **2313/2921/2675/2788/892**. The sparse final page is intentional whole-system
  packing, not a blank extra page.
- Every actual staff/TAB line's 30 raster sample positions had **100% coverage**.
  All page ink stays inside the page. Final staff, TAB, O24 label and double
  barline are visible. Complete-system bounds are verified before pagination;
  over-height systems reject rather than clip.

Primary parsed evidence: `R/verification.json`. Full generated-input digests and
versions: `R/generation.json`. Per-file hashes and all page text/fonts/line groups,
notehead geometry, raster bounds and rejection reasons are in the verifier output.

Clean staged-source snapshot check also passed: copied the Git index (without
`node_modules` or ignored outputs) to `/tmp/opencode/u02-clean-snapshot/`, then ran
`npm ci --no-audit --no-fund`, `npm test`, and `npm run proof` in its
`tools/export-proof` directory. It reproduced the 18 test passes, 152 attacks,
all 18 positive PDF pages, and nine rejected actual negative artifacts. Independent
results: `/tmp/opencode/u02-clean-snapshot/tools/export-proof/artifacts/verification.json`.

### Capo / guitar octave proof

All 156 segment placements satisfy
`sounding = openTuning + capo + relativeFret` and
`physicalNeckFret = capo + relativeFret`, at both capo settings. Capo 2 uses two
fewer relative frets, not transposed sounding notes. First note: high E,
capo 0/fret 2 = capo 2/fret 0 = **MIDI 66**, physical neck fret 2.

Native `staff.capo=2`, `transpositionPitch=0`,
`displayTranspositionPitch=-12`. Written guitar pitch is **MIDI 78 / F#5**.
PDF.js independently places that first notehead on the treble top staff line:
error less than **0.000012 point** in every PDF. The actual glyph size also
matches the page transform, guarding the SVG px/viewport trap. `Capo 2` appears
in title/subtitle and every page header; native relative TAB starts at 0.

Actual wrong native projection (`capo=2` plus `transpositionPitch=-2`) sounds two
semitones too high and is rejected by the literal MIDI oracle. Evidence:
`R/negative-double-capo.mid`, `R/capo-2/placements.json`.

### Actual corrupted-file controls

The script also generates and rejects **nine real files**, not only mock summaries:

1. Deleted final melody attack/off pair: exact literal interval mismatch.
2. Whole MIDI +12: exact interval mismatch.
3. Unmatched note-off: balanced-pair check.
4. O09 tempo left at 120 rather than restored 96: literal tempo-map mismatch.
5. Native double capo shift: exact interval mismatch.
6. Valid PDF without the embedded music font: missing treble/music glyphs.
7. Valid PDF omitting the final complete system: all-bar/final-bar check.
8. Actual PDF clip hiding the final TAB while retaining text/operators: **raster
   line-coverage check** rejects it.
9. Staff-only PDF: TAB-glyph/system check.

Paths/rejection messages: `R/verification.json#negativeControls`,
`R/negative-*.mid`, `R/negative-*/A4.pdf`. Predicate tests additionally reject a
middle melody omission, missing triplet/harmony, tie retrigger, truncated form,
short sustain, stale PDF revision, absent capo label, and synthetic page loss.

## Raster inspection (implementation agent, not a separate judge)

Opened and inspected these actual generated PNGs for **each capo 0 and 2**:

- `R/capo-{0,2}/A4-raster/page-01.png`, `page-03.png`, `page-04.png`.
- `R/capo-{0,2}/LETTER-raster/page-01.png`, `page-03.png`, `page-05.png`.

Observed readable staff and six-line TAB, triplet 3 glyphs, sharp signs, rests,
cross-system continuation ties, independent-duration noteheads, source/pass labels,
tempo restoration labels, and intact final bar/double barline. Capo-2 relative
frets are visibly two below capo-0 while staff notes stay unchanged. No missing
glyph boxes or cut systems were observed. This is visual inspection of a
synthetic artifact, **not a guitarist review**.

Shared capo-2 A4 first-page raster:
[Nextcloud evidence](https://nextcloud.tail750ac6.ts.net/s/m4eWHAjJwtDiJpG).
Uploaded PNG SHA-256:
`028427566216556d76a648c06da775a77ad6c6967363fb2f1c847a97071efdb1`.

## Hypothesis / change / measure corrections

The hypothesis was that the already-tested alphaTab→SVG→PDFKit route could
preserve explicit form, multi-voice notation and real MIDI across multi-page
exports within the three-hour U02 timebox. No library comparison was reopened.

1. Early predicate-run readiness: Tone MIDI is CommonJS in this Node environment;
   switched its named import to the default module export. A deliberately guarded
   triplet mutation initially used the wrong tick (4160 instead of 4480); its
   **must-actually-mutate** assertion failed, and the control was corrected before
   artifact generation. No failed control was relabeled a pass.
2. Initial export geometry inspection exposed **implicit 0.75 SVG px scaling**:
   changing SVG-to-PDFKit viewport dimensions did not scale explicit SVG roots.
   Corrected only the owned PDF transform, using `assumePt:true`. The independent
   glyph-size/top-staff-line checks now measure the actual PDF geometry.
   Historical initial bytes: `/tmp/opencode/u02-export-initial/`.
3. First PDF raster attempt failed in canvas clipping because an explicit canvas
   1.0.2 and PDF.js's nested canvas 1.0.12 supplied incompatible Path2D instances.
   Pinned/deduplicated canvas **1.0.12**. Readiness failure preserved in
   `/tmp/opencode/u02-readiness-failed-artifacts/verification.log` and
   `/tmp/opencode/u02-raster-readiness-failure.log`.
4. Two PDF-check assumptions, not the export, were wrong: TAB lines are fragmented
   around fret digits (a 60-point segment cutoff missed a visible six-line group),
   and a one-system Letter final page legitimately has only 20 glyphs. Raster
   inspection showed the complete lines/final bar. Corrected the checker to
   recognize shorter non-ledger segments and require glyphs **per complete system**,
   adding exact treble/TAB glyph counts and actual raster line coverage instead
   of weakening bar/system coverage. Prior failed measurement:
   `/tmp/opencode/u02-export-corrected/verification.log`. The new real clipped
   and staff-only PDF controls demonstrate rejection with the corrected checker.

Parent-ready local TSV rows: `tools/export-proof/unit-log.tsv`; final generated
run rows: `R/unit-log.tsv`. Canonical `docs/decisions.tsv` was not edited.

## Remaining limits / defects

- Cosmetic: alphaTab emits its native “Capo. fret 2” caption once per voice
  (three times); the explicit page/title capo label remains correct.
- Letter's fifth page holds one complete system and substantial whitespace.
  No optimal packing/engraving-quality claim is made.
- This route is verified only for the pinned, explicit original fixture. It is
  not the requested song, generic repeat handling, a domain contract, revision
  approval safety, interactive score/audio, role muting, or complete app.
- No audible check in a second MIDI player, no browser audio/cursor readiness,
  no musician playability review, and no independent human/agent judge. Two
  independent MIDI **parsers** must not be reported as two players.
- License inventory is direct-package evidence, not a complete legal/transitive
  license audit. Generated Bravura embeds retain the copied OFL notice. See
  `R/license-inventory.json`, `R/Bravura-OFL.txt`, and package README.

All required bounded automated export checks pass; the known issues above do
not justify a new library comparison. Later application/release gates remain open.

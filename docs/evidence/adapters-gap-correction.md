# U11/U12 generated-gap correction above `6f1f455`

The effective-tempo correction remains a separate commit. This adapter-only change
fixes generated silence; it does not alter any canonical sound, pitch, duration,
placement, notation segment, selection or source revision. No root integration.

## Minimal correction and independent regression

Pinned alphaTab 1.8.4 applies one or two dots, but ignores three dots. The old gap
candidate generator included three-dot rhythms and selected a half-note/three-dot
3:2 tuplet for an ordinary 5/2-quarter silence. Native duration was **1,280 ticks**
instead of **2,400**. The exact native guard correctly rejected, including MIDI
downloads that require engraving representability.

The generator now permits only supported 0/1/2-dot candidates and prefers ordinary
rests before tuplets. It splits 5/2 into a half rest plus eighth rest: **1,920 + 480
= 2,400 ticks**. Exact PPQ checks and finished-native timing checks remain intact.
Adapter version is `canonical-guitar-1.0.1` so artifact/cache identities distinguish
the corrected projection.

`tests/adapters/gap.test.ts` is a new original, literal regression:

- The independent native negative control still observes 1,280 for the old rhythm.
- A newly authored source-grounded fixture has a 3/2-quarter bass note and a
  5/2-quarter gap, with correct raw provenance/digests, held contacts and hand states.
- **Before** correction it fails at native beat 6:
  `/tmp/opencode/guitar-live-gap-before.log`.
- **After** correction its native bass intervals are `[0,1440)` note,
  `[1440,3360)` rest, `[3360,3840)` rest. Canonical input stays byte-for-byte unchanged;
  all 11 canonical notation mappings and 9 performed sounds remain represented.
- The actual `independent-guitar-validator-1` accepts this fixture. Actual injected
  PDF/MIDI export and native/MIDI observations are under
  `/tmp/opencode/guitar-adapters-gap-fix/original-gap/`.
- Real Chromium renders the corrected notation. Only this original fixture image
  is shared; no actual-song fixture/image is published in Git.
  [Screenshot share](https://nextcloud.tail750ac6.ts.net/s/zwH7Hqg75W3Yt7b).

## Executed targeted and regression checks

```sh
bun test tests/adapters/gap.test.ts
bun run test:adapters                  # 14 pass / 112 assertions
bun run typecheck:adapters
bun run typecheck
bun run test                           # 32 pass / 11 named TODOs
bun run test:controls                  # 16 controls match
bun install --frozen-lockfile
bun build src/adapters/index.ts --target=browser --outdir=/tmp/opencode/guitar-adapters-gap-fix/browser-build
ADAPTERS_VALIDATOR_MODULE=/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-2e0bc3f7/src/engine/index.ts \
  bun run test:adapters:tempo /tmp/opencode/guitar-adapters-gap-fix/tempo-regression
bun scripts/probe-adapters.ts /tmp/opencode/guitar-adapters-gap-fix/original-repeat-proof
```

The real-validator tempo regression remains passed: initial 40 BPM/12 seconds,
absolute runtime 0.75 → 60 BPM/8 seconds, correct PDF captions, repeat restoration
and unchanged complete tick/pitch union. The original-repeat artifact proof also
passes all 18 PDF pages and all eight actual corruption rejections. Existing
historical evidence directories are not overwritten by those regression runs.

## Actual full-song exports — local draft fidelity checks passed

The provided candidates are unchanged. Every request uses the real engine
validator and empty trusted approval context. The adapter does not use a stub or
bypass representability. Input fingerprints and actual validation calls are in:

`/tmp/opencode/guitar-live-exports/generation.json`

Files for **each** `capo-0/` and `capo-2/` under that root:

- `full-song.mid` and `midi-manifest.json`;
- `full-song.pdf` (A4), `full-song-letter.pdf` (Letter), corresponding manifests;
- `midi-inspection.json`, `pdf-inspection.json`, `pdf-letter-inspection.json`;
- `rasters/page-01.png` … `page-11.png`, and the same range in `letter-rasters/`.

Actual byte checker `/tmp/opencode/guitar-live-exports/check.ts` imports neither
adapter/exporter nor engine/form code. It reads canonical inputs independently,
checks the literal 64-bar-occurrence form, recomputes source-entry tempos, and
reopens all binary artifacts. Summary: `verification.json`; narrative: `report.md`.

- **MIDI:** 354 capo-0 attacks = 245 melody + 58 bass + 51 harmony; 361 capo-2
  attacks = 245 melody + 58 bass + 58 harmony. `midi-file` and Tone MIDI both match
  every exact canonical role/pitch/on/off tick. Complete melody union is identical
  at both capos. All programs 24, channels 0/1/2, balanced pairs, all 64 effective
  tempo entries. Last off tick **244,800** (quarter 255); all track ends
  **245,760** (quarter 256), preserving the final quarter of silence. Integer-tempo
  integration gives 171.738858 seconds to last off and 172.405524 to performance end.
- **PDF:** all **44 pages** parsed/raster-checked: 11 pages for each size at each
  capo. Each has all 32 complete combined systems, all 64 original-bar/pass labels,
  all tempo captions and embedded Bravura. Actual staff noteheads match all **365**
  capo-0 / **373** capo-2 performed notation pitches/spelled octave positions.
  Every printed TAB fret/string/tie sequence matches canonical fingering.
  Same-bar tied continuations conventionally omit redundant TAB digits, while
  keeping staff heads and ties; bar-entry continuations print parenthesized frets.
- Sampled staff/TAB raster line coverage is **100%**. Directly inspected pages
  **1/6/11** for both sizes and both capos: readable combined notation, ordinary
  gap rests, triplets, ties, final o64/S46/P4 label and final double barline intact.

The byte checker was refined for measurement facts, not to hide musical changes:
PDF.js text extraction can merge heads at different staff heights, so exact glyph
positions now come from individual PDF showText/CTM operators. Letter-scale ledger
lines can exceed 20pt, so five-line staff detection requires actual long staff
lines. The documented same-bar TAB continuation convention is checked explicitly.
All staff heads and complete canonical MIDI intervals remain required.

No additional production engraving defect was found after the gap correction.
The recommendation draft's capo-2 MIDI also passes the same complete checks.

## Scope / claims

This is implementation evidence for fresh independent judging, not self-approved
release or musician acceptance. Drafts still have provisional source/project
identities, `sourceReady`, pending selection/musical review and uncalibrated
transitions. A second MIDI player/human audition remains separate.

Chat agents generate arrangements; the website is only viewer/player plus PDF/MIDI
downloads. These adapters consume canonical scores and export/play them. No app
model connection, generation/create button, engine/source/UI edit or persistence
integration was introduced. No actual-song fixture was committed to Git.

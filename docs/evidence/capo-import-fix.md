# Source capo import regression — 2026-10-25

Requested source: Songsterr s59, **The Beatles — Girl**. User preference:
intermediate difficulty, agent decides capo by comparing 0/2 while preserving
the sounding melody/key and standard tuning.

## Fixed boundary

- Parser 1.3.0 supports whole-source capo markings. Source frets are relative
  to that capo: sounding pitch is original tuning + source capo + relative
  fret. The offset is materialized exactly once in canonical notes and
  `sourceTuning.soundingMidi`, never again by final arrangement fingering.
- The current public client's independent sounding-pitch and staff-position
  calculations were inspected locally to establish this convention. Downloaded
  client/source bytes remain ignored; no musical excerpt was copied into tests.
  Inspected public bundle: `common-HmSdJY3UIoyLNU-X.js`, SHA-256
  `7af50cfb0e080441705807ac1ef09cc2cde2894a003a66568c98a46ec83cff23`,
  from `https://static3.songsterr.com/production-main/static3/latest/`.
- Missing/null/zero capo means zero. Source note positions, original tuning,
  capo, durations, ties and raw-member identities are retained. Notes carry
  a non-melody-affecting `source-capo` interpretation marker. Invalid/overflowing
  tuning/pitches and unknown partial-capo constructs remain fail-closed.
- Boolean `tuningFlat` is validated as display metadata, not a pitch offset.
  This also resolves the next import failure on the bass part.
- The automatic, unapproved instrumental fallback prefers an intact supported
  alternative among locally monophonic lines before comparing register/activity.
  It does not strip unknown effects, edit the primary melody, or omit notes
  from an already-selected line to manufacture success. Unsupported primary
  notes and unsupported fallbacks without a supported alternative still block.
- Publication notes distinguish source capo normalization from the independent
  arrangement capo and retain the existing unapproved source-selection caveat.

## Checks

- `bun install --frozen-lockfile`, agent TypeScript check, 92 source tests,
  16 agent tests, `bun run check`, and `git diff --check` passed.
- Original five-note exercises run the real engine/validator and canonical
  PDF/MIDI adapters with final capo 0 and 2. Independent MIDI parsing checks
  literal pitches `[42,48,57,62,69]` in both cases, catching missing/double
  source or arrangement offsets. Actual PDFs include staff and TAB glyphs.
- Original source tests cover formats 5/8, absent/null/zero/2/8 capos,
  metadata-tuning fallback, unchanged raw data, mixed part capos, tied events,
  malformed/overflowing values and retained unsupported effects.
- Actual unrestricted acquisition now prepares all eight pitched parts and
  the explicitly raw-only percussion identity: 61 bars, 3,910 canonical note
  events. An independent raw-member oracle verifies all 3,941 pitched raw
  members exactly once against original tuning + source capo + relative fret,
  retained original positions/fractions and artifact hashes.
- Both rhythm-guitar parts have source capo 8. All 224 original lead-vocal
  attacks remain selected. The draft additionally selects 56 notes from the
  supported second lead-guitar line during bars 50–56, instead of claiming
  to reproduce the first line's unsupported slide/tapping effects. This is
  a disclosed, unapproved alternative, not established foreground fidelity.

Full source/raw, prepared requests, actual model output and complete arrangement
artifacts stay ignored/local. Model-plan publication and exact HTTP/artifact
review evidence are separate from these importer/software checks. No human
musical approval or calibrated-playability claim is implied.

## Actual publication and parent artifact/browser checks

The actual source-reading musician task completed with a 103-candidate plan:
80 sparse bass attacks and 23 optional inner-harmony attacks. The parent receipt
binds the actual T3 task/time/model and exact raw plan-file SHA-256
`816f6c3f79a0bb6d88c1172ae90e53926fd6b779321d6f572254df40c396bf7a`.
Baseline agreements are disclosed as model-reviewed selections, not invented
new composition or a fabricated provider HTTP call.

Canonical publishing installed immutable **unreviewed draft**
`arr-37db04544b2376ea7ed8202effb8b544d8e3f50e3c5f11dbe5c7eb3b200e4d0e`.
Both capo trials retained 80 bass/23 harmony attacks and all 280 selected melody
notes. Capo 2 was selected for the engine's better adapted bass-contour score,
not as a calibrated human-difficulty or global-optimality claim. All 80 bass
attacks use a disclosed +12-semitone adaptation; the original ensemble's low
bass register is not claimed preserved.

- Canonical PDF: 74,080 bytes, eight A4 pages with actual staff/TAB glyphs;
  SHA-256 `f5e5d4853cfae07f0721558d0951027f189d3a09bde3ff645fce308239d2c21f`.
- Canonical MIDI: 5,791 bytes; independent parsing matches all 383 role/pitch/
  onset/release tuples with balanced notes, PPQ960 and complete end tick 234240;
  SHA-256 `c982d5fd172b2cc3fdc31b3fb1cc15991efbf505c31d8d43a54d93874b0967ec`.
- Exact viewer/PDF/MIDI/score/notes URLs at `http://beelinkk:4590` return 200
  and intended MIME types; downloaded artifact bytes match storage and hashes.
  The existing registered Project Shelf Sixfold viewer was reused, not replaced
  by an unmanaged development server.
- Real local Chromium advanced the playback clock, paused/stopped, toggled bass
  mute, sought measure 61 and returned to 1. Browser MIDI download matched the
  immutable canonical bytes; the layout-aware PDF button downloaded a real
  76,569-byte PDF. No page errors occurred. This verifies transport/UI behavior,
  not human auditory or guitarist acceptance.
- The published viewer and the new source-capo interpretation note were
  captured, inspected and uploaded to Nextcloud with anonymous byte verification.

The separate independent judge completed with **PASS for sharing as a
hard-validated unreviewed draft, no hard blockers**. Its private report and oracle
independently reconstruct all 3,941 raw pitched members, 328 source rests,
280 selected melody notes/34 rests, 383 held contacts and complete MIDI intervals.
It verified exact provenance, source/score/request bindings, both capo outcomes,
all eight PDF pages/31 staff-and-TAB systems, and actual HTTP artifact hashes.

The judge confirmed embedded Bravura music glyphs; standard PDF Base-14 Helvetica
text fonts are not embedded, so no all-font-embedded/PDF-A claim is made. Busy
rest/tuplet spelling, instrumental-line preference, nominal articulation handling
and uncalibrated movement remain draft caveats. The immutable bundle and its
unreviewed status are unchanged: a model/software PASS is not human approval.

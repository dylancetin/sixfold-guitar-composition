# U11/U12 canonical adapters — implementation evidence

**Round-1 correction note:** independent review found a real non-unit-tempo blocker
in `043b1fc`; its preference-only scaled fixture was invalid. The historical
bounded evidence below is not a pass for that gate. See
[adapters-tempo-correction.md](adapters-tempo-correction.md) for the real-validator
before/fix/after regression and separately blocked actual-song smoke.

**Verified bounded original-fixture adapters, not the complete requested song or
product release.** No source/engine/UI/persistence implementation or canonical
schema/log edits. API integration: [adapters-api.md](adapters-api.md).

## Delivered

- Browser-safe `src/adapters/index.ts`: canonical notation facade, stable JSON
  mapping and synthetic plucked WebAudio controller. Native alphaTab objects stay
  private. Only canonical role-separated performed notes sound; combined engraving
  never plays. Playback has gesture/readiness/error state, immediate queued-source
  cancellation, role mute/solo, quarter seek, tempo, half-open loops and cursor IDs.
- Node-only `src/adapters/server.ts`: `createScoreAdapter` implements `ScoreAdapter`
  with REQUIRED injected validator/context loader. Export ignores client report,
  parses snapshots, verifies source/score/approval digests and source manifest,
  reruns actual injected validation for every download, checks returned references,
  then enforces exact native representability. Optional head hook runs twice; API
  owns equivalent current-head checks if it omits that hook.
- Actual complete-system PDF bytes and SMF1 MIDI bytes. The PDF route refactors
  the proven U02 font, viewport-transform, bounds and pagination fixes into small
  production modules; it does not import `tools/export-proof` or a test script.
  Native `staff.capo=c`, transpose 0, display transpose -12 are asserted against
  canonical sounding pitch. Duplicate native staff/TAB capo effect captions are
  disabled; subtitle/header still explicitly identify capo-relative TAB.
- Revision/digest filenames and parsed manifests bind source, score, profile,
  adapter, artifact SHA-256/length, count expectations, capo/tuning, validator and
  review status. Changed music cannot inherit a musically-reviewed label merely
  by copying a review record.

## Executed checks

```sh
bun install --frozen-lockfile
bun run check                    # existing U03 foundation, unchanged scope
bun run typecheck:adapters
bun run test:adapters            # 13 passed; 99 expect assertions
bun run build:adapters           # browser bundle succeeds, no Node imports
bun run probe:adapters           # real files + independent checks + negative bytes

# Uses cached local Chromium, no preview server and no external websites:
LD_LIBRARY_PATH=/tmp/opencode/hece-browser-libs/usr/lib64:/tmp/opencode/dernek-document-preview-deps/usr/lib64 \
  bun tests/adapters/browser-probe.ts
```

The local shared-library paths are environment-specific. Other machines should
install Chromium's runtime libraries and set `ADAPTERS_CHROMIUM` if needed. Browser
probe is opt-in (about 61 seconds), not part of fast unit tests. Existing foundation
remains 32 passing tests and 11 named TODO gates, not newly claimed product passes.

Tests separately cover exact quarter/eighth triplets, ordinary crossbar ties,
overlapping independently sustained harmony lanes, stable repeated occurrence
mapping, capo 0/2, tempo rounding/scaling once, forged passing-envelope omission,
stale source/score/context/report/head, unsupported denominator and abort, plus
stop during pending gesture resume and seek to the end. Production exports have
no passing fallback validator. The fixture-only injected literal oracle lives in
`tests/adapters`, not production, and is explicitly not a general validator.

## Actual artifact oracle

Artifact root: **`/tmp/opencode/guitar-adapters-u11-u12/`**.

This newly authored source variant of the canonical two-bar held-voice fixture
raises its source pitches by two semitones and repeats the two bars 12 times.
Both capos preserve those identical source pitches; capo 0 has relative frets two
higher than capo 2. New raw JSON bytes/hash and parser provenance identify the
authored variant, rather than falsely reusing the old raw blob's identity.

This is **not** the U02 16-written/24-occurrence Copper Steps fixture, not F2
human-reviewed fingering, and not the requested song. It is an additional valid
canonical 24-occurrence, 96-quarter, 72-second repeat/adapter regression fixture.
The U02 report and fixture were read; their font/pagination/capo techniques were
retained, not silently converted into a new full-song acceptance claim.

Files for each `capo-0/` and `capo-2/`:

- `source-raw.json`, `source.json`, `score.json` and `projection.json`;
- `fixture.mid`, `midi-manifest.json`;
- `A4.pdf`, `LETTER.pdf`, corresponding manifests and inspections;
- `A4-rasters/page-01.png` … `page-04.png`;
- `LETTER-rasters/page-01.png` … `page-05.png`;
- `placements.json`, `layout.json` (debug output, never persistence models).

`verification.json` records the actual run. Independent byte readers import no
production adapter or native renderer. `midi-file` and Tone MIDI agree on all
**108 attacks**: 60 melody, 24 bass, 24 harmony; exact role/pitch/on/off union,
PPQ960, all programs 24, balanced pairs, entry tempos, track ends/final note-off
at **92,160 ticks**, duration **72 seconds**. Capo adds no MIDI offset. Bytes
differ between revisions because MIDI text binds the revision ID/digest; sounding
intervals are identical.

PDF.js parses/rasterizes **18 pages** total: A4 4 pages (3/3/3/3 systems), Letter
5 pages (2/3/3/3/1), at both capos. Each PDF contains all 24 original-bar/pass
labels once and all 12 complete combined staff/TAB systems. Checks independently
read embedded Bravura, notehead/duration counts, actual first F#5 head geometry,
and **every actual TAB string/fret sequence** reconstructed from text coordinates.
Every sampled raster staff/TAB line has 100% coverage. Native exact timing checks
additionally reject any quantized beat. First/middle/last rasters were inspected;
the sparse Letter last page is cosmetic and preserves the final double barline.

Eight actual negative files are saved and reopened, not merely mocked summaries:

1. Missing final system → system/occurrence coverage fails.
2. Fontless SVG converted into PDF → actual music glyph/font checks fail.
3. Clipped final TAB → raster line coverage fails despite retained PDF operators.
4. Capo 0 captions with capo 2 frets → reconstructed actual TAB pitches fail.
5. Missing final bass pair → complete literal MIDI union fails.
6. MIDI +12 → complete literal pitch union fails.
7. Unmatched MIDI off → note pairing fails.
8. Stale entry tempo → exact tempo map fails.

## Real browser/audio measurement

`browser-audio.json` and `browser-notation.png` preserve the real headless Chromium
probe, distinct from `audio-clock-simulation.json` (deterministic boundary double).
The real probe unlocks audio with an actual click, reads generated WebAudio DSP
samples, measures each role's gain output, checks pause silence/cancellation and
held-note seek, then samples the audio-clock cursor for 60 seconds and >=20 loops.
Detailed measurements and limits are in [adapters-verification.json](adapters-verification.json).

This measures AudioContext scheduling/cursor consistency, not microphone timing,
speaker latency, a second MIDI player, human hearing, or guitarist acceptance.
The browser defaults to muted hardware output in headless mode; nonzero DSP data
proves generated audio signals, **not** that a human listened. No recorded acoustic
guitar claim. The synthetic triangle/low-pass pluck is the intentional audio source.

Readiness obstacles were not hidden: desktop browser MCP was disconnected,
Browserless returned 404, and local Chromium initially lacked shared libraries.
Reusing existing local runtime libraries enabled the direct serverless probe.
The first completed audio probe incorrectly sampled `AudioParam.value` immediately
after scheduling a same-time change (before the next DSP quantum). The corrected
measurement waits 80 ms and verifies actual per-role DSP silence plus continued
melody output, rather than weakening role muting into a UI-only assertion.

## Remaining integration boundaries

- Complete actual-song canonical score, real independent validator wiring, UI
  controls and preview server, authoritative API head/persistence/CAS and download
  delivery belong to other workers. This does not pass requested-song G6–G9.
- Musical review and the second-player/human audible checks remain open.
- PPQ960-inexact timing rejects rather than rounds. Same-role overlapping unisons
  cannot be independently released on one required MIDI channel and explicitly
  reject; separate-role unisons use separate channels.
- Abort checks surround bounded work. Synchronous native rendering cannot be
  forcibly interrupted without terminating the UI/API worker.
- Browser/application packaging must include MPL-2.0 and Bravura OFL notices;
  `probe:adapters` copies both notices into the artifact directory. PDFKit and
  SVG-to-PDFKit are MIT. Versions are pinned; root scripts were only added.

No canonical decision log changes. Candidate rows are isolated in
`adapters-candidate-unit-log.tsv` for parent review.

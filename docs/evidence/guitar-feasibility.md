# Existing-song acoustic arranger: feasibility brief

Live checks: 2026-10-20. Both repositories were read-only. Disposable probes and dependencies are in `/tmp/opencode/guitar-probes/`.

## 1. Recommendation and user grounding

**Feasible v1: arrange existing structured songs, not generate new compositions or transcribe arbitrary recordings.** Reuse the user's working Songsterr importer, add a deterministic, melody-locked guitar arranger, and use alphaTab for standard notation + TAB + playback + MIDI. Add an actual PDF-byte export path; printing alone is insufficient. Difficulty must be selected **before arrangement**; demo option 1 is **intermediate, standard EADGBE tuning**. Keep original key and melody unless the user explicitly approves transposition/octave changes. A genuinely optional LLM planner can guide simplification/style, but cannot replace the playability validator.

First real acceptance song: [The Beach Boys — You Still Believe In Me](https://www.songsterr.com/a/wsa/beach-boys-you-still-believe-in-me-tab-s692866). Do not substitute another tune or a generated demo when that import/arrangement fails.

## 2. Proven reference project: reuse this, not a speculative scraper

The actual local directory is **`/home/taytay/workspace/midi-to-readable-notaion`**, not `...-notation`. Read:

- `src/server/songsterr.ts`: `importSong({url, partId?})`, `normalizeTrack(...)`; validated page/CDN discovery, bounded streaming, 15-second timeout, revision/part checks, caching, exact rational rhythm decoding.
- `src/shared/model.ts`: validated track/measure/voice/beat model and stable beat IDs.
- `src/server/songsterr.test.ts`: import/security/rhythm regression coverage.
- `src/audio/timeline.ts`: useful tempo integration and tie-chain joining; **does not expand repeats**.
- `docs/songsterr-conversion.md`: direct JSON normalization and upstream alphaTab conversion references. Its final “no playback” sentence is stale: `src/audio/player.ts` and the current README demonstrate playback.

Important correction: this checkout does **not** currently implement a downloadable MIDI exporter. It imports structured Songsterr notes directly, avoiding a lossy MIDI round-trip. Its documentation describes a separate downloader's JSON → alphaTab → MIDI/GP pipeline. Adapt the proven local importer first; add exports around the new arranged model. Retain original source JSON alongside normalization: the current normalized model discards original string/fret choices and many effects.

**Executed the actual importer against the actual song**, from a disposable Bun script importing the existing source by absolute path. Parts 0, 1, 2, 7, 8, 9 all imported with **zero warnings**. Also ran existing importer/timeline tests: **53 pass, 6 skip, 0 fail**. No app server or modifications were needed.

## 3. Actual Songsterr note-data path and song-specific traps

Public page `script#state` → `meta.current.{songId,revisionId,image,tracks}` → per-part JSON:

```text
https://dqsljvtekg760.cloudfront.net/{songId}/{revisionId}/{image}/{partId}.json
https://dqsljvtekg760.cloudfront.net/692866/847990/v3-5-17-SNlH5Efj4SYStUwA/0.json
```

Normal unauthenticated browser loading independently returned HTTP 200 for the actual song's pitched parts; no credentials, CAPTCHA solving, premium export, or access-control bypass was used. This is an internal player interface, **not a documented stable public API**. Discover revision/token each time; do not hard-code this sample's values. The reference also names a second CDN, but do not use alternate hosts to evade a denial: stop on access restrictions/403; only retry genuinely unavailable resources. Add explicit blocked/restricted/allowed-player checks—the reference's metadata schema currently strips those flags.

Actual revision **847990**, JSON version **5**, **11 tracks**, **46 written measures**, 4/4; tempos at zero-based measures `0:80, 4:90, 39:87, 40:85, 42:90`. Ignore the page's initial UI tempo state (72 BPM); use score automations.

- **Part 0 “Brian Wilson” / Oboe**: likely main vocal melody, range MIDI **52–71**, 154 note slots / 141 attacks after tie merging. First sounding bar is **5**, opening pitches **54,59,61,63,64,63** with quarter durations **1,1,½,½,½,½**. All tracks have `isVocal=false`, so vocal flags are insufficient. Confirm by source audition/selection, not just names.
- **Part 1 “The Beach Boys” / Synth Voice** supplies intro material starting bar 1; range **42–71**. Main-vocal part 0 alone leaves the four-bar intro empty. Suggest an explicitly disclosed section map: intro from part 1, sung melody from part 0, outro reviewed separately.
- **Part 2 “Guitar (high)”** is the website default and is **not equivalent to the vocal melody**.
- **Part 7 Harpsichord**: 948 note slots, useful original-harmony evidence; no separately provided chord chart (`hasChords=false`). Avoid inferring the whole song from melody alone or forcing diatonic triads.
- **Parts 8/9 electric/acoustic bass** each have 174 slots, MIDI **28–47**, below a standard guitar's minimum **40**. Revoice by octave/register and simplify; copying bass frets is impossible. They may be doublings—do not stack both automatically.
- Repeat markings: bars **5–7 ×2**, **17–19 ×2**, **43–46 ×4**. A flat 46-bar MIDI is not the full playback form. Implement/test repeat expansion and tempo restoration consistently; never silently discard these markings.

JSON pitch is `tuning[string] + fret` with **zero-based string indexing**, high-to-low tuning in this source. `duration:[n,d]` is a whole-note fraction: quarter duration `4*n/d`, already including dots/tuplets. Do not apply their timing multipliers again. Ties are continuations, not fresh attacks. Original source string positions are not final guitar fingering. Initial public control probe, [Californication s439](https://www.songsterr.com/a/wsa/red-hot-chili-peppers-californication-tab-s439), independently showed the same path with JSON version 8: schema drift/version coverage is real.

## 4. Clean fallback inputs and honest limitations

- **MusicXML `.musicxml/.xml/.mxl`**: best notation-rich fallback; tracks, voices, ties, meter, repeats, spelling and sometimes string/fret data. alphaTab natively imports it. Validate compressed-size limits and unsupported notation; a piano arrangement still needs melody-role selection and new guitar fingering.
- **Guitar Pro `.gp3/.gp4/.gp5/.gpx/.gp` (3–8)**: native alphaTab import; often best source for tuning and techniques. Existing multi-guitar/bass fingerings do not prove the merged one-guitar arrangement playable.
- **MIDI `.mid/.midi` SMF 0/1**: use `@tonejs/midi` (`new Midi(bytes)`, `header.tempos`, `tracks[].notes.{midi,ticks,durationTicks}`), then a separate track-selection/quantization adapter. **alphaTab does not import MIDI as notation**. MIDI loses enharmonic spelling, explicit rests, notational ties, repeats, fingering, and melody semantics; piano sustain can create misleading overlaps. Warn on expressive/unquantized data, pedal, bends and unsupported SMPTE timebase rather than pretending lossless notation recovery.
- Arbitrary YouTube/Spotify/audio links are **not supported by this source adapter**. Polyphonic audio-to-melody/chords is a separate research/product scope. If a Songsterr source is absent/restricted/broken, request an authorized structured-file upload; never fabricate song notes.

## 5. Concrete implementation approaches

**A — Recommended smallest coherent v1: reused importer + TypeScript engine + alphaTab.** Persist a small independent canonical domain model; map it to alphaTab `Score`. Native score/TAB, cursor and SoundFont playback, native GP/MusicXML import, MIDI generation; one notation dependency does most integration work. PDF requires a separate adapter. Source identity and guitar feasibility remain your own engine's responsibility.

**B — MusicXML-first + OpenSheetMusicDisplay + MIDI/audio adapter.** Strong if interoperable MusicXML is the central deliverable: write arranged MusicXML with technical string/fret tags; `new OpenSheetMusicDisplay(el,{backend:'svg'})`, `await load(xml)`, `render()`. Good standard/TAB rendering, but public OSMD is a renderer, **not an included production audio player** (player is sponsor/early-access). Add independent synthesis/synchronization and GP conversion, so more integration than A.

**C — VexFlow + custom note/TAB model + separate audio/export.** `Factory/EasyScore`, or `Renderer`, `StaveNote`, `TabNote`, `Voice`, `Formatter`; maximal custom presentation and permissive licensing. But you own pagination, notation import, beams, ties, tuplets, multi-voice collision layout, cursor timing and export conversion. Small-looking initial demo, largest hidden score-engine scope; not the shortest credible v1.

Verovio is another credible engraver (MEI-centric; `loadData`, `renderToSVG(page)`, `renderToMIDI`, timing lookups), but adds conversion/tab-coverage validation and LGPL distribution considerations. No advantage over guitar-focused alphaTab for this v1.

## 6. Current APIs/licensing and export evidence

Live npm registry checks: **alphaTab 1.8.4 MPL-2.0; OSMD 2.2.1 BSD-3-Clause; VexFlow 5.0.0 MIT; Verovio 6.3.0 LGPL-3.0-or-later; @tonejs/midi 2.0.28 MIT.** Pin tested versions. MPL is file-level copyleft: keep library notices and source availability obligations for distributed covered files/modifications, not an automatic requirement to open all independent app code. alphaTab's bundled **Bravura is OFL**, **Sonivox SoundFont's included LICENSE is Apache-2.0**; ship their notices separately. The upstream Songsterr downloader linked by the reference is MIT at the inspected commit; retain provenance if adapting it.

- Web: `new AlphaTabApi(element, settings)`, `renderScore(score,[0])`, `playPause()`, `playerReady` / `isReadyForPlayback`, `downloadMidi(format?)`; set `player.enablePlayer` and serve worker/worklet/font/SoundFont assets. Browser audio requires a user gesture. No need to promise real recorded acoustic timbre.
- Node import: `importer.ScoreLoader.loadScoreFromBytes(bytes, settings)`.
- Node MIDI: `midi.MidiFile` + `AlphaSynthMidiFileHandler(file,true)` + `MidiFileGenerator(score,settings,handler).generate()` → `file.toBinary()`. Set `file.format=...MultiTrack` when desired; default is valid **SMF Type 0**, despite docs' “SMF1.0” wording. Do not confuse SMF compliance with Type 1.
- `api.print()` opens an A4-oriented **print popup**, not a PDF-byte exporter. For a real download, render alphaTab SVG via `rendering.ScoreRenderer`, then PDFKit + SVG-to-PDFKit with embedded Bravura and fixed-page, whole-system pagination. Or use a dedicated print route and Playwright `page.pdf()`; that adds a Chromium deployment dependency. `pdf-lib` builds PDFs but does **not** engrave scores or automatically convert arbitrary SVG to notation.

**Executed export probes, not just API reading:**

1. Synthetic legal one-bar alphaTab score → SVG → PDFKit **0.20.2** / SVG-to-PDFKit **0.1.8** → **12,712-byte PDF**, parsed with PDF.js (`pdfjs-dist 6.4.299`): one page, expected title, TAB numbers, embedded music glyph text and 595 drawing operators. Critical trap found/fixed: SVG `class="at"` relies on external CSS; inject explicit `font-family="alphaTab" font-size="34"` and embed Bravura. A PDF can parse correctly while silently missing all music glyphs without this.
2. Same score → alphaTab MIDI → independent `midi-file` parser: **183 bytes**, Type 0, PPQ 960, correct five pitch/onset/duration events and 96 BPM; GP7 export/reimport also succeeded.
3. **Actual song via reference importer** → diagnostic MIDI adapter → parsed and compared exact pitch/onset/duration ticks: **8,661 bytes**, Type 1, five SMF tracks including conductor, five tempo events, 957 attacks across source parts 0/1/7/8. This diagnostic plays written bars once (**124.406 s**); it is **not an arrangement**, does not expand repeats, and must not be sold as the finished guitar artifact.

These are parsing/integration probes, not visual proof of a full-song website/PDF or musician approval. Full-song pagination and playback remain acceptance gates.

## 7. Preserve melody, then fit bass, then harmony

Normalize exact rational score time, merge ties into sounding intervals, preserve repeat/section provenance. Ask for difficulty, melody track/section map, original key vs approved transposition/capo, and desired bass/harmony density before solving. Default intermediate tuning is `[40,45,50,55,59,64]` low-to-high; fix one internal convention and convert at adapters.

1. **Lock melody** pitches, attacks, durations/rests; enumerate every legal string/fret for each note. Use phrase-level beam search/dynamic programming for position continuity, not greedy nearest-fret assignments. Do not assume melody always lies on the top three strings. If impossible under the chosen profile, explain the passage and request an explicit relaxation—never silently change melody.
2. **Add original bass evidence** on structurally important attacks, revoiced into guitar register below melody. Preserve bass pitch class/inversion and motion where feasible. Candidate bass placement must be considered while selecting among equivalent melody fingerings; “melody first” is priority, not irrevocable greedy fingering. Drop/defer an impossible bass rather than sacrifice melody.
3. **Add sparse inner harmony** from original Harpsichord/guitar pitch sets and inferred, user-correctable chord spans; allow chord changes inside bars. Rank thirds/sevenths and characteristic source tones above doubled roots/fifths. Do not casually reharmonize this existing song. Add fills only in melody gaps. Reduce density before raising physical difficulty.

At every onset **and release**, validate all active sounding intervals: one pitch per string, no same-string re-fret while a protected note rings, finger/barre feasibility, open-string exceptions, fret span, movement speed at actual tempo, and attack density/right-hand technique. A fret-span threshold alone is not proof of playability. Suggested conservative intermediate starting limits: fret ≤12, fretted span ≤4, ≤4 simultaneously sounding notes, ≤4 independent fretting fingers unless an explicitly modeled barre permits more. These are product defaults requiring guitarist calibration, not universal physical laws. Shortening non-melody sustains must be recorded; melody durations are protected. Preview the **actual assigned voicing**, not a separate approximation.

## 8. Domain shape and engine/planner separation

```ts
type Q = { n: number; d: number }; // reduced rational quarters
type SourceRef = { partId: number; bar: number; voice: number; beatId: string };
type Note = { id: string; pitch: number; start: Q; duration: Q;
  source?: SourceRef; role?: 'melody'|'bass'|'harmony'; tieGroup?: string };
type Piece = { source: { url?: string; songId?: number; revisionId?: number };
  parts: Part[]; bars: Bar[]; tempos: TempoPoint[]; form: RepeatGraph };
type Preferences = { difficulty: 'beginner'|'intermediate'|'advanced';
  tuning: number[]; capo: number; transpose: number;
  melodySections: { fromBar: number; toBar: number; partId: number }[];
  bassDensity: number; harmonyDensity: number };
type Assignment = Note & { string: number; fret: number; finger?: number };
type Arrangement = { notes: Assignment[]; preferences: Preferences;
  changes: Change[]; violations: Violation[]; provenance: Provenance };
interface SourceAdapter { import(input: URL | Uint8Array): Promise<Piece> }
interface Planner { plan(piece: Piece, prefs: Preferences): Promise<Plan> }
interface Engine { arrange(piece: Piece, prefs: Preferences, plan: Plan): Arrangement }
interface Validator { validate(piece: Piece, result: Arrangement): ValidationReport }
interface Exporter { midi(a: Arrangement): Uint8Array; pdf(a: Arrangement): Promise<Uint8Array> }
```

`Part`, `Bar`, `TempoPoint`, `RepeatGraph`, `Plan`, and reports are app-owned schemas, not alphaTab serialized JSON. alphaTab explicitly does **not** guarantee serialized model compatibility across versions. Keep exports, renderer and playback derived from the same validated `Arrangement`, with stable note IDs/role/source mapping. `changes` records dropped bass, octave relocation and shortened accompaniment; `violations` blocks unplayable “success.” Reject malformed source time instead of fabricating notes.

**Deterministic engine ≠ AI.** A rule/beam-search implementation should say “constraint-based arrangement.” Genuine LLM assistance means a real configured provider call on imported section/harmony summaries and preferences, returning schema-validated proposals (e.g. sparse bass pattern, candidate source-chord simplification, register strategy, explanation). Constrain proposals to actual source IDs/candidates; run the same hard validator afterward. Record provider/model, plan/version and whether its suggestions were accepted. If no provider/key is configured or a call fails, say “deterministic fallback”; never claim the LLM analyzed the song. An LLM does not get to bypass melody locks or invent success/downloads.

## 9. Meaningful release gates

- **Source gate:** exact requested song/revision, selected tracks and measures; fail clearly on access/parse failure. Actual-song fixture checks above prevent demo substitution. Imports with discarded techniques surface warnings.
- **Melody identity:** compare merged source/output `(pitch,start,end)` across expanded form, permitting only explicitly approved transposition/section mapping. Check the actual bar-5 opening sequence. No missing/extra attacks, double-triggered ties, quantization drift, or “close enough” pitch-class-only test.
- **Guitar gate:** for every output note verify `pitch=tuning[string]+capo+fret`; test overlapping intervals on the same string, simultaneous frets/fingers/barres, held melody vs moving bass, and transitions at tempo. Include impossible fixtures and exact-boundary releases. Never accept a solver's heuristic difficulty label as the validator.
- **Form/time gate:** repeat playback matches engraved repeat semantics, including this song's final ×4 section and tempo resets; score, audio, MIDI use identical form. Check sustained ties over bar/system boundaries and independent voices.
- **Artifact gate:** download real bytes with correct MIME/filename; parse MIDI chunks/events, balanced note-on/off, durations, tempos, program and the complete arranged note union. Parse **all** PDF pages with PDF.js/pypdf, check nonblank score content/music fonts/title/final bar; raster-review first/middle/last pages for clipping/missing glyphs. Magic bytes, a blob URL or screenshot renamed `.pdf` is not enough. One acoustic-guitar part/program, not the unchanged multi-instrument source.
- **UI/audio gate:** mobile/desktop score+TAB preview, actual playback cursor and audio readiness/errors; test browser gesture/SoundFont loading. A guitarist auditions/plays representative hard transitions before claiming “playable.”

## 10. Reproduction and primary evidence

```sh
# Reads reference source; writes only disposable normalized data to /tmp/opencode.
BUN_RUNTIME_TRANSPILER_CACHE_PATH=/tmp/opencode/guitar-probes/bun-cache \
  bun /tmp/opencode/guitar-probes/reference-probe.ts
node /tmp/opencode/guitar-probes/reference-to-midi-probe.mjs
node /tmp/opencode/guitar-probes/artifact-probe.mjs
BUN_RUNTIME_TRANSPILER_CACHE_PATH=/tmp/opencode/guitar-probes/bun-cache \
  bun test /home/taytay/workspace/midi-to-readable-notaion/src/server/songsterr.test.ts \
  /home/taytay/workspace/midi-to-readable-notaion/src/audio/timeline.test.ts
```

- [alphaTab formats](https://alphatab.net/docs/category/formats), [low-level import/render/MIDI APIs](https://alphatab.net/docs/guides/lowlevel-apis), [Node SVG/font dependency](https://alphatab.net/docs/guides/nodejs), [print semantics](https://alphatab.net/docs/reference/api/print), [MIDI download](https://alphatab.net/docs/reference/api/downloadmidi), [supported model exporters](https://alphatab.net/docs/guides/exporter).
- [alphaTab license](https://github.com/CoderLine/alphaTab/blob/develop/LICENSE), [live npm metadata](https://registry.npmjs.org/@coderline/alphatab/latest). Bravura/SoundFont licenses also inspected inside installed package `dist/font/Bravura-OFL.txt`, `dist/soundfont/LICENSE`.
- [OSMD features and playback limitation](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay#readme), [OSMD API](https://opensheetmusicdisplay.github.io/classdoc/classes/OpenSheetMusicDisplay.html), [VexFlow APIs/license](https://github.com/vexflow/vexflow#readme), [Verovio APIs](https://book.verovio.org/toolkit-reference/toolkit-methods.html), [Tone MIDI APIs](https://github.com/Tonejs/Midi#readme), [SVG-to-PDFKit font/CSS support](https://github.com/alafr/SVG-to-PDFKit#readme).
- Reference's pinned [upstream converter](https://github.com/Metaphysics0/songsterr-downloader/blob/097ee38212715307929b54627c79fbd8af9e41cc/src/lib/server/services/converter/songsterr-to-alphatab.converter.ts) and [MIT license](https://github.com/Metaphysics0/songsterr-downloader/blob/097ee38212715307929b54627c79fbd8af9e41cc/LICENSE). Read/adapt with attribution; the local tested importer is the primary reuse target.

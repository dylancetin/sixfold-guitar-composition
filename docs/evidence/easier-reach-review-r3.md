# Easier-reach revision R3 — independent review and delivery

## Verdict and links

**VERIFIED as a technically checked, materially reduced-reach unreviewed draft. Human comfort/acceptance remains pending.** The user's report that the previous bass/melody stretches were hard is actual negative human evidence; previous static passes do not negate it. This review found no concrete musical/export defect requiring another polish loop. No subagents, new app features or UI redesign were used.

New immutable ID: **`arr-104d4ea7fff96d693dadb216bb4c5c11c9c98b70079ee2579405fdff34e78a73`**. Revision `revision-15ea6ce2-252d-410a-9fca-577de87ec84a`. All exact links below were HTTP-tested and opened/downloaded in real Chromium:

- [Viewer/player](http://beelinkk:5571/arrangements/arr-104d4ea7fff96d693dadb216bb4c5c11c9c98b70079ee2579405fdff34e78a73)
- [PDF](http://beelinkk:5571/arrangements/arr-104d4ea7fff96d693dadb216bb4c5c11c9c98b70079ee2579405fdff34e78a73/arrangement.pdf)
- [MIDI](http://beelinkk:5571/arrangements/arr-104d4ea7fff96d693dadb216bb4c5c11c9c98b70079ee2579405fdff34e78a73/arrangement.mid)

Status is `unreviewed-draft`, approval stage `sourceReady`, musical review `pending`, no locks/approvals. Original `arr-1c71e20ba1a631bee396c7118e38a951f2842e93680295662e3c1a4ccbdebaf5` is unchanged, readable and still served; both entries appear in the library. Reused the existing managed Project Shelf server `c10c5079-9817-4b14-b9db-3b2e0345ae99`; started/stopped no servers.

## Separate code gate

Root started at `845442a` with exactly four intentional musician changes. Independently reviewed and committed **only** `src/engine/{arrange,search,fingering}.ts` and `tests/engine/fingering.test.ts` as **`df3f5b9`**. No validator, role/lock gate, bass-first ranking, source, plan or receipt modification.

- The helper clones placements and leaves sounds/inputs unchanged. Sort is deterministic; returned placement order/IDs, strings and frets are preserved. Open contacts always use finger 0; stopped contacts use 1–4.
- Prior starts are processed first; every still-held stopped contact reserves its label through its complete half-open interval. Same-time attacks reserve separate fingers. Release exactly at the next start frees the finger. Future overlaps influence preferred shape, not current occupancy. A contact's label never changes mid-sustain; no implicit barre.
- On a valid solved sequence a newly stopped contact has at most three held stopped predecessors: the original search already disallows a fifth stopped contact using four distinct fingers. Thus the free-finger array cannot be empty; every referenced sound/placement ID exists, and self-overlap makes its fret set nonempty. Non-null assertions do not conceal an undefined label on valid solved inputs. This internal helper is not an arbitrary malformed-score API.
- Complexity is **O(n²)** interval scanning, O(n) retained storage (plus sort); not a new exhaustive or unbounded position search. Here n=237 written contacts per trial. Accepted contacts are bounded by searched successors; the unchanged outer 5000 ms timeout also covers postprocessing. Large-input scaling is not claimed improved.
- Reproduced the original one-bar counterexample from the isolated tracked baseline: old `(fret 4,finger 1)` above `(fret 2,finger 2)` becomes fingers 4/2 without moving notes/positions. Added a frozen-input, four-finger, input-order and exact-release regression to the musician's two tests: **3 tests / 19 assertions** pass.
- Independently reran actual-song old/new engines at 0/2/compare with the actual receipt: **only finger labels and revision digest change** (144/127/127 labels). The specified-transition repeated study's entire result is byte-structure equal old/new. Existing specified-speed, repeat-boundary, held-role and authoritative-lock tests still pass. This heuristic is **not a proof of hand biomechanics**.

## Exact source and musical gate

Read actual fresh source/selection/request/brief/plan, old immutable score, musician rationale/hard-spots and trials—not just summaries. Fresh canonical events, parts, key, bars, tempos and form equal the previously raw-reconstructed source exactly; all twelve raw hashes/lengths and unchanged pitched-part artifact identities rechecked. No unrelated importer investigation was repeated.

Parent-attested actual task/call is `node:delegated-task:command%3Amcp%3A620ca5f8-6224-4a65-b107-1cb562d2b34d%3Adelegate-task%3Aguitar-easier-reach-musician-r3`, provider `opencode`, model `openai/gpt-6.1-sol`, variant `xhigh`. `2026-10-21T08:41:37.596Z` is the **parent wall-clock immediately before delegation**, as recorded in `delegation-call.json`, not a fabricated provider timestamp. This reviewer did not independently recover a provider transcript; task execution/output reading is parent-attested. Both exact Plan copies hash **`58adb71d3453d8de7770b4ad34449f8ad6d618da301ef677b061ea6079adbe11`** (31,421 bytes). Fresh source is `source-159a45dd-c001-4ebe-adbb-b3b6313c1472` / `588b1a6cc871fc4b8fe0a4cd706b5d70774b284b13ebc20814cd532a11e4cfdb`; request digest `9cbad5ea5f0a6b8cca23e04643bf8ffa3ca43ce8c937d42e16f5fd9bcb8f7e34`.

Fresh integrated bounded trials at 0/2/compare pass in **1347/1221/2467 ms**, unchanged **10000-state / 5000-ms** budget. Compare actually chooses **capo 2**, standard tuning, original concert melody/key. Every field of the worker realization is reproduced except its evaluation-only fallback provenance/digest, replaced with the actual receipt. Published score differs from the reproduced actual-receipt compare result only in orchestration-owned project/revision headers. No plan or receipt was edited.

Independent Fraction oracle checks **173 written / 245 performed melody attacks, all 141 vocal attacks, 16 selected rests plus explicit bar-42 silence, full sustains/ties/spellings/intervals**, literal **64 occurrences / 256 quarters**, five written tempo points and all 64 effective tempo entries. Full role order, string/finger occupancy, contact start/release and every hand-state boundary/anchor agree. All **64** proposed accompaniments are retained at their exact source onsets/durations: **55 bass + 9 harmony written, 80 + 9 performed**, no hidden engine omission/shortening. Fifty prior role/source choices retained, **108 author omissions and 14 different selected source attacks**; zero engine omissions must not hide author thinning. Bass supports 43/46 written bars.

| Descriptor (not comfort measurement) | Old published capo 0 | Revised capo 0 | Revised capo 2 |
| --- | ---: | ---: | ---: |
| Maximum physical fret | 9 | 7 | 7 |
| Maximum stopped-fret span (opens excluded) | 3 | 3 | 2 |
| Maximum sounding / stopped contacts | 3 / 3 | 2 / 2 | 2 / 2 |
| Seconds with stopped span >2 | 25.784483 | 4.527778 | 0 |
| Occupied-minimum-fret travel proxy | 304 | 223 | 123 |
| Largest step / rate proxy | 5 / 36 | 5 / 36 | 3 / 9 |

Independently confirmed old/new hard spots: bar 1's held low-string physical-7 bass under physical-4 lead is gone; 12/24 bass enters after the pickup using an existing beat-3 source attack; long G# anchors are replaced by real short source pulses; 30/38/43 physical-9 bass under high melody is gone; 35 opens with exposed lead instead of the 7/6/4 triple shape. These are real source-event/texture changes, not a tempo reduction, transposition, early melody release or label-only “simplification.”

**Remaining demands/tradeoffs:** 29→30 retains the **111.111 ms** A#3→B3 pickup and zero release gap (now relative frets 1→2 with different fingers and open B bass). In 12/24 E4→G#3 is still an eight-semitone drop after **166.667 ms**, one-fret/two-string-index change; later C#3/G#3 is a stopped span-2 dyad. Low echo 34's 1→4 move has **333.333 ms** onset spacing and zero gap; 36 includes open E3→stopped D#3. Widely separated-string dyads remain, including outer-string G#2/G#4 and A2/G#4. Capo 2 folds unavailable E bass upward; **nine source-line contour direction reversals**, bass F#2–E3, no octave-sized bass leap or role crossing. Bars 16/28 are not better on every axis: old open G becomes relative-3 over relative-1 bass. New labels still have **49 zero-free-gap reassignments** (old 240). Proxy 304→123 is **not measured hand displacement**. Thinner harmony/bass continuity, acoustic decay/balance, source selection and unresolved repeated final F# require human audition.

## Actual artifacts and live viewer

Canonical publisher ran without overrides or fake exporters, then a second bounded CLI invocation returned `reused:true` for the same ID and original bytes. Two independent MIDI parsers match **all 334 role/pitch/on/off events (245 melody / 80 bass / 9 harmony)**, channels 0/1/2, acoustic program 24, PPQ960, 64 tempos, balanced pairs, every track and final note-off at **245760 ticks / 172.405524 s**. No second capo offset. Uniform velocity 82 is not expressive acoustic performance.

PDF parser checks **all 11 pages / 32 systems / 64 occurrence and tempo labels / 345 staff-note placements**, every printed per-string capo-relative fret/tie sequence, staff diatonic positions, embedded Bravura and staff/TAB raster geometry. Directly inspected pages **1/3/6/7/11** for changed bars **1/12/30/35** and `o64/S46/P4 FINAL` / final double bar. Printed frets are capo-relative; canonical finger suggestions are not printed LH digits. This is not an optical proof of every accidental/beam.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| score.json | 624935 | `af015126dd87d565a9562177fb1c746a4e18058771a732df8e3c554dab612256` |
| arrangement.pdf | 80829 | `27ac7ea2d07d7feb18be9db04f704c9056524f15ac54b04d85df701ba70cce8f` |
| arrangement.mid | 5417 | `cee42fdd8c4ab3a7a30a04ce033c8b6fa22345a9f32bf199192c5bc4996a9295` |
| notes.md | 39808 | `5ddc203c9a1f6f25c8b9ed371414a11353014db7440b979ab582d0e8d43b0598` |
| manifest.json | 3488 | `a024b29897fcaedd0ac9f4a2f42a2e5aced42fdf203d0168b9fde9913bfc50bf` |

Exact viewer/PDF/MIDI and associated files GET/HEAD return 200 with correct MIME, length/cache/ETag; all download bytes equal disk and manifests. Compact HTTP manifest equals disk JSON semantically. Library has both revisions, zero unavailable entries. Old publication is separately HTTP/hash checked. Real Chromium opens the exact new library entry, deep-loads/reloads, downloads both exact artifacts, shows **Capo 2**, original pitches, draft and 245/80/9 role counts with **345 native targets**. Native WebAudio runs and seeks bars 1/12/30/35/46; complete actual scheduled pitch multisets match the new score. Existing controls were not needlessly retested in full. Numerical seek-boundary records **0.89–5.33e−15 s** are preserved/disclosed, not counted as audible extra attacks. No page errors or non-GET/HEAD page traffic. Desktop/mobile verified; mobile full-size notation scrolls internally and final bar is accessible, not shrunk to fit.

Desktop browser MCP was disconnected; one attempt is retained as an environment limitation, then documented local Playwright/Chromium libraries worked. No visual or playback claim relies on the disconnected tool. Notes remain a **39,808-byte audit**, not concise guitarist prose; author omissions and remaining hard spots are explained here/chat rather than silently rewriting immutable notes.

### Captures (Nextcloud anonymous MIME/SHA verified)

- [Desktop opening](https://nextcloud.tail750ac6.ts.net/s/fGoje4qgs4kk5GS): [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/fGoje4qgs4kk5GS/kb9WFycJhNQIPm54.png), SHA `6f9f97c5902f05b1af3475a81e027f7eea8cb2b818bf263289d9a3ccd8885d5d`.
- [Mobile final bar](https://nextcloud.tail750ac6.ts.net/s/p6HfQGsj8xDE9We): [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/p6HfQGsj8xDE9We/ss4tvayutib4P0dx.png), SHA `649f8eca676c4489c7d61f27200cb2ef2c7b79a8da93175679c85a34048e1c35`.

## Checks, reproducibility and preservation

Frozen install, agent typecheck, **14 agent tests / 78 assertions**, full root aggregate pass. Final root phase **150 pass / 2 optional skips / 11 existing TODO / 0 fail / 1126 assertions**; viewer **6 pass / 68 assertions**. Hooks overlap and are not added together. Initial pre-extra-test aggregate also passed (149/1118); final run includes the reviewer's added test. Existing Vite chunk-size warning remains nonblocking. Wrong receipt raw digest/source/request, paired MIDI pitch corruption and wrong expected PDF fret are rejected. No validator weakening or fabricated musical/human approval.

Rerunnable versioned checkers: `easier-reach-verify-r3.ts`, `easier-reach-oracle-r3.py`, `easier-reach-browser-r3.mjs`; `final-arrangement-artifacts.ts` now accepts explicit `EXPECTED_ROLE_COUNTS='{"melody":245,"bass":80,"harmony":9}'` while preserving the old default. The oracle does not import production music code. Private output root **`/tmp/opencode/guitar-easier-reach-review-r3`** contains `publish-result.json`, `publish-reuse-result.json`, `root-verification.json`, `independent-oracle.json`, `artifact-verification.json`, `browser-independent.json`, logs, captures and **`final-integrity.json`** for parent spotcheck. Full source/raw/plans/scores/exports/rasters stay local/ignored, never staged.

```sh
export RUN_DIR="$PWD/.agent-runs/53333fc4-595b-4aa0-9928-660693241a43"
export AUTHOR_DIR=/tmp/opencode/guitar-easier-reach-r3
export REVIEW_DIR=/tmp/opencode/guitar-easier-reach-review-r3
export PUBLISH_RESULT="$REVIEW_DIR/publish-result.json"
export OLD_RUN_DIR="$PWD/.agent-runs/658a04d3-2dbc-4431-925e-d209b10cab3a"
export OLD_SCORE="$PWD/.arrangements/arr-1c71e20ba1a631bee396c7118e38a951f2842e93680295662e3c1a4ccbdebaf5/score.json"
BASELINE_DIR="$REVIEW_DIR/baseline" bun docs/evidence/easier-reach-verify-r3.ts
python3 docs/evidence/easier-reach-oracle-r3.py
EXPECTED_ROLE_COUNTS='{"melody":245,"bass":80,"harmony":9}' VERIFY_ORIGIN=http://beelinkk:5571 bun docs/evidence/final-arrangement-artifacts.ts
LD_LIBRARY_PATH=/tmp/opencode/hece-browser-libs/usr/lib64:/tmp/opencode/dernek-document-preview-deps/usr/lib64 CHROMIUM_PATH=/home/taytay/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome VIEWER_URL=http://beelinkk:5571 bun docs/evidence/easier-reach-browser-r3.mjs
```

Final audit confirms **148 protected files unchanged**, including the fresh run, all prior publication bytes and musician outputs; the original TSV prefix is exact with four appended rows. The tracked diff is limited to the four code/test files plus owned review evidence/TODO/append-only decisions. Code and evidence are separate commits. Historical failures, previous draft and prior reviews are preserved—not rewritten as comfortable or human-approved.

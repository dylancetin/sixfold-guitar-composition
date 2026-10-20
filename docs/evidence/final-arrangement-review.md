# A04 independent musician/artifact review — round 2

## Verdict

**VERIFIED for source-grounded musician-plan review and delivered, hard-validated unreviewed draft. No remaining concrete note-level musical blocker.** M1's bass-foundation fault and M2's specific low-register congestion are resolved in the actual realization. **Human listening, melody-selection approval, movement calibration and final playable-release acceptance remain INCONCLUSIVE / pending (G5).** A model judge is not a human guitarist. These limitations do not block draft downloads.

Root began clean at `4b900f70f71018c44dd657cb45bc2f612051ab50`. This reviewer used only integrated root engine/validator/adapters/publisher; no worker override, subagent, app change, plan edit, new provider credential or in-site creation feature. Author serialization/evaluation/finalization scripts were inspected, not rerun. All source/full-song outputs remain ignored/local.

## Delivered immutable publication

ID **`arr-1c71e20ba1a631bee396c7118e38a951f2842e93680295662e3c1a4ccbdebaf5`**; stamped revision `revision-bdd2fd69-c433-4361-90c8-e6a82a7d5f86`, canonical revision digest is the ID suffix. Status remains `unreviewed-draft`; score approval stage is `sourceReady`, `musicalReview.status` is `pending`. No accepted review was fabricated.

- [Viewer/player](http://beelinkk:5571/arrangements/arr-1c71e20ba1a631bee396c7118e38a951f2842e93680295662e3c1a4ccbdebaf5)
- [PDF](http://beelinkk:5571/arrangements/arr-1c71e20ba1a631bee396c7118e38a951f2842e93680295662e3c1a4ccbdebaf5/arrangement.pdf)
- [MIDI](http://beelinkk:5571/arrangements/arr-1c71e20ba1a631bee396c7118e38a951f2842e93680295662e3c1a4ccbdebaf5/arrangement.mid)

All three exact absolute URLs were HTTP-tested; the actual final ID was opened from the library, deep-loaded and reloaded in Chromium. Viewer HTML alone is not the evidence: final manifest, canonical score, notes and downloads were checked. PDF/MIDI GET and HEAD return 200, respectively `application/pdf` and `audio/midi`, attachment disposition, matching Content-Length, immutable cache and ETag. Downloaded bytes equal persisted bytes and the integrity/per-format manifests. Library has exactly this one publication, zero unavailable entries and its exact manifest. Unknown direct file returns 404; POST library returns 405.

| Persisted file | Bytes | SHA-256 |
| --- | ---: | --- |
| score.json | 921770 | `8174e58b0ef47bd2fc6c2485d158fce58b5528d73a0d0bb5a06c18b50ed068d0` |
| arrangement.pdf | 97077 | `d634600ae37011c658859d42fe29655379e2182775654e3e86e8b47118ce3829` |
| arrangement.mid | 6877 | `ae225ab767b046a4df3f8ac60400082591181e638d4af33d90d5902ddc24023c` |
| notes.md | 86090 | `09a3057dee8a703634b5a61f7f4a1faee968c2a885176515f791da13697a63f3` |
| manifest.json | 3467 | `6ca1f1615a62eb58dee73eb5b7e2691760aeeeef97f8e24791b5fc69591d7b77` |

HTTP serializes the parsed manifest compactly (2718 bytes; SHA-256 `408cdb872091d2e9c8a845342c81a3e63601073de1556b8d1cd5950cf0e1fe6b`); its JSON is exactly equal, not byte-identical to the indented disk manifest. Score/PDF/MIDI/notes are byte-identical.

Retained Project Shelf server **`c10c5079-9817-4b14-b9db-3b2e0345ae99`**, idempotency `guitar-final-delivery-root-4b900f7-v1`, root cwd, command `ARRANGEMENTS_DIR=/home/taytay/.t3-nightly/projects/guitar-composition/.arrangements bun run start`. Parent/operational worker supplied readiness and 27 preflight HTTP checks in `/tmp/opencode/guitar-final-delivery-preflight.json`. Reviewer started no server and did not change/stop the old 5847 smoke. The final 5571 server is retained for inspection; no permanence beyond its managed lifecycle is promised.

## Real call and fresh identity, not renamed authorship

Read round-2 `rationale.md`, `author-decisions.json`, plan, metadata, generation, evidence and six realized scores under `/tmp/opencode/guitar-musician-r2/`. Independently hashed all three exact Plan copies (`plan.json`, `model-response.json`, `original-model-plan.json`): **`1c867ff80d1ddeb63e618054b5505ca9ba53b752b8e2569f876844ed8e7eb0f3`**, 71438 bytes; canonical Plan digest `a60b9bd687767705b51f324c5fa919d4384bc12429579811fdf204b39aee7d5f`.

Actual task/call, explicitly parent-attested in this review brief:

```text
provider: opencode
model: openai/gpt-6.1-sol
variant: xhigh
taskId = callId:
node:delegated-task:command%3Amcp%3A6402f533-82cb-4de9-b53f-d4ed4f0055a5%3Athread-send%3Aguitar-musician-correction-r2
requestedAt/calledAt: 2026-10-20T23:13:43.840Z
startedAt: 2026-10-20T23:13:43.879Z
```

This is an orchestration call ID, **not** a claimed provider HTTP request ID. Fresh preparation is `.agent-runs/658a04d3-2dbc-4431-925e-d209b10cab3a`, source `source-2f02d677-7bfc-4abc-a1ad-8eb78506451c` / `20cc8fa7721fb6b3b3473bcb9f3c509fd2a389bfa9f9718ec6f5f771ef163813`, request digest `935eadf3e14ee40368e4d5735a355d2a718ec8a4c54163dfb6f5e46d9193ac26`. These differ legitimately from round 1. Schema/source/request/raw-byte acceptance passed. As expressly authorized, reviewer copied the exact plan and parent-attested metadata into fresh `plan.json` / `delegation.json` using exclusive additive writes, not the old receipt. Every final score planner field, accepted candidate ID, top-level manifest task/model, per-format score/source identity and raw-response digest is bound and checked.

Fresh receipt raw SHA-256: `39c03d094f1e0154f3234a05858313aa58ec6b50fe78b6d13f53855df79e900e`; bytes equal the supplied round-2 `agent-metadata.json` exactly.

**Audit limit:** `task_status` from this review child returned `task_not_found` because the musician task belongs to the parent; scoped thread listing exposed no musician transcript. No local `agent-transcripts/`/transcript file was found. Therefore durable parent timestamps/model/variant are parent attestations corroborated by the supplied task output, **not an independently recovered full transcript or provider trace**. Nothing is invented to fill that gap. This round reviewed/selected existing source-based musical choices and made one real omission; neither matching a baseline nor differing from it proves composition/authorship by itself.

## Independent source and musical findings

Fresh standalone Python `Fraction` oracle reconstructs all **1677 canonical pitched events from ten raw pitched parts** (percussion excluded), all 12 raw artifact hashes/lengths, exact beat fractions, rests, merged tie refs, raw repeat markers and tempo automations. Songsterr song 692866 / upstream revision 847990 / format 5 agree. This establishes fidelity to the saved transcription, not that the upstream transcription equals the recording by ear.

Exact unapproved selection remains part 1 in written 1–4 and 34–37; part 0 in 5–33, 38–41, 43–46; source-backed silence in 42. All **141 main-voice notes, 173 written / 245 performed melody attacks, 172/244 successive intervals, 16 source rests plus the explicit silent bar**, spellings, onsets/releases/ties remain exact. Literal form `1–7,5–7,8–19,17–19,20–46,43–46,43–46,43–46` is **64 occurrences / 256 quarters**. Key remains unknown, preserved concert pitches at both capos; no asserted B-major metadata or transposition.

### Preserve the original failed moments

Round-1 independent `/tmp/opencode/guitar-musician-review/REVIEW.md` passed then-existing static/artifact gates but rejected the musical rationale. M1: source E1→B1 (+7) became E2→B3 (+19) in bar 8; bass B3 stood above A3. Later C#4 stood above E3 and fell −19 to F#2. There were 10 written / 16 performed crossings and 25 written octave-sized bass leaps. Subsequent independently integrated M1 correction is preserved in `engine-m1-review.md`, not attributed to this musician call.

### What is now musically supported

- **M1 resolved in actual sounds, not role labels:** bar-8 B is B2 (47), below A3 (57), with source +7 contour; later C#3 (49) lies below E3 (52). Bar-42 B is B2, not the earlier high fill. Every full-sustain role order is bass < inner < melody; both capos have zero crossings/octave-sized bass leaps. The low root remains the actual foundation rather than an unintended inversion.
- **M2 resolved by the author's only Plan change:** remove `harmony-bar35-p7-bt4-n0`, source `p7:b35:v0:bt4:n0` E5 (76) proposed as E3 (52), written quarters [138,139). Retain trial independently confirms E3/G#3 for half a quarter (**major third**), then E3/F#3 for half a quarter (**major second**). Final trial exposes the low G#3–F#3 lead on beat 3 while preserving the opening B–D#–F# sonority and last-beat B/E. Every other realized pitch, onset, duration and spelling is identical, including the complete bass. It is a defensible transparency preference, not a claim of having heard an improvement or reduced whole-song movement.
- Source-backed G#/G pedals, sparse inner thirds/sevenths and low echo without added accompaniment in 37 retain phrase support without orchestral doubling. Final source F#2 remains at the last beat of 46 in all four passes; no invented tonic cadence/fade/pass variation.

| Fixed-engine final comparison | Capo 0 (selected) | Capo 2 |
| --- | ---: | ---: |
| Written bass / harmony | 92 / 66 | 92 / 66 |
| Performed bass / harmony | 146 / 98 | 146 / 98 |
| Same-line source contour error | 0 semitones | 96 semitones |
| Source contour direction reversals | 0 | 8 |
| Bass range | E2–C#3 (40–49) | F#2–E3 (42–52) |
| Maximum physical fret / stopped span | 9 / 3 | 9 / 4 |
| Maximum sounding / stopped contacts | 3 / 3 | 3 / 3 |

Both capos are hard-valid. No capo better preserves low E and actual source bass contour, **not demonstrably easier overall**: author min-stopped-fret proxy 304 versus 160, max step 5 versus 4, max rate 36 versus 9 frets/s. These are occupied-fret proxies, not hand trajectories/calibration. Capo-2's eight low-E folding reversals do not prove every possible joint voicing must reverse. Attack counts are accounting, not a musical-quality score.

Six fresh **root** outer-worker trials exactly reproduce the author's scores: retained 0/2/compare **1760/1669/3127 ms**; omitted **1794/2057/3099 ms**, with unchanged **10000-state / 5000-ms** budget. All pass independent validator **`independent-guitar-validator-2-role-order-v1`**, with `transition-unverified` / `uncalibrated`. No wall-time bypass. Root CLI first successfully publishes; a second genuine bounded-CLI run returns `reused:true` in **4.35s total command wall time** (not a measurement of engine-only time), reusing all original immutable bytes. Published music differs from the reproduced compare candidate only in orchestration-stamped project/revision headers.

Final engine audit: **88 bass + 57 harmony register adaptations**, one bar-35 bass shortening 1.5→1 quarter before melody B2, **zero engine omissions**. Separately **one author omission** above is retained in evidence; zero engine omissions must not conceal it. No source/plan edit was used to clear a check.

## Actual final artifacts, HTTP and browser

- Two independent MIDI parsers (`midi-file`, `@tonejs/midi`) match **every one of 489 actual role/pitch/on/off intervals: 245 melody + 146 bass + 98 harmony**. Format 1, PPQ960, acoustic program 24 on channels 0/1/2, 64 source-derived effective tempo entries, balanced pairs; all four track ends and final note-off **245760 ticks / 172.405524 s**. No extra capo/tempo offset. All velocities remain **82**, not encoded expressive melody prominence.
- PDF.js checks **all 11 A4 pages, 32 systems, 64 source-bar/pass labels, 64 tempo captions, embedded Bravura, 505 actual staff-note placements, every printed per-string fret/tie sequence and staff diatonic position**, plus staff/TAB geometry/raster bounds. Reviewer directly inspected pages **1/6/11** and changed-voicing pages **2/7**. New low bass, isolated bar-35 melody and `o64/S46/P4 FINAL` / double final bar are present. This is not an optical proof of every accidental/beam/dynamic.
- **Five production Chromium workflows pass** against 5571, including real browser download hashes. Independent non-substituting native WebAudio observer verifies running clock/oscillators, mute gains `[.65,0,.65]`, solo `[.65,0,0]`, pause/stop, 50% same pitches/double holds, two actual loop wraps with moving cursor, final measure seek/zoom and **505 native note targets**. All actual scheduled pitches in source bars 8/35 match the canonical multiset above a 1-nanosecond numerical tolerance. The seek scheduler can emit just-ended predecessor records of ~**2.7e−15 s**; raw observations are preserved, not claimed to be additional audible musical attacks. Exact canonical/MIDI attacks remain integer-tick checked.
- Desktop 1440px and mobile 390px are directly inspected. Controls/downloads/draft label remain clear, no page overflow; the full-sized mobile score scrolls internally and final bar remains accessible. No page JS errors or non-GET/HEAD browser requests. Real browser scheduling is **not** human listening or physical latency calibration.
- Negative controls: fresh restamped melody octave/onset edits and held bass-over-inner mutation fail substantive real-validator checks, not stale-digest only. Actual canonical adapter rejects a forged passed envelope around the role crossing. Wrong raw-plan digest/source/request receipts fail. Structurally valid paired-pitch MIDI corruption fails interval decoding; unchanged PDF with a mutated expected fret fails content checking. All mutations are isolated in memory, never final artifact edits.

### Captures (anonymous Nextcloud MIME/SHA verified)

- [Desktop / actual revised bar 35](https://nextcloud.tail750ac6.ts.net/s/jB37MppA9FpHR4g): [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/jB37MppA9FpHR4g/whxC7uJ9YGQzbb0g.png), SHA-256 `32ab8f558af9614b9c0c5930d8482e814cdb056a62a65737f9882d761d9c4711`.
- [Mobile / actual final pass and bar](https://nextcloud.tail750ac6.ts.net/s/S3iQ4ijyGC9PzfC): [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/S3iQ4ijyGC9PzfC/uAN4xdUNzyS0nn3W.png), SHA-256 `19dd3cf6628887aa6fc7584dd99b3eee820629b1853a029bf26b80ccd377b341`.

## Remaining exact human questions — nonblocking for this draft

1. Audition the unapproved part-1 intro/interlude / part-0 vocal map and intentional bar-42 silence against the recording.
2. Try no-capo fret-9 reach and full transitions at source tempo, especially 6/18 triplets, 12/24 pickup, rapid 29 pickup and low 34–37 echo. Static span 3 and a synthetic intermediate profile do not establish comfortable movement.
3. Judge melody/thumb/inner balance and natural decay of eight-quarter G# and five-quarter G bass sustains. Uniform-velocity MIDI / synthetic pluck is not acoustic performance or proof of quiet thumb.
4. Judge repetition of all four 43–46 passes and the source unresolved final F#2; do not invent a preferred ending before that audition.

No new objective musical defect was found requiring another author round. Generated `notes.md` remains **86090-byte audit-oriented content**, rather than the author's concise guitarist opening, and does not narrate the omitted candidate. The concise source-based rationale and explicit author omission are preserved above and in author metadata/chat handoff. This is disclosed content usability debt, **not a new creation UI/redesign requirement or hard draft blocker**. Immutable notes/artifacts were not rewritten after publication.

## Reproduction and audit

Frozen install, explicit agent typecheck and 14 agent tests/78 assertions pass. Root aggregate passes all 13 existing hooks plus viewer checks/build: all-root phase **147 pass, 2 optional live skips, 11 existing TODO, 0 fail / 1107 assertions**; explicit source/adapters/agent hooks overlap those totals and are not added. Six viewer boundary tests/68 assertions and five browser workflows pass. Optional live test skips are not relabeled; the six actual-song root reproductions above run independently. Existing Vite chunk-size warning remains nonblocking.

Committed rerunnable checkers require private inputs, not copyrighted fixtures:

```sh
export RUN_DIR="$PWD/.agent-runs/658a04d3-2dbc-4431-925e-d209b10cab3a"
export AUTHOR_DIR=/tmp/opencode/guitar-musician-r2
export REVIEW_DIR=/tmp/opencode/guitar-final-review
export PUBLISH_RESULT="$REVIEW_DIR/publish-result.json"
# Receipt already installed; omit INSTALL_RECEIPT on read/reproduce runs.
bun docs/evidence/final-arrangement-verify.ts
python3 docs/evidence/final-arrangement-oracle.py
VERIFY_ORIGIN=http://beelinkk:5571 bun docs/evidence/final-arrangement-artifacts.ts
LD_LIBRARY_PATH=/tmp/opencode/hece-browser-libs/usr/lib64:/tmp/opencode/dernek-document-preview-deps/usr/lib64 \
CHROMIUM_PATH=/home/taytay/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
VIEWER_URL=http://beelinkk:5571 bun docs/evidence/final-arrangement-browser.mjs
```

Private primary results in `$REVIEW_DIR`:

| File | SHA-256 |
| --- | --- |
| root-verification.json | `f5a5771ef73565cc3bbcb1cbf63edff0ab3fd1956ebfc995ab6c7cc43ad725cf` |
| independent-oracle.json | `611af69e4d20f81015a933b8abf3cb55d3c2a1a4755768fa427b35c9af2d9258` |
| artifact-verification.json | `73f3cabf56f14b164efd6567e279ed67d69886677bbb953d1f4fb7a05ca7508f` |
| browser-independent.json | `e841fc6900d458afc351fb9cc820d2a29925bf1edef8f61de5644971a257faf5` |
| browser-workflows.log | `acdee299bb0810abd34b57b660bdf89a19e4be32be17122a308c9cc61ff61871` |

Reviewer checker/environment failures are retained, not called product passes: first artifact assertion mistakenly compared unfolded 527 mapping segments with 362 written segments; corrected using literal occurrence expansion. Next incorrectly required indented-disk/compact-HTTP manifest byte equality; corrected to exact manifest JSON equality, preserving all four other byte-equality checks. Initial Chromium launches lacked documented shared libraries; all five workflows subsequently pass with existing library paths. Independent browser probe first timed out at a generic gain/ready wait; later probes exposed vanishing seek-boundary records; final explicitly disclosed precision-aware check passes. Original failed logs remain local (`artifact-{initial,second}-checker-failure.txt`, `browser-initial-environment-failure.log`, `browser-independent-{initial-timeout,second-timing-failure,third-boundary-failure}.log`). No app or artifact was changed for these corrections.

Final audit (`$REVIEW_DIR/final-integrity.json`) compares the original canonical TSV prefix and production tree to `4b900f7`; only owned evidence/TODO/TSV changes are committed. **115 pre-review protected files** and **all 81 author-recorded prior files** retain raw hashes; administrative plan/receipt copies and all five publication bytes remain unchanged after reuse/HTTP/browser inspection. Full local source/raw/plan/trials/PDF/MIDI/rasters are not staged. Missing transcript limits above remain explicit; historical M1/M2 failures and earlier NOT VERIFIED verdicts are preserved rather than rewritten.

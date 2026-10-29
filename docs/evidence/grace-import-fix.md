# Grace import / complete draft regression — 2026-10-21

Requested source: Songsterr s31795, **The Beach Boys — God Only Knows**.
Preferences remain intermediate, standard tuning, sounding pitches preserved,
and best-capo comparison of 0/2.

## Fixed boundaries

- Parser 1.2.0 retains within-bar before/on-beat grace pitches and every raw
  reference, realizes bounded source-player time borrowing, and excludes grace
  notation from metrical/swing sums. Unknown, ambiguous and unsupported
  cross-bar cases still fail rather than dropping notes.
- Validated descriptive `title` and numeric `grandStaffGroup` no longer reject
  otherwise complete parts. Unknown musical fields remain fail-closed.
- Known hp/legato and staccato flags remain source articulation evidence.
  Nominal grid durations are used in the draft; expressive gating/legato and
  glyphs are not reproduced. Publication notes explicitly disclose this and
  the use of realized note values rather than small ornamental grace glyphs.
- Instrumental fallback uses an existing locally monophonic source alternative
  in the standard-guitar register instead of selecting an unreachable high
  flute line and then transposing it. The selected parts/sections and pending
  musical-role review are visible in notes.
- Large-source worker deadlines scale from 5 to at most 30 seconds, while the
  deterministic 10,000-state bound and musical/physical preferences remain
  unchanged. Every run still has an enforced hard deadline.

## Verification

- Frozen install, agent TypeScript check, 74 source tests, 15 agent tests,
  and `bun run check` passed.
- Original grace and swing exercises pass the real engine/validator and real
  canonical PDF/MIDI exporters. Independent MIDI parsing checks literal tick
  boundaries; actual PDF bytes contain staff/TAB glyphs.
- An original ornament exercise also passes actual atomic publication with
  both canonical exports and honest source-interpretation notes; no storage
  exporter test double is used for that regression.
- Actual unrestricted acquisition: 83 written bars, 25 part identities,
  6,392 canonical events. An independent raw-member oracle checked all 6,824
  pitched-part member slots map exactly once, with original pitch/fraction
  references; 131 grace members survive. Four unsupported percussion identities
  remain explicitly raw-only, as before.
- All 225 original lead-vocal attacks are protected. The complete disclosed
  selection has 261 notes, including existing source-part 18 instrumental
  alternatives, and source-grounded rests through all 332 quarters.
- A complete deterministic **smoke only** produced actual 83-occurrence PDF
  (112,476 bytes) and MIDI (6,709 bytes), 400 attacks, with both capos evaluated.
  This smoke is not model authorship or final-arrangement acceptance evidence.

Full source/raw/music/artifacts remain ignored and local. Final model-task,
publication, HTTP and independent judge evidence are recorded separately in
the ignored arrangement run; no human musical approval is implied.

## Actual model-plan publication and browser checks

The actual musician task and final-run review retained a source-reviewed plan
of 75 bass and four inner-harmony candidates. The factual parent receipt hashes
the exact UTF-8 plan bytes and binds the real T3 task to the final source/request.
It does not claim a provider HTTP call ID or human approval.

The canonical publisher installed complete immutable unreviewed draft
`arr-070039eac93573064ed41e0e0a193f27108832c5ae19ebaa97dd7ce05da11c59`.
Both capo trials produced candidates; capo 0 retained 75 bass/four harmony
attacks versus capo 2's 72/four. The final union has 340 attacks, including all
261 selected melody notes, through 83 occurrences.

- Canonical PDF: 104,092 bytes, 14 pages; actual PDF text/operators show
  staff/TAB and embedded Bravura on every page. SHA-256
  `0f48c2484298401fe43f0a777cdbad821cd58d67313d7c86effbb74db0f31753`.
- Canonical MIDI: 6,118 bytes; independent parsing matches the complete
  role/pitch/attack/release union, with balanced notes and end tick 318720 at
  PPQ960. SHA-256
  `4565f62a5bce006a89ca429b1439c85831817da7615c7a3b45ac5e140ca23655`.
- Exact viewer/PDF/MIDI/score/notes URLs at `http://beelinkk:4590` all returned
  HTTP 200 and their intended MIME types; downloaded file bytes matched both
  immutable storage and publication integrity hashes.
- Real Chromium rendered the final page without page errors, advanced the
  playback clock, paused/stopped, toggled bass mute, sought measure 83, downloaded
  a real layout-aware PDF (106,784 bytes), and downloaded MIDI matching the
  immutable canonical file. The source-selection/expression caveats were
  visible in the published notes. Screenshot capture/upload succeeded.

These are draft/software/export checks, not human musical acceptance. The
independent model publication review is a separate recorded gate.

The preliminary independent judge reconstructed every source event and passed
the raw/form/physical/smoke-artifact checks, but requested a grace-count wording
clarification. Notes now distinguish **131 imported private-source grace
attacks** from **six retained performed grace-derived attacks**. A regression
with unselected ornaments checks six imported versus three retained attacks.

That clarification was installed as a fresh immutable arrangement identity in
ignored run `ec39f5dd-9891-4871-bf40-1976df0db450`; the earlier publication
`arr-4242bf309bb088e79ca29d76bdfd52477f8a01197aef7516c0b29c7476959098`
was not overwritten. Source, request and exact actual model output/receipt
bindings remain unchanged; all score fields except new project/revision
identity compare equal (musical-body SHA-256
`7bb18b248aa1bd817bf3a1579cc448a84f9329ef5037497eb375dcf6f4415dea`).
This reuse is not represented as another model call or newly authored music.

The separate final musician-plan judge returned **PASS for sharing as a
hard-validated unreviewed draft**, with no hard blockers. It independently
checked all 340 MIDI attacks/releases, 83 bars, 14 PDF pages/42 staff+TAB
systems, the actual capo comparison, source/request/receipt/plan bindings and
full held-contact sweep (maximum physical fret 7, stopped span 3, three
simultaneous contacts). This verdict does not establish audible/human audition
or final playability. Its review targets the identical musical body of the
initial publication; the notes/identity-only reissue has a separate delta review.

The delta judge also returned **PASS with no hard blockers**: exact input/plan
reuse, honest original task/time, fresh first-publication identity, corrected
131-versus-six wording, unchanged full musical score body, unchanged PDF musical
glyph geometry on all 14 pages, complete exact MIDI union, all five fresh HTTP
downloads and the regression/typecheck. The full round-2 verdict had separately
completed with PASS, satisfying the delta judge's handoff condition. Combined
review permits sharing the tested **unreviewed draft**, not claiming human
approval, expressive-performance fidelity or final playability.

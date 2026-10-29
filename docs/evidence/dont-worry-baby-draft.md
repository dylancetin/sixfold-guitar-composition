# Don't Worry Baby — actual draft publication

User request: Songsterr song 62399, intermediate, no capo preference. Standard
tuning and sounding source melody preserved; compare capos 0 and 2. Source
upstream revision 8073392; no restricted-source bypass or substituted demo.
Full source/raw data, plans and generated song artifacts remain ignored/local.

## Import and interpretation

- Full-measure rests in non-4/4 meters retain their raw fraction and use the
  explicit current meter for silence.
- Part 2 omits an upstream version. Its full musical structure is checked and
  retained, with `unversionedPartIds:[2]` in the canonical source identity.
  `formatVersion:5` is explicitly declared by the other supported versioned
  tracks; it is not assigned to part 2. All-unversioned/unknown versions still
  fail closed. This is an additive identity extension; old identities are intact.
- Closed legato/shift slides require a real contiguous, untied same-string
  destination. Original note endpoints/timing remain unchanged and both refs
  are retained in the interpretation effect. Continuous glides and slide glyphs
  are **not** reproduced; publication notes disclose nominal endpoint rendering.
  Open/unknown/orphan slides remain unsupported. No bend simplification was used.
- All seven track identities are retained. Percussion is explicitly raw-only.
  Rhythm-guitar chord metadata remains unsupported and intact.

## Actual musician task and exports

GPT-6.1 Sol xhigh, actual T3 provider instance `opencode`, model
`openai/gpt-6.1-sol`. Parent call at `2026-10-27T11:51:13.653Z`; actual child
requested at `11:51:13.689Z` and completed at `12:00:47.345Z` on that date.
The local receipt's call ID is the actual orchestration task ID, not a claimed
provider HTTP request ID. The parent read the finished task evidence.

- Exact plan-byte SHA-256:
  `fd7498e05b48541544294d9566fdd8f86781ee9c38e2e2d83cbafeabadd3b840`.
- 134 source-reviewed sparse proposals: 81 bass and 53 piano inner notes.
  Retained useful baseline anchors with actual phrase-based review; no claim
  that retaining those choices constitutes newly composed source material.
- Canonical engine and independent validator accepted the immutable draft.
  Capo 0 was selected after both 0/2 candidates retained the planned texture,
  with lower bass-register/contour adaptation cost for capo 0.
- 88 written/performed bars, 272 melody + 81 bass + 53 harmony attacks.
- PDF SHA-256:
  `accb19c5e126845e27d847111826397496ef64ae6d40e1569270a30e72e7791d`.
- MIDI SHA-256:
  `201e44dc6fed6aaa5ec7fd1bb212dde31dfb4f331e779ae6bd43f4da775bd3c8`.
- Both real exports came from the canonical adapter and were atomically
  published under revision digest
  `b69cd9a452c83afd6035b9df6fe543119df2f502b52ade388d99b6009ede98fd`.

## Delivery checks

Existing Project Shelf registered Sixfold viewer reused at
`http://beelinkk:4590` with its read-only publication store. Exact viewer,
PDF, MIDI, score and notes URLs return 200; artifact MIME and downloaded bytes
match the immutable local bundle. PDF is 91,899 bytes; MIDI is 6,946 bytes.
Notes are deliberately served as `text/plain`.

Playwright browser verification: actual score loads with 47 SVG elements,
Play/Pause and bass mute work, no alert is shown. Screenshot was visually
inspected and uploaded through Nextcloud. The locally installed Chromium
lacks `libcups.so.2`; the available managed Playwright browser was used instead.
No retained server was launched outside Project Shelf.

`bun install --frozen-lockfile`, source checks (123 tests), agent TypeScript,
and `bun run check` passed, including agent tests, canonical-adapter integration
checks, viewer checks and production client build. Existing skips/TODO gates
are not promoted into song acceptance.

The separate GPT-6.1 Sol xhigh artifact judge completed at
`2026-10-27T12:14:43.932Z`, accepting the exact bundle **as an unreviewed draft**
with no blocking defects. Its independent raw reconstruction, melody/rest and
contact sweep, actual MIDI parser, PDF text/font checks and sampled visual review
are retained in the private run's `review/judge-report.md`. It verified 272
melody attacks and 59 rests, all 406 MIDI note pairs, and all 12 PDF pages;
pages 1/6/8/12 were actually rasterized and viewed. Visual inspection was sampled,
not every-page proofreading. Bravura music glyphs are embedded; standard PDF
text fonts are not. The standalone canonical PDF title is generic, but the
artifact is revision-bound; the viewer displays the actual song title.

Publication remains **unreviewed-draft** regardless of model review. Movement
is uncalibrated, the upper-neck interlude needs audition, and human guitarist/
musical approval remains pending. Browser checks do not prove audible or
human-playable acceptance. A final complete `bun run check` also passed after
the last source-diagnostic lookup change; the immutable bundle was not modified.

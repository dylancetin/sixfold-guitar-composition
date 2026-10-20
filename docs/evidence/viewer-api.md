# Read-only published-arrangement viewer

This replaces the application in archived `3285c2e`. Users request arrangements in
project chat. The site never imports, prompts, generates, edits, approves, saves or
publishes. No creation/backend feature is hidden behind a route or flag.

## Shared boundaries (no parallel publication validator)

- `src/publication/index.ts`: **actual** browser-safe `PublicationManifestSchema`,
  `PublicationIdSchema` and types from workflow commit `4a039f3`.
- `src/publication/store.ts`: **actual** server-only `readPublication(root,id)`. Every
  public bundle read uses its complete-file, manifest/ID/source/score/artifact integrity,
  hash and symlink checks. The viewer's `PublishedFiles` is a read-only listing/HTTP facade,
  not a second storage or digest implementation.
- `src/server/published-schema.ts` adds only library-response metadata: difficulty,
  capo and written/performed/attack counts read from canonical ScoreV1. It re-exports the
  shared manifest/ID schemas; it does not redefine them.
- The browser loads **ScoreV1**, never a validation envelope or renderer serialization.
  Manifest and score references must match. Server is authoritative for byte integrity;
  browser also recomputes score digest when WebCrypto is available (HTTPS/localhost).

## Server: one origin, reads only

`ARRANGEMENTS_DIR` defaults to `.arrangements`; `PORT` defaults to 3000. `bun run start`
serves built `dist/client` plus the configured publication root. It does not create a
directory, allocate IDs, write music, run jobs, call planners, fetch sources or read secrets.

| Method/path | Result |
|---|---|
| GET/HEAD `/` | library application |
| GET/HEAD `/api/arrangements` | valid shared manifests + canonical score summaries |
| GET/HEAD `/arrangements/<id>` | viewer application; survives pasted deep links/reload |
| GET/HEAD `/arrangements/<id>/manifest.json` | validated manifest |
| GET/HEAD `/arrangements/<id>/score.json` | exact published canonical score bytes |
| GET/HEAD `/arrangements/<id>/notes.md` | exact published text bytes, `text/plain` |
| GET/HEAD `/arrangements/<id>/arrangement.pdf` | exact published PDF bytes, attachment |
| GET/HEAD `/arrangements/<id>/arrangement.mid` | exact published MIDI bytes, attachment |
| non-GET/HEAD, **all paths** | 405, `Allow: GET, HEAD` |

Only the five fixed shared filenames are allowed. No wildcard workspace or agent-run
files, raw sources, environment files or arbitrary path joins. Unknown routes return 404;
present but corrupt/partial bundles return 409 and are hidden from the library with a
visible unavailable count. An empty/missing root remains an empty library and points to
project chat in prose, without a create button or fixture music. Public downloads are
immutable, same-origin links; there is no generation or export-on-demand endpoint.

## Actual canonical browser adapter

`src/client/canonical-entry.ts` uses only `src/adapters/index.ts`:
`createAlphaTabScore` and `createPlaybackController`. **No engine/source/planner imports.**
Vite preserves entry exports (`preserveEntrySignatures: 'strict'`) so the real
`/integrations/canonical.js` factory is callable after building; it is not a stripped shim.
Bravura is bundled locally, with dependency/license notices.

`alphatab-bridge.ts` lays out actual fragment SVGs at x/y, joins native beat/segment/
occurrence mappings, overlays the cursor, and supplies keyboard/click note inspection.
The score viewport is internally scrollable; zoom and follow are display-only. React
never owns the renderer's children, preventing the removal crash caught in the first run.

The separate canonical audio controller is the **only** audio path; alphaTab native audio
is never started. Play/pause/stop, occurrence seek, mute/solo, absolute practice scale and
half-open performed-measure loops call its exact methods. The already-effective tempo map
is not rescaled in the UI. Practice scale initializes from canonical preferences and calls
`setTempoScale(absoluteScale)`; it never mutates the published score or downloads. No gap
or tempo workaround exists in the bridge. The actual adapter fixes are `6f1f455` + `ee36792`.

Note inspection uses the selected occurrence's performed placement, not an assumed one
fingering for every pass. A read-only written-note picker reaches every sound where native
polyphonic beat hit bounds overlap. Canonical role attack counts, source IDs, capo reasons,
changes, profile uncertainty and review state remain inspectable.

`notes.md` uses react-markdown with raw HTML skipped, images rendered as plain alt text,
and only HTTPS rationale links enabled. No HTML is injected from notes; adapter-generated
SVGs have a separate executable/external-content rejection boundary.

## Integration and retained preview

The **standalone delivery commit is based on integrated root `95018b3`**. The parent
should pick that viewer-owned commit only; it does not require archived studio `3285c2e`
or the earlier delta `166fceb`. All 13 existing checks in `scripts/check-foundation.mjs`
are byte-for-byte unchanged, and their package scripts are retained. Viewer checks are
appended to the aggregate. The delivery commit changes no canonical domain/source/engine/
adapter/agent/publication implementation, workflow documents or canonical decision log.

The original isolated verification branch retains its separate dependency cherry-picks
and archived studio history. It continues serving the tested preview. Delivery verification
was repeated in `/tmp/opencode/guitar-viewer-delivery-196ee289` against the integrated root;
the viewer source/UI assets and screenshot states are unchanged.

Normal build needs the local shared publication modules and canonical adapters. A trusted
`VIEWER_ADAPTER_ENTRY=/absolute/path/to/src/adapters/index.ts` is available only as a build
override for an isolated committed dependency experiment; no renderer clone or test fallback.
Missing adapters show a real renderer-unavailable reason; actual downloads/notes still work.

Project Shelf retains `http://beelinkk:5847/` with ID
`bb98372d-7b4b-46cf-bc0d-10f904d12582`. Its dedicated store is the workflow worker's
`.arrangements` directory; no full copyrighted score/source/export is copied into Git.
The original 5895 study server was intentionally stopped and removed through Shelf.

Remaining product acceptance: independent reviews/root integration of the shared units,
actual musician-agent model-authored publication, independent artifact audit and human
audition/calibration. The current real song is explicitly a **deterministic smoke draft**,
not model authorship or a musically reviewed/playable release.

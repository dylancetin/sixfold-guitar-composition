# Independent A03 review — VERIFIED for read-only smoke unit

Reviewed standalone **`7e003c8778eca1e0c06951e74393e609ded9da4d`**, parent
`95018b3567febea38c65fbfc05fb695222169650`, in
`/tmp/opencode/guitar-viewer-delivery-196ee289`. Root was clean at that parent.
Only after independent verification, the sole authorized integration owner picked
that one commit as **`a6aa1ce315a13baffb30bdac25cb54d08c75da4d`**. Trees and stable
patch IDs match exactly. Archived studio `3285c2e` and intermediate `166fceb` were
not picked. This independent same-model reviewer spawned no subagents.

**No A03 integration blocker found.** This verdict does not approve the actual
musician plan, bass foundation, a model publication, human playability, or G11.
The separate engine/music correction remains outside this unit. The original
studio source-map/silence bug is superseded by removal of the editor, **not fixed**.

## Inspected boundaries

Read `AGENTS.md`, `docs/AGENT-WORKFLOW.md`, `docs/CONTRACT.md`, worker
`viewer-api.md` / `viewer-verification.md`, production client/server/build code,
shared publication schema/store, canonical notation/playback entry, and both test
suites. No production source/engine/planner/generation import, create/save/rebuild
route, credential form, writable endpoint or hidden study fallback was found.
`--study` explicitly fails. All mutation methods fail 405 before routing.

`published-schema.ts` re-exports the actual shared publication ID/manifest schemas;
its only additions are read-only library summaries. `PublishedFiles` calls the
shared server-only `readPublication`, retaining strict ID, path, complete-file,
symlink, exact-file digest, source/score/artifact and review-label checks. No copied
schema or parallel integrity implementation was substituted. Browser code consumes
ScoreV1 and browser-safe contracts; the built JS contains no filesystem/store,
PDFKit, source importer, engine or publisher implementation. The canonical
browser entry exports only notation/playback, not Node export authority.

The bridge forwards controls to the actual canonical playback controller, without
extra tempo/capo offsets or alphaTab native audio. Its sole audio path consumes
the performed union; cursor/inspection joins use canonical mapping and occurrence
IDs. Practice speed, mixer, loop, seek and zoom do not persist changes.

## Fresh executed checks

- Frozen install, viewer/client/server typecheck, **6 viewer boundary tests / 68
  assertions**, and explicit source aggregate **46 tests / 403 assertions** pass
  in the delivery checkout.
- After integration, frozen install and `bun run check` pass. The original
  **13-check aggregator is byte-identical** to `95018b3`. Package aggregation
  appends viewer typecheck, tests and production build. Broader root test selection
  preserves fixture/engine coverage and excludes Playwright from Bun discovery.
- Root aggregate: **138 pass, 1 optional live skip, 11 existing TODO, 0 failures,
  1,074 assertions** in the all-root phase; source 46/403, adapters 14/112, agent
  14/78; actual-validator effective-tempo PDF/MIDI regression and all domain,
  engine, adapter, publication and client builds pass. Viewer 6/68 runs separately
  as well. No pending test was relabeled. Vite's existing >500 kB chunk warning
  remains nonblocking; no redesign/optimization was added.
- **All five real Chromium workflows pass twice**, first from delivery, then from
  root: library navigation/direct URL/reload, actual browser PDF/MIDI download
  hashes, transport/inspection, 390px mobile/final-measure seek/zoom, unsafe Markdown
  suppression, and empty library without creation/study controls.
- Independent non-substituting browser probe observes a running real AudioContext,
  actual oscillators and role gain nodes: `[.65,.65,.65]` → bass mute `[.65,0,.65]`
  → melody solo `[.65,0,0]`; melody mute then yields `[0,0,0]`, proving mute priority.
  Pause holds time, stop returns to measure 0/time 0, 50% practice gives **5:44**
  versus **2:52**. Native oscillator scheduling at unchanged frequencies
  123.470825 / 246.941651 / 493.883301 Hz has holds **3.75 / .75 / .75 s** at 100%
  and **7.5 / 1.5 / 1.5 s** at 50%: actual live speed behavior, not just a duration label.
  A live single-measure loop stays in occurrence index 8 while
  clock and native cursor repeatedly wrap; 65 live samples are retained. This is
  more than a pressed-state check, but not human listening or latency calibration.
- **373 native hit targets** render. Desktop 1440px and mobile 390px library/viewer
  were directly inspected; page width stays bounded, score is internally scrollable,
  150% zoom/final occurrence seek and cursor/follow work. No page JS errors or
  non-GET/HEAD browser requests were recorded.

## Exact smoke publication and failures

Retained Shelf registration `bb98372d-7b4b-46cf-bc0d-10f904d12582` remains running
and ready at `http://beelinkk:5847`. Its existing checkout/command and store were
not changed. Its command still uses dependency-checkout adapter override and the
workflow worker's store; **it is not the final root publication server**.

Pinned ID:
`arr-1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac`.
Status `unreviewed-draft`, `agent:null`, **deterministic smoke**, capo 2;
46 written bars / 64 occurrences / 361 performed attacks. Actual live client/server,
publication and adapter sources match delivery; after root build, **all 21 frontend
files fetched over HTTP match root-built bytes exactly**, including HTML, canonical
integration JS, renderer chunk, CSS/fonts/licenses. Thus the retained browser tests
exercise the exact integrated frontend without repurposing its server.

Exact live GET/HEAD downloads match both manifest integrity and persisted bytes:

| Artifact | HTTP / MIME | Bytes | SHA-256 |
|---|---|---:|---|
| PDF | 200 / `application/pdf` | 80,520 | `5bf1bcae7fb7af03f7a1fe9b9386fd280a503695e4b40d63b5b1d8e8b00012ec` |
| MIDI | 200 / `audio/midi` | 5,700 | `2098954cbbf4563cbac703c5de1b123873a366271063f636cd9ff092bacc28d5` |

Score/notes exact bytes and HEAD lengths also match. Reopened the real downloaded
MIDI independently: 4 tracks, **361 balanced attacks**, every role/pitch/on/off equals
canonical performed sounds, end tick 245,760. Downloaded PDF is 11 pages; freshly
rasterized and **directly inspected pages 1 and 11**: actual staff/TAB, capo-relative
frets, pass labels and final `o64/S46/P4 FINAL` double bar are visible without
clipping. The unchanged A01 44-page musical/layout audit was not repeated or replaced
by headers. Full-song bytes and these artifact-page rasters remain local only.

Live unknown manifests/PDF/MIDI, raw-source/private paths and obsolete GET API routes
return JSON **404**. POST/PUT/PATCH/DELETE return **405 / Allow: GET, HEAD**.
The unknown viewer deep route intentionally serves the HTML shell (HTTP 200), then
its manifest/score fetch returns 404 and the UI shows “This score couldn’t be
opened,” with no download actions or replacement music. Do not confuse shell status
with successful publication retrieval.

An independent foreground, ephemeral loopback HTTP test of the reviewed handler
copied the real bundle into reviewer-only temporary storage, then tested tampered
MIDI, missing PDF, symlinked notes and manifest path escape. For **each corruption**,
all five file endpoints return JSON **409**, no successful binary download; library
returns zero entries and unavailableCount 1. Original store was untouched, test
server stopped in `finally`, and only owned temporary files were removed. Root's
handler was independently rerun with these same tests after integration.

## Visual/readability finding and evidence

The layout is score-focused and usable on desktop/mobile. The notes are **machine
audit-heavy**: current 40,792-byte notes put identities, inline JSON and candidate
lists ahead of concise playing guidance. This is a final-publication content/readability
concern, especially on mobile, **not an A03 blocker or redesign request**.

Fresh captures were inspected and uploaded with anonymous MIME/SHA-256 verification:

- [Desktop share](https://nextcloud.tail750ac6.ts.net/s/FG7EQxxd8Wtn6ad),
  [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/FG7EQxxd8Wtn6ad/A7VNx8kBSjG9y-J6.png),
  SHA-256 `2709c4e51fbb468d5e610e555041c4d86febd4683afe713c9e60bfdec98b6cfe`.
- [Mobile share](https://nextcloud.tail750ac6.ts.net/s/HFn9M4RQe3aTY2e),
  [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/HFn9M4RQe3aTY2e/5BcfR-9Ep20SBRC8.png),
  SHA-256 `458dea1473b83046134373b19766ca9b3caae1d4848deb870f5c03b0aca75e87`.

Durable results: `viewer-review-r1-http.json`, `viewer-review-r1-browser.json`,
`viewer-review-r1-root-check.txt`, `viewer-review-r1-browser-tests.txt`,
`viewer-integration.json`. Reproducible independent probes are adjacent
`viewer-review-r1-http.ts` and `viewer-review-r1-browser.mjs`. Primary local output:
`/tmp/opencode/guitar-a03-review-r1/`; raw artifact bytes/PDF text are not committed.

Reviewer-only checker corrections are disclosed: the first browser probe mistakenly
treated an absent button as enabled; corrected it to require button existence.
A subsequent gain assertion ran before the React effect/audio quantum settled;
bounded waits on actual gain values pass. A supplemental practice-speed observer
initially sampled before the third source attack was due and read AudioParam's
default value before its quantum ran; corrected it to observe 1.8 seconds and the
unchanged native `setValueAtTime` scheduling arguments. The final root probe above
passes with real source frequencies and doubled holds. The static-file comparison initially
requested `/index.html` (correctly 404), then used the real shell route `/` and all
21 files pass. None required a product change; initial failed logs remain local.

## Commands / remaining switch

```sh
bun install --frozen-lockfile
bun run typecheck:viewer
bun run test:viewer
bun run check:source
bun run check
LD_LIBRARY_PATH=/tmp/opencode/hece-browser-libs/usr/lib64:/tmp/opencode/dernek-document-preview-deps/usr/lib64 \
VIEWER_URL=http://beelinkk:5847 \
CHROMIUM_PATH=/home/taytay/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
bun run test:browser
```

For the independent probes, set `REVIEW_WORKSPACE` to the absolute integrated root,
`REVIEW_OUTPUT` to a private directory outside Git, `PUBLICATION_STORE` to
`/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-bfbeaaab/.arrangements`,
and `VIEWER_URL=http://beelinkk:5847`; run `bun docs/evidence/viewer-review-r1-http.ts`.
The browser probe uses the same workspace/output/origin plus Chromium/library env
above: `bun docs/evidence/viewer-review-r1-browser.mjs`. The probes deliberately pin
this smoke ID; final-publication tests must instead pin the actual new immutable ID.

**Parent still must:** separately review/integrate the bass engine correction and
source-grounded musician plan; publish with the actual factual exact-byte receipt
through root canonical adapters into an ignored dedicated store; start the final
root-owned server through Shelf with that absolute store and no worker adapter
override; preserve the existing 5847 smoke until replacement verification; test the
new origin/ID's exact library, pasted/reloaded viewer, controls and downloaded
PDF/MIDI MIME/hash/persisted bytes; inspect final score/notes and capture/upload
final visual evidence. Do not overwrite the smoke bundle. See `docs/TODO.md` for
the pending checklist. Human audition/calibration remains explicit and pending;
it is not a new blocker for honestly labeled draft downloads. No final-agent links
or human-review claim are produced by this integration review.

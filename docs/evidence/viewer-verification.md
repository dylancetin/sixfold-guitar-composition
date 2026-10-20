# Published-song viewer verification

**VERIFIED as a standalone read-only full-song viewer/download unit on root `95018b3`.** Musical/model/human release
acceptance remains separate; the demonstrated bundle is honestly a deterministic smoke.

## Scope correction and archive

Independent studio review `/tmp/opencode/guitar-studio-review-r1.md` found **NOT VERIFIED
B1**: a source-map edit discarded untouched intentional silence. The user's new scope
superseded that entire editor. Generation/import/prompt/rebuild/approval/save/CAS API/UI,
engine workers and production study fallback were **deleted**, not repaired or hidden.
Archived author evidence is explicitly marked superseded; it is not promoted to a pass.

No subdelegation. Canonical domain/source/engine/adapter and new agent/publication code are
dependencies, not reimplementations. Source/engine and publication/adapters were cherry-picked
only to verify this isolated unit; their original upstream commits remain the integration
authorities. The final owned commit is separate. Workflow documents came from their owner's
dependency commit, not viewer-authored revisions; canonical `docs/decisions.tsv` is unchanged.

## Executed verification

- `bun run check`: **138 pass, 1 explicit optional live skip, 11 existing foundation TODO,
  0 failures, 1074 assertions** in its all-root test phase. The integrated root's **13-check
  foundation/source/engine/adapter/agent/publication aggregator is unchanged and passes**;
  viewer checks follow it. Full src/feature typecheck, all root test files, unchanged
  negative controls, domain build and viewer build pass. ES2023 library types cover the
  canonical adapter's `findLast`; runtime target remains ES2022.
- Viewer boundary suite: **6 pass / 68 assertions**. Real shared-reader use; list/deep
  route/HEAD; exact test-only transport bytes; score and path corruption; symlink rejection;
  artifact tampering/incomplete bundle hiding; empty root with no fixture substitute;
  POST/PUT/PATCH/DELETE all refused, including obsolete studio endpoints.
- Explicit source aggregate and engine browser build also pass, preserving the integrator's
  `check:source` and `build:engine` boundaries.
- **5 real Chromium browser workflows pass** at `http://beelinkk:5847`: published library
  navigation; pasted deep route/reload; native full-song score; actual PDF/MIDI browser
  download hashes; clock advancement/pause; seek/follow; practice speed; loop; mute/solo;
  keyboard note/source inspection; 390px mobile/zoom/final-measure seek without page overflow;
  unsafe Markdown suppression; empty-library chat direction with zero creation controls.
- Browser records **373 native note/beat hit targets**, canonical score counts 46 written /
  64 performed measures and 361 performed attacks (245 melody, 58 bass, 58 harmony), capo 2,
  original concert pitches. No page JavaScript errors in final desktop/mobile captures.
- First real integration run caught a React/imperative renderer child-removal crash and
  an entry-export tree-shaking issue. Both are fixed and the actual canonical factory is
  exercised by the browser suite. A mobile library-width issue was corrected after image
  inspection. No adapter tempo or notation-gap workaround was added.

Evidence: `viewer-baseline.txt`, `viewer-check.txt`, `viewer-source-check.txt`,
`viewer-engine-build.txt`, `viewer-browser-tests.txt`, and `viewer-captures/browser.json`.
The baseline is the genuine absent new-reader test before its implementation, not an
invented prior live-song browser pass. Small binary header fixtures in unit tests are
explicit transport doubles; actual song downloads below are separate real publication bytes.

## Actual immutable publication and exact HTTP links

Title: **The Beach Boys — You Still Believe in Me**. Status `unreviewed-draft`, `agent:null`,
deterministic fallback; **not** model-authored or human-reviewed.
Revision `revision-43c657d4-ae67-44f1-8b24-b17a13c28d69`, digest
`1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac`.

- [Viewer](http://beelinkk:5847/arrangements/arr-1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac)
- [PDF](http://beelinkk:5847/arrangements/arr-1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac/arrangement.pdf): HTTP 200, `application/pdf`, **80,520 bytes**, SHA-256 `5bf1bcae7fb7af03f7a1fe9b9386fd280a503695e4b40d63b5b1d8e8b00012ec`.
- [MIDI](http://beelinkk:5847/arrangements/arr-1a7173e798040887c4c79ab0b56c2c484599c54ba1ffe7d0fd23a5f6ba08a0ac/arrangement.mid): HTTP 200, `audio/midi`, **5,700 bytes**, SHA-256 `2098954cbbf4563cbac703c5de1b123873a366271063f636cd9ff092bacc28d5`.

Both exact public-host URLs were fetched and hash-checked against shared manifest integrity,
in addition to actual browser-triggered downloads. Canonical publication reader validation
remains active. The publisher's full PDF/MIDI musical/page audit is not replaced by this
viewer/hash check.

## Reproduce

```sh
bun install --frozen-lockfile
bun run check
LD_LIBRARY_PATH=/tmp/opencode/hece-browser-libs/usr/lib64:/tmp/opencode/dernek-document-preview-deps/usr/lib64 \
VIEWER_URL=http://beelinkk:5847 \
CHROMIUM_PATH=/home/taytay/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
bun run test:browser
```

Run `scripts/capture-viewer.ts` with the same environment to recreate the actual library/
viewer desktop/mobile captures. `PUBLICATION_ID` pins the demonstrated immutable ID.
Chromium 156.0.8078.4 is local headless automation; desktop tool disconnection does not
prevent these real captures. **No human audible check or new G6 clock/loop benchmark is
claimed.** Synthetic WebAudio timing/controls are not guitarist review or acoustic realism.

Project Shelf owns the sole retained viewer, ID `bb98372d-7b4b-46cf-bc0d-10f904d12582`,
IPv4 wildcard port 5847. The former original-study preview at 5895 was retired through
Shelf. No unmanaged background server or model/provider credentials were introduced.

## Uploaded visual evidence

Each image was anonymously downloaded and SHA-256 verified by Nextcloud; shares are
read-only without expiry. Access still requires reaching the Nextcloud Tailscale host.

- Viewer desktop: [share](https://nextcloud.tail750ac6.ts.net/s/wYggCJCMf7oBnwi),
  [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/wYggCJCMf7oBnwi/MAhgl9VMyOQ7wbdy.png),
  SHA-256 `38ff21ccb68d7b68fff50d054f4ea2737c2e16ec29401cfc416180d7a4b07553`.
- Viewer mobile: [share](https://nextcloud.tail750ac6.ts.net/s/zTXxZYbJTwd6WaA),
  [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/zTXxZYbJTwd6WaA/BtrECjLKi_NlBlEp.png),
  SHA-256 `458dea1473b83046134373b19766ca9b3caae1d4848deb870f5c03b0aca75e87`.
- Library desktop: [share](https://nextcloud.tail750ac6.ts.net/s/ayNmZqCQcXFZkPG),
  [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/ayNmZqCQcXFZkPG/K4V_sCfKPNaikhMN.png),
  SHA-256 `11820c4f16ec448b346a02320779aa640417169fad1c5c949efcd487561f0337`.
- Library mobile: [share](https://nextcloud.tail750ac6.ts.net/s/nb4pyMibRgja69m),
  [PNG](https://nextcloud.tail750ac6.ts.net/public.php/dav/files/nb4pyMibRgja69m/X20__DeXTszXa1qN.png),
  SHA-256 `ebd28f7baacbfacbbb1078d410b597d85a305f72a8472cbd9c7da7dbff1aa8d0`.

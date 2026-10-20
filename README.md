<img src="assets/icon.svg" width="64" height="64" alt="">

# Sixfold — acoustic arrangements

Request a song arrangement **in this project chat**. Agents prepare and publish it, then
return the viewer, PDF and MIDI links here. The website is only a read-only library,
score viewer, player and download page. It has no creation, editing, saving, provider
settings, login or mutation API.

## Install, check and build

```sh
bun install --frozen-lockfile
bun run check
bun run build:client
```

The existing 13-check root aggregator is unchanged; viewer checks run after it. Root tests
discover test files only under `tests/`, including
source, engine, adapters, agent/publication and viewer scopes. The independent
`tools/export-proof` subpackage keeps its own dependency boundary. `check:source` and
`build:engine` remain available for the integrator's existing aggregate.

## Run the published viewer

```sh
ARRANGEMENTS_DIR=/absolute/path/to/.arrangements PORT=3000 bun run start
```

Bun serves built frontend assets and read-only published files on the same port. The
default publication root is `.arrangements`. An empty root stays empty and directs the
reader to project chat; no test music or substitute song is loaded.

For a **retained preview**, use Project Shelf with this worktree's absolute `cwd` and
foreground command `bun run preview:viewer`. Shelf assigns `PORT`; the server binds to
`0.0.0.0`. Set `ARRANGEMENTS_DIR` in that command if the publication store is elsewhere.
Do not leave unmanaged background servers running. Preview mode hot-reloads the read-only
server; production `start` does not run a watcher.

## Published links

- `/` — library of complete, integrity-checked publications.
- `/arrangements/arr-<full-score-digest>` — stable viewer, including after paste/reload.
- The same path plus `/arrangement.pdf` or `/arrangement.mid` — actual stored bytes.
- `/manifest.json`, `/score.json`, `/notes.md` — public bundle data only.

`src/publication/index.ts` owns the shared manifest/ID schemas. The server calls
`readPublication(root,id)` for complete-file, digest, artifact, path and symlink checks;
it does not duplicate that validator. Corrupt/partial bundles are hidden from the library
and rejected at download boundaries. All non-GET/HEAD requests return 405. Private source,
raw artifacts, agent runs, workspace files and credentials are not served.

The browser uses only the canonical `src/adapters/index.ts` notation/playback factories,
with bundled Bravura. It never starts alphaTab native playback. Practice speed, seek,
loop, mute/solo, zoom and note inspection change listening/view state only, not the
published score or its downloads. Rationale in `notes.md` renders without raw HTML.

## Browser verification

```sh
VIEWER_URL=http://beelinkk:5847 bun run test:browser
VIEWER_URL=http://beelinkk:5847 bun scripts/capture-viewer.ts
```

Browser acceptance requires an actual published song; it never substitutes an original
study. Supply `CHROMIUM_PATH` for an existing supported Chromium, or install Playwright's
Chromium. This host also needs the existing extracted libraries in `LD_LIBRARY_PATH`,
documented in the viewer verification evidence.

The isolated build can temporarily read a committed adapter checkout using
`VIEWER_ADAPTER_ENTRY=/absolute/path/to/src/adapters/index.ts bun run build:client`.
Normal integrated builds use the local canonical barrel with no override.

The website does not prepare or publish arrangements. The agent workflow and CLI belong
to the separate [project-chat workflow](docs/AGENT-WORKFLOW.md). A deterministic smoke
publication is not model authorship, human listening, or a musician-reviewed release.

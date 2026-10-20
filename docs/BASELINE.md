# Pre-implementation baseline

This reference records observations on 2026-10-20. The initial inventory preceded all application changes. Only planning documents were added during this run.

## Repository

- Workspace is `/home/taytay/.t3-nightly/projects/guitar-composition`.
- Branch is `main`.
- HEAD is `31619ea7fed9f6cb5773d0c398f11786ebf8ec20`, titled `Initial commit`.
- `git ls-tree -r --long HEAD` contains exactly two tracked files. `README.md` is 121 bytes. `assets/icon.svg` is 303 bytes.
- The README contains the project name and a T3 Code creation link. It does not define a stack, architecture, or product behavior.
- The first `git status --short --branch` after creating `docs/TODO.md` showed `## main` and `?? docs/`. No tracked modifications appeared.
- There is no `package.json`, lockfile, `pyproject.toml`, `Cargo.toml`, `node_modules`, `.github`, `src`, or `tests` directory.

The initial state has no runnable application, test command, score fixture, importer, arrangement engine, playback, or export artifact. No test suite was run. This is an absent baseline, not a green suite or a measured failure rate. Product acceptance is NOT VERIFIED.

The comparison after implementation is absence versus demonstrated behavior for each gate in [the workflow](WORKFLOW.md#release-acceptance). No pre-existing application screenshot can be captured.

## Applicable instructions

No `AGENTS.md` was found at any checked ancestor or inside the repository. The checked ancestor paths were:

- `/AGENTS.md`
- `/home/AGENTS.md`
- `/home/taytay/AGENTS.md`
- `/home/taytay/.t3-nightly/AGENTS.md`
- `/home/taytay/.t3-nightly/projects/AGENTS.md`
- `/home/taytay/.t3-nightly/projects/guitar-composition/AGENTS.md`

The harness instructions and this task brief remain applicable. No new agent was launched. The independent feasibility agent named by the parent owns `/tmp/opencode/guitar-feasibility.md`, not repository documents. That file was absent at the 20:27 UTC probe. No conclusion here depends on its contents.

## Tools and environment

Observed at `2026-10-20T20:27:38Z` on host `beelinkk`:

- Linux x86_64, kernel `5.14.0-687.49.1.el9_8.x86_64`, glibc 2.34.
- Git `2.52.0`, Node `v24.12.0`, npm `11.6.2`, and Python `3.9.25` responded to version commands.
- `pnpm` and `bun` are on PATH. Their compatibility with any future project is untested.
- `uv`, `ffmpeg`, `fluidsynth`, `timidity`, `mscore`, `musescore`, `chromium`, `chromium-browser`, `google-chrome`, `pdftoppm`, `pdfinfo`, and `qpdf` were not on PATH. This does not prove they are absent elsewhere.
- The tool catalog exposes browser automation and screenshot capture, Browserless scraping, Nextcloud image upload, and T3 orchestration. None was used to run or visually verify an application.
- A bounded unauthenticated probe to the local Project Shelf MCP endpoint returned HTTP 401. The service is reachable. Authenticated MCP access and preview readiness remain untested. A catalog search did not expose Project Shelf tools.
- No dependency installation, background server, browser session, external source download, credential read, or service configuration change occurred.

For future previews on this host, the loaded `project-shelf-agent-servers` skill requires a Project Shelf-owned server with the actual worktree path. An unmanaged background process is not an alternative. Future visible UI changes also require the `nextcloud-images` capture and upload workflow. Neither requirement is triggered by these Markdown-only changes.

## User grounding update and existing reference

The user supplied the first song as [The Beach Boys, You Still Believe in Me](https://www.songsterr.com/a/wsa/beach-boys-you-still-believe-in-me-tab-s692866). The product priority is arranging existing songs. Difficulty must be chosen during arrangement prompting. The demo default is intermediate with standard tuning, the user's option 1. These preferences supersede the initial assumption that the song and demo profile were unknown. Excerpt, detailed physical limits, and taste remain open.

The supplied path `/home/taytay/workspace/midi-to-readable-notation` does not exist here. Listing `/home/taytay/workspace` located `/home/taytay/workspace/midi-to-readable-notaion`. The spelling `notaion` is the actual directory and package name. This project was inspected read-only. Its HEAD was `15e6e75b123c7e2426f6ec5376f241d1c14b4153`. `git status --short --branch` showed `## master...origin/master` without changed files. No `AGENTS.md` was found in it or its workspace parent.

Observed reference behavior is source-code evidence, not a live test of song `s692866`:

- `src/server/songsterr.ts:574-621` reads page `script#state`, fetches the selected part from fixed CDN hosts, and validates song, revision, and part identity.
- `src/server/songsterr.ts:624-648` exports `importSong`. Selection order is explicit part, linked part, first vocal, then first track. The new app must still require musician confirmation of the melody.
- `src/server/songsterr.ts:217-256` decodes whole-note duration fractions into quarter-note timing without applying dots or tuplets twice. Its output uses JavaScript numbers. Preserve original fractions when adapting to the proposed exact-time contract.
- `src/server/songsterr.ts:259-295` derives sounding MIDI pitch from source tuning and fret, then drops the original string and fret from normalized notes. Source fingering is not an acoustic arrangement fingering solution.
- `src/server/songsterr.ts:473-565` implements bounded caches, fixed HTTPS origins, manual redirect checks, a 15-second request timeout, and an 8 MiB response limit. `src/server/songsterr.test.ts:393-574` contains boundary regression tests. Those tests were read, not run here.
- `src/audio/timeline.ts:15-90` produces sounding-event timing with tempo conversion and tie merging. `src/audio/player.ts:12-147` implements Web Audio playback, pause, stop, seek, transpose, and volume. These are reuse candidates, not verified R1 controls.
- `index.ts:25-45` exposes `POST /api/import`. `package.json` identifies Bun, Vite, React, TypeScript, and Zod in the reference, not in this empty app.
- `docs/songsterr-conversion.md:7-16` describes an external downloader's alphaTab MIDI and Guitar Pro pipeline. A targeted source search found no `MidiFileGenerator`, `Gp7Exporter`, `writeMidi`, `toMidi`, MIDI download MIME type, or `.mid` export path. The observed reference supplies structured notes and playback, but a working downloadable MIDI path is not established by this inspection.
- `docs/songsterr-conversion.md:61-65` reports lost performance effects and contains an outdated no-playback statement contradicted by current audio source. Prefer current source and measured output over the stale statement.

No code, tests, dependencies, or servers in the reference project were changed or run by this design delegate. At this point, the research delegate's exact-song probe was pending. The next section records its later completion. The [probe requirements](WORKFLOW.md#reference-reuse-and-exact-song-probe) distinguish actual data acquisition from inference and MIDI-note data from a MIDI file.

## Completed research evidence

The later report `/tmp/opencode/guitar-feasibility.md` supersedes the earlier absent-report observation, not the empty-repository baseline. Its scripts and primary artifacts exist in `/tmp/opencode/guitar-probes/`. The design delegate inspected the report, scripts, six normalized source parts, and existing export files. The original reference checkout remained read-only.

Independent parsing is recorded in `/tmp/opencode/guitar-research-artifact-check.json`. It confirms song 692866, revision 847990, 11 tracks, 46 written measures, the repeat markings, five tempo points, and the exact bar-5 melody opening. The report supplies the section-map interpretation and recommends part 1 for intro, part 0 for vocal, part 7 for harmony, and parts 8 or 9 for low bass evidence. Audition and musician approval remain open.

The design delegate independently parsed the 183-byte, five-note alphaTab MIDI, the 8,661-byte diagnostic MIDI with 957 source attacks and five tempos, and the 12,712-byte one-page PDF with music-glyph text and 595 drawing operators. The diagnostic plays written measures once and is not an arrangement. The PDF is not full-song pagination or visual verification. The researcher reports 53 passing reference tests, six skipped, and no failures. This design delegate did not rerun them.

The plan now recommends the tested importer, constraint engine, alphaTab, PDFKit, and SVG-to-PDFKit route. It preserves the original requirement to approve production choices before code. Full repeated form, guitar constraints, real exports, and an optional genuine configured LLM planner replace the earlier excerpt-only estimate. All product acceptance gates remain NOT VERIFIED.

## Parent review checkpoint

The parent supplied `/tmp/opencode/guitar-design-review.md` as an independent evidence-based architecture challenge. This design delegate read it after already changing the excerpt-only scope to full-song acceptance. Its older-snapshot scope criticism is preserved as review history, not presented as a defect in the latest scope. The review independently reports missing `architect/SKILL.md`, tests and artifact checks, triplets, an alphaTab inherited-tempo counterexample, and required held-finger state. It is an architecture fallback, not a literal architect or arena run. Reviewer model identity is not recorded, so cross-model review is not claimed.

Alignment corrections add triplets, a viable explicitly unfolded 64-occurrence projection, required placement and held-hand schemas, and usable hard-validated draft downloads before musician review. They remove unrequested rights and consent approval blockers. The parent approved subsequent reversible source, contract, test-foundation, and export-proof work and authorized a documentation-only checkpoint commit. No application code was added by this design delegate.

The pre-commit `/home/taytay/.agents/skills/deslop/SKILL.md` lookup was also unavailable. No skill installation or extra delegation was attempted. The document and diff check is not represented as that missing skill's execution.

The final user amendment adds capo to arrangement prompting, with at least capo 0 and 2 compared in R1. It preserves concert melody and key, distinguishes transposition, separates physical neck limits from relative fret stretch, and requires labeled relative TAB plus non-double-transposed MIDI. B major remains a hypothesis for source analysis, not an observed key. Literal capo controls are F8 in the workflow.

## Skills read

These files were read in full from `/home/taytay/.agents/skills/`:

- `figure-it-out/SKILL.md`
- `poteto-mode/SKILL.md`, including Principles
- `principle-prove-it-works/SKILL.md`
- `principle-type-system-discipline/SKILL.md`
- `show-me-your-work/SKILL.md`
- `show-me-your-work/references/decision-log-template.tsv`
- `technical-writing/SKILL.md`
- `unslop/SKILL.md`
- `no-comments/SKILL.md`
- `project-shelf-agent-servers/SKILL.md`, loaded through the skill tool

Prove It Works changed the release gates to require real score, audio-timing, PDF, and MIDI evidence. Type System Discipline changed the proposed contract to distinguish revisions, approval states, musical time, and external input validation. No unread principle is claimed as an applied leaf skill.

## Unavailable skills and deferred reviews

The following conventional paths under `/home/taytay/.agents/skills/<name>/SKILL.md` were checked and were unavailable:

- `how`, `architect`, `arena`, and `create-skill`
- `principle-laziness-protocol`
- `principle-foundational-thinking`
- `principle-sequence-verifiable-units`
- `principle-separate-before-serializing-shared-state`
- `principle-model-the-domain`
- `principle-boundary-discipline`
- `principle-experience-first`
- `principle-exhaust-the-design-space`
- `principle-build-the-lever`
- `principle-test-behavior-not-implementation`
- `principle-never-block-on-the-human`
- `principle-encode-lessons-in-structure`

No substitute skill contents were invented. Architecture experiments are proposed, not represented as a completed `architect` or `arena` run. Repairing skill installations or opening skill PRs is outside this brief.

The `no-comments` delegated pass and `show-me-your-work` cross-model review were not run. This task forbids extra agents at grounding and permits only GPT-6.1-Sol xhigh for later delegation. No application code comments exist to inspect. An independent review remains open, not implicitly passed.

`agent-transcripts/` is absent in this workspace. The audit can check this conversation's visible actions and real files, but it cannot claim the skill's on-disk transcript audit. No unrelated private transcript directories were searched.

## Reproduction commands

Run these read-only commands from the workspace. The HEAD inventory remains the original baseline even after planning documents are added.

```sh
git rev-parse HEAD
git status --short --branch
git ls-tree -r --long 31619ea7fed9f6cb5773d0c398f11786ebf8ec20
git log -1 --format=fuller
git --version
node --version
npm --version
python3 --version
```

The command `command -v <tool>` reproduces each PATH lookup. No build or test command can be specified until a stack and package manifest exist.

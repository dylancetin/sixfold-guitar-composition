# Source adapter provenance

The page `script#state` → `meta.current` → validated per-part CDN discovery,
bounded UTF-8 response reader, source pitch convention, and whole-note rhythm
decoding are adapted from the user's proven local reference:

- `/home/taytay/workspace/midi-to-readable-notaion/src/server/songsterr.ts`
- reference commit `15e6e75b123c7e2426f6ec5376f241d1c14b4153`
- model, importer tests, `src/audio/timeline.ts`, `docs/songsterr-conversion.md`

The reference is read-only and is not a runtime dependency. No reference files
were changed or its copyrighted song fixtures copied into distributable tests.
Its local repository contains no license file: this is user-authorized adaptation,
not a claim that the reference was published under an inferred open-source license.

Reference documentation credits the MIT-licensed Songsterr downloader at
<https://github.com/Metaphysics0/songsterr-downloader/tree/097ee38212715307929b54627c79fbd8af9e41cc>.
No converter code or renderer dependency from that project is included here.

Deliberate differences: no alternate-host retry; stop on restrictions/403;
all parts instead of website-default melody; rational quarters with BigInt
helpers; strict rhythm/tie/meter consistency; raw hash-addressed artifacts;
explicit unsupported effects and provisional identity; source-grounded but
unapproved explicit melody proposal. This is an internal public player format,
not a stable documented API or permission to redistribute score content.

The 1.1/1.2 feel/grace interpretation independently implements the observable
public player's inherited feel, pair-wise rational swing mapping and bounded
grace time-borrowing conventions. The public client was inspected locally to
establish timing semantics; no client bundle or downloaded musical excerpt is
included in this repository's fixtures. Known expressive articulations remain
explicit draft limitations rather than a claim of source-performance playback.

The 1.3 source-capo interpretation was checked against the current public
client's sounding-pitch and staff-position calculations: source tuning plus
relative fret plus source capo. `tuningFlat` only controls note-name display.
No public-client bundle or copyrighted musical excerpt is included in tests.

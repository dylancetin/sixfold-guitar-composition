# Acoustic guitar preview samples

`guitar-samples.ts` contains the five mono PCM zones from the steel-string acoustic
guitar preset (bank 0, program 25) in `@coderline/alphatab@1.8.4`'s bundled
`dist/soundfont/sonivox.sf2`. These are instrument samples, not song audio.

Regenerate with `bun scripts/extract-guitar-samples.ts` after a frozen install.
The generated header records the exact source SF2 hash. PCM, key ranges, tuning,
attenuation and loop points are preserved; the preview applies its own decaying
pluck/filter envelope and short note-off fade. No external audio request or full
SoundFont synthesizer is required at playback time. This changes listening timbre
only, not canonical pitches, timing, capo, score or immutable PDF/MIDI exports.

Upstream: https://github.com/coderline/alphaTab/tree/v1.8.4/packages/alphatab/dist/soundfont
and https://musical-artifacts.com/artifacts/1517. Based on SONiVOX EAS from the
Android Open Source Project.

Copyright (c) 2004-2006 Sonic Network Inc.
Licensed under the Apache License, Version 2.0.
https://www.apache.org/licenses/LICENSE-2.0

The bundled third-party notices include the upstream soundfont license. The full
license and modification notice ship in `public/assets/SONIVOX-LICENSE.txt`.

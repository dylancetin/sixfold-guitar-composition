# U11/U12 B1 — effective canonical tempo correction

Subsequent gap correction: [adapters-gap-correction.md](adapters-gap-correction.md).
The actual-song blocker recorded below was the separate finding at this tempo
commit; it is now corrected above this commit, with local full-song byte checks.

This is the narrow correction above `043b1fc`, not full-song/root integration.
Independent round-1 review `/tmp/opencode/guitar-adapters-review-r1.md` correctly
marked that commit **NOT VERIFIED** for double-applying revision tempo scale.

## Gate corrected before any unrelated feature work

The previous non-unit-scale unit case was invalid: it changed the preference to
0.9 but left effective performed/entry tempos at written 80 BPM. The fixture-only
oracle accepted it; the real independent validator does not. That test therefore
did **not** establish canonical non-unit-tempo correctness. It is corrected to
materialize entry/performed BPM at 72, and the fixture oracle now checks effective
BPM. A separate integration regression requires the actual `guitarValidator` and
explicitly proves the old preference-only fixture is rejected.

The new regression was run **before** the production change. It failed on a
real-validator-passed 80-written/0.5 revision with actual MIDI/PDF/audio at 20 BPM,
24 seconds, PDF captions `[20,20]`, runtime 0.75 duration 16 seconds. Evidence:

`/tmp/opencode/guitar-adapters-tempo-fix/before/result.json`

## Minimal production change

- Native engraving and MIDI consume materialized `performedTempos.quarterBpm`
  directly; no preference multiplication at those boundaries.
- Initial audio consumes the same effective map directly. Absolute runtime tempo
  applies `requestedScale / revision.preferences.tempoScale` to that map.
- No new timing model/schema, musical change, source/engine change, gap/rest fix,
  persistence/endpoint change or root integration. Existing quarter-preserving
  reschedule/cancellation behavior is retained.

## Real-validator regression after correction

```sh
ADAPTERS_VALIDATOR_MODULE=/home/taytay/.t3-nightly/worktrees/guitar-composition/t3-2e0bc3f7/src/engine/index.ts \
  bun run test:adapters:tempo /tmp/opencode/guitar-adapters-tempo-fix/after
```

`tests/adapters/effective-tempo.ts` requires a real module, never a passing fallback.
In an integrated checkout it defaults to `src/engine/index.ts`. This isolated
worktree must supply the real engine module path. Each PDF/MIDI request reruns
`independent-guitar-validator-1`, using empty trusted approval context. The real
validator passes both original-source cases with only transition-unverified warning.

- **Constant source 80 / revision 0.5:** canonical map `[40,40]`; actual MIDI
  `1,500,000 µs/quarter`, 12 seconds; initial audio 12 seconds; actual PDF captions
  `[40,40]`; runtime absolute 0.75 produces 60 BPM and 8 seconds.
- **Repeat-entry restoration:** written `[80,120]` repeated twice, revision 0.5;
  effective map `[40,60,40,60]`; actual MIDI/PDF map agrees; initial duration
  20 seconds, runtime 0.75 duration 40/3 seconds. Jump at tick 7,680 restores
  40 BPM instead of carrying 60. Quarter 12 occurs at 16 seconds initially.
- Exact complete role/pitch/note-tick unions are unchanged. Tempo switch preserves
  quarter position, cancels and reschedules sources. Each case uses two actual
  validator calls for two binary exports.

Actual MIDI/PDF, manifests, source/score snapshots, parsed observations and validation
reports are under `after/constant-80-at-half/` and `after/repeat-entry-restoration/`.
Summary: `after/result.json`.

## Real browser / visible caption check

```sh
LD_LIBRARY_PATH=/tmp/opencode/hece-browser-libs/usr/lib64:/tmp/opencode/dernek-document-preview-deps/usr/lib64 \
  bun /tmp/opencode/guitar-adapters-tempo-fix/browser-tempo.ts
```

Actual Chromium 156.0.8078.4, 44,100 Hz WebAudio: 12-second initial duration,
8-second runtime duration, exact quarter preservation; runtime elapsed audio
1.599274 seconds equals quarter advance 1.599274 at 60 BPM. Initial/runtime DSP
RMS 0.079011/0.061683, pause RMS 0. Native browser engraving and independently
rasterized PDF visibly show `= 40` at both occurrences. No preview server, hardware
audition or human-playability claim.

- `/tmp/opencode/guitar-adapters-tempo-fix/after/browser-tempo.json`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/browser-tempo.png`
- `/tmp/opencode/guitar-adapters-tempo-fix/after/constant-80-at-half/pdf-page-01.png`
- [Verified screenshot share](https://nextcloud.tail750ac6.ts.net/s/KK7473QrPaJRFTw)

Targeted real-validator regression passes; adapter unit tests 13/13; adapter/domain
typechecks pass; foundation tests 32 pass / 11 named TODOs. Re-review remains the
parent's gate, not self-approval of the full unit/release.

## Separate actual-song smoke outcome

All provided actual-song candidates pass the actual validator, but full export is
blocked by an adapter-generated three-dot gap-rest encoding, unrelated to tempo
(all actual-song candidates here have revision scale 1). It is deliberately NOT
fixed in this tempo commit. The exact source-ID/pitch/time/native reproduction and
unmodified-input hashes are local only:

`/tmp/opencode/guitar-live-exports/report.md`

No full-song fixture or artifact has been added to Git, and no passing artifact
claim is made for an export rejected before producing bytes.

# Swing import fix — 2026-10-21

Reported source: <https://www.songsterr.com/a/wsa/beach-boys-god-only-knows-vocal-tab-s31795>.
The unrestricted public source was acquired through the existing bounded adapter;
raw files remain under ignored `tests/source/.local/`, not in this evidence.

## Fixed boundary

Parser 1.1.0 interprets inherited `8th`/`16th` feel as exact 2:1 event timing,
including releases, rests, dotted values and ties. `off`/`none` resets straight
time. Explicit tuplets/finer subdivisions suppress their pair across voices;
unknown feels still fail closed. Effective feel is compared between parts.
No domain schema or renderer playback swing was added.

The reported source declares eighth feel at bar 1, straight time at bar 32,
and eighth feel again at bar 36. After the fix, parts 0–4 normalize through
all 83 bars. The lead-vocal part has 267 canonical events and 151 note segments
whose performed durations differ from nominal written fractions.

## Verification

- `bun install --frozen-lockfile` — passed.
- `bun run check:source` — 62 tests passed, including 16 swing regressions.
- `bunx tsc --project tests/agent/tsconfig.json` — passed.
- `bun test tests/agent` — 14 tests passed.
- `bun test tests/adapters/swing.test.ts` — passed: original four-bar exercise
  through the real engine, independent validator, canonical PDF and MIDI
  exporters; literal PPQ960 attack/release oracle, balanced notes, actual PDF
  staff/TAB glyphs, and a rejected straightened-rhythm mutation. No fake exporter.
- `bun run check` — passed, including the new source/export regressions.

## Remaining blocker — no draft published

The same full-source import now stops at a separate, pre-existing unsupported
grace-note construct: French-horn part 5, bar 2, voice 0, beat index 1
(`p5:b2:v0:bt1`, `graceNote: beforeBeat`). The grace notes were not dropped,
converted into ordinary full-duration attacks, or used to authorize a partial
source. No whole-song arrangement/PDF/MIDI or completed-draft claim was made.
Musical planning, source selection and human review are not established by
these software tests.

Follow-up: the grace/metadata/preparation blocker above was subsequently
addressed by parser 1.2.0; see [grace-import-fix.md](grace-import-fix.md). This
section records the earlier stop, not the current importer status.
